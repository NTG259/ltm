"""Build and verify the shareable Chapter 7 evidence archive."""

import hashlib
import io
import json
import pathlib
import re
import zipfile
from datetime import datetime, timezone


ROOT = pathlib.Path(__file__).resolve().parents[1]
RESULTS = ROOT / "results" / "chapter7"
TARGET = ROOT / "CodeJudge_Chapter7_Results.zip"

SCRIPT_NAMES = [
    "CHAPTER7.md",
    "chapter7_audit.py",
    "chapter7_docx.py",
    "chapter7_environment.py",
    "chapter7_experiment.py",
    "chapter7_failover.py",
    "chapter7_k6.py",
    "chapter7_k6_finalize.py",
    "chapter7_prometheus_export.py",
    "chapter7_reconcile.py",
    "chapter7_report.py",
    "chapter7_scaling.py",
    "docx-renderer.Dockerfile",
]
K6_NAMES = [
    "chapter7_common.js",
    "scenario_a_throughput.js",
    "scenario_b_wait_time.js",
    "scenario_1000.js",
]
SKIP_PARTS = {"__pycache__", "node_modules", ".git"}
SECRET_PATTERNS = [
    re.compile(rb"\beyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\b"),
    re.compile(rb"\bBearer\s+[A-Za-z0-9._-]{12,}\b", re.I),
    re.compile(rb"\b(?:access|refresh|attempt)[_-]?token\s*[:=]\s*['\"]?[A-Za-z0-9._-]{16,}", re.I),
    re.compile(rb"\b(?:password|passwd|secret|api[_-]?key)\s*[:=]\s*['\"][^'\"\r\n]{3,}['\"]", re.I),
    re.compile(rb"\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b", re.I),
    re.compile(rb"admin123", re.I),
]


def files_to_pack():
    for path in sorted(RESULTS.rglob("*")):
        if not path.is_file():
            continue
        relative = path.relative_to(RESULTS)
        if any(part in SKIP_PARTS or part.startswith("rendered") for part in relative.parts):
            continue
        yield path
    for name in SCRIPT_NAMES:
        yield ROOT / "tests" / name
    for name in K6_NAMES:
        yield ROOT / "tests" / "k6" / name
    for path in sorted((ROOT / "monitoring").rglob("*")):
        if path.is_file() and not any(part in SKIP_PARTS for part in path.parts):
            yield path
    yield ROOT / "worker" / "worker.py"


def shareable_bytes(path):
    data = path.read_bytes()
    relative = path.relative_to(ROOT).as_posix()
    if relative == "tests/chapter7_experiment.py":
        old = b'password=os.getenv("DB_PASSWORD", "codejudge")'
        assert old in data
        data = data.replace(old, b'password=os.getenv("DB_PASSWORD")')
    elif relative == "tests/chapter7_audit.py":
        old = b"|admin123"
        assert old in data
        data = data.replace(old, b"")
    elif relative == "monitoring/exporter/exporter.py":
        old = b"password=os.getenv('DB_PASSWORD','codejudge')"
        assert old in data
        data = data.replace(old, b"password=os.getenv('DB_PASSWORD')")
    elif relative == "monitoring/compose.yaml":
        old = b"DB_PASSWORD: ${DB_PASSWORD:-codejudge}"
        assert old in data
        data = data.replace(old, b"DB_PASSWORD: ${DB_PASSWORD:?Set DB_PASSWORD in the environment}")
    elif relative == "results/chapter7/07-tables/manifest.json":
        linked = json.loads(data)
        for entry in linked["figures"] + linked["tables"]:
            entry["path"] = entry["path"].replace("\\", "/")
            entry["source_files"] = [source.replace("\\", "/") for source in entry["source_files"]]
        data = (json.dumps(linked, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
    if path.suffix.lower() in {".csv", ".json", ".log", ".md", ".py", ".js", ".yaml", ".yml", ".dockerfile"}:
        for pattern in SECRET_PATTERNS:
            if pattern.search(data):
                raise RuntimeError(f"Potential secret in {relative}: {pattern.pattern!r}")
    elif path.suffix.lower() == ".docx":
        with zipfile.ZipFile(io.BytesIO(data)) as document:
            for name in document.namelist():
                if not name.startswith("word/") or not name.endswith(".xml"):
                    continue
                content = document.read(name)
                for pattern in SECRET_PATTERNS:
                    if pattern.search(content):
                        raise RuntimeError(f"Potential secret in {relative}/{name}: {pattern.pattern!r}")
    return data


def build():
    audit = json.loads((RESULTS / "08-report" / "quality_audit.json").read_text(encoding="utf-8"))
    assert audit["pass"] and audit["checked_runs"] == 19
    selected = {}
    for path in files_to_pack():
        if not path.is_file():
            raise FileNotFoundError(path)
        relative = path.relative_to(ROOT).as_posix()
        if relative in selected:
            raise RuntimeError(f"Duplicate path: {relative}")
        selected[relative] = shareable_bytes(path)

    required = [
        "results/chapter7/08-report/CHUONG_7_KET_QUA_SAN_SANG_CHEN.md",
        "results/chapter7/08-report/CHUONG_7_KET_QUA_SAN_SANG_CHEN.docx",
        "results/chapter7/07-tables/manifest.json",
        "results/chapter7/06-grafana/Grafana_Dashboard_K6_Large.png",
        "results/chapter7/06-grafana/dashboard.json",
        "tests/k6/chapter7_common.js",
        "tests/k6/scenario_a_throughput.js",
        "tests/k6/scenario_b_wait_time.js",
        "tests/k6/scenario_1000.js",
    ]
    for name in required:
        assert name in selected, name
    for run in audit["runs"]:
        matches = [name for name in selected if f"/{run['run_id']}/summary.json" in name]
        assert len(matches) == 1, run["run_id"]
        folder = matches[0].rsplit("/", 1)[0]
        assert f"{folder}/config.json" in selected
    for failed in (
        "20261101T114808-accuracy-a2fe9a",
        "20261101T114930-load-5973b9",
        "20261101T120359-k6-cd1392",
        "20261101T115703-master-restart-090da6",
    ):
        assert any(f"/{failed}/" in name for name in selected)
    for name in ("20261101T120337-k6-7613b8", "20261101T120342-k6-991d74", "20261101T120359-k6-cd1392"):
        assert any(f"/{name}/k6.csv" in path for path in selected)

    manifest = {
        "created_at_utc": datetime.now(timezone.utc).isoformat(),
        "description": "CodeJudge Chapter 7 local experiment evidence; includes all 19 runs and failed runs.",
        "run_ids": [run["run_id"] for run in audit["runs"]],
        "failed_run_ids": [
            "20261101T114808-accuracy-a2fe9a",
            "20261101T114930-load-5973b9",
            "20261101T120359-k6-cd1392",
            "20261101T115703-master-restart-090da6",
        ],
        "files": [
            {"path": name, "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}
            for name, data in sorted(selected.items())
        ],
    }
    readme = """# CodeJudge Chapter 7 results archive

This archive contains all 19 local experiment runs, including four runs that did not meet their test criteria. `results/chapter7/08-report/` has the completed Chapter 7 report and audit. `07-tables/manifest.json` maps every summary table and chart to source files. `ARCHIVE_MANIFEST.json` contains the SHA-256 and byte count for every packaged file except the manifest itself.

Per-run `config.json`, `summary.json`, CSV and logs are under `02-accuracy/`, `03-load/`, `04-worker-scaling/` and `05-failover/`. The three actual k6 runs each retain their original `k6.csv` and `k6_summary.json`. Their executed JavaScript is under `tests/k6/`, with the Python runner and metric calculation scripts under `tests/`. `monitoring/` has the dashboard and exporter configuration. The DB password default was removed from archived code; provide credentials through environment variables if rerunning against a local DB.

Metric definitions and the local run procedure are in `tests/CHAPTER7.md` and the Chapter 7 report. HTTP POST latency, verdict latency, queue waiting, Worker BUSY/online time and DB-recorded submission counts are separate measures. The 1,000-concurrent-submission target was not met. DOCX render previews were excluded because they are derived from the final DOCX.

No live database, JWT, password value, credential file, `.git` or `node_modules` is included.
""".encode("utf-8")
    selected["ARCHIVE_README.md"] = readme
    manifest["files"].append({"path": "ARCHIVE_README.md", "bytes": len(readme), "sha256": hashlib.sha256(readme).hexdigest()})
    manifest_bytes = (json.dumps(manifest, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
    selected["ARCHIVE_MANIFEST.json"] = manifest_bytes

    with zipfile.ZipFile(TARGET, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6, allowZip64=True) as archive:
        for name, data in sorted(selected.items()):
            archive.writestr(name, data)
    with zipfile.ZipFile(TARGET) as archive:
        assert archive.testzip() is None
        names = set(archive.namelist())
        assert names == set(selected)
        linked = json.loads(archive.read("results/chapter7/07-tables/manifest.json"))
        for entry in linked["figures"] + linked["tables"]:
            assert "results/chapter7/" + entry["path"].replace("\\", "/") in names
            for source in entry["source_files"]:
                assert "results/chapter7/" + source.replace("\\", "/") in names, source
        for item in manifest["files"]:
            data = archive.read(item["path"])
            assert len(data) == item["bytes"]
            assert hashlib.sha256(data).hexdigest() == item["sha256"]
    print(json.dumps({"zip": str(TARGET), "files": len(selected), "runs": len(audit["runs"]),
                      "bytes": TARGET.stat().st_size, "sha256": hashlib.sha256(TARGET.read_bytes()).hexdigest()},
                     ensure_ascii=False))


if __name__ == "__main__":
    build()
