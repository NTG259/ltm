"""Reproducible local CodeJudge experiments. Never logs credentials or tokens.

Usage: py -3.13 tests/chapter7_experiment.py accuracy|load --vus N --count N
Credentials are read from TEST_USERNAME/TEST_PASSWORD; database settings from DB_*.
"""
import argparse
import concurrent.futures
import csv
import json
import os
import pathlib
import platform
import re
import statistics
import subprocess
import threading
import time
import uuid
from datetime import datetime, timezone

import psycopg
import requests

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "results" / "chapter7"
BASE = os.getenv("BASE_URL", "http://127.0.0.1:18000").rstrip("/")
PROBLEM_ID = int(os.getenv("TEST_PROBLEM_ID", "1"))
AC = '#include <iostream>\nint main(){long long a,b;std::cin>>a>>b;std::cout<<a+b<<"\\n";}\n'
SOURCES = {
    "AC": AC,
    "WA": '#include <iostream>\nint main(){std::cout<<0<<"\\n";}\n',
    "CE": 'int main( { broken C++ syntax }\n',
    "TLE": 'int main(){volatile unsigned long long n=0;while(true){++n;}}\n',
    "MLE": '#include <cstdlib>\nint main(){volatile char *p=(char*)malloc(400000000);for(unsigned long i=0;i<400000000;i+=4096)p[i]=1;return 0;}\n',
    "RTE": '#include <cstdlib>\nint main(){std::abort();}\n',
}


def now():
    return datetime.now(timezone.utc).isoformat()


def command(*args):
    return subprocess.run(args, cwd=ROOT, capture_output=True, text=True,
                          encoding="utf-8", errors="replace", timeout=30).stdout.strip()


def safe_log(value):
    value = re.sub(r'\b[0-9a-fA-F]{8}-(?:[0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}\b', '<redacted-uuid>', value)
    value = re.sub(r'\b[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b', '<redacted-jwt>', value)
    return value


def db():
    return psycopg.connect(host=os.getenv("DB_HOST", "127.0.0.1"), port=int(os.getenv("DB_PORT", "15432")),
                           dbname=os.getenv("DB_NAME", "codejudge"), user=os.getenv("DB_USERNAME", "codejudge"),
                           password=os.getenv("DB_PASSWORD", "codejudge"), autocommit=True)


def token():
    user = os.getenv("TEST_USERNAME")
    password = os.getenv("TEST_PASSWORD")
    if not user or not password:
        raise RuntimeError("Set TEST_USERNAME and TEST_PASSWORD in process environment")
    response = requests.post(BASE + "/api/auth/login", json={"username": user, "password": password}, timeout=15)
    response.raise_for_status()
    return response.json()["token"]


def query(conn, sql, params=()):
    with conn.cursor() as cur:
        cur.execute(sql, params)
        return cur.fetchall()


def worker_ids(conn):
    return [r[0] for r in query(conn, "select id from workers where status in ('IDLE','BUSY') order by id")]


def write_csv(path, rows, columns):
    with path.open("w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=columns, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def percentile(values, q):
    if not values:
        return None
    values = sorted(values)
    pos = (len(values) - 1) * q
    lo = int(pos)
    return round(values[lo] + (values[min(lo + 1, len(values) - 1)] - values[lo]) * (pos - lo), 3)


def summary_stats(values):
    return {"avg": round(statistics.mean(values), 3) if values else None,
            "p50": percentile(values, .5), "p95": percentile(values, .95)}


def mark(source, run_id):
    return "// chapter7 run_id=" + run_id + "\n" + source


def submit(session, source, run_id):
    started = time.time()
    try:
        response = session.post(BASE + "/api/submissions", json={"problemId": PROBLEM_ID,
                                "sourceCode": mark(source, run_id), "language": "cpp17"}, timeout=30)
        elapsed = round((time.time() - started) * 1000, 3)
        data = response.json() if response.status_code == 200 else {}
        return {"request_at": started, "http_status": response.status_code,
                "http_ms": elapsed, "submission_id": data.get("id"), "error": "" if response.status_code == 200 else "HTTP " + str(response.status_code)}
    except Exception as exc:
        return {"request_at": started, "http_status": None, "http_ms": round((time.time() - started)*1000, 3),
                "submission_id": None, "error": type(exc).__name__}


def wait_terminal(conn, ids, timeout_s):
    deadline = time.monotonic() + timeout_s
    states = {}
    while True:
        rows = query(conn, "select id,status,verdict from submissions where id = any(%s)", (ids,)) if ids else []
        states = {r[0]: {"status": r[1], "verdict": r[2]} for r in rows}
        if len(states) == len(ids) and all(r["status"] in ("FINISHED", "FAILED") for r in states.values()):
            return states
        if time.monotonic() >= deadline:
            return states
        time.sleep(1)


def event_details(conn, ids):
    if not ids:
        return {}, []
    rows = query(conn, """select s.id,s.status,s.verdict,s.worker_id,s.attempts,s.created_at,s.started_at,s.finished_at,
                         s.time_ms,s.memory_kb,e.event,e.created_at,e.worker_id,e.attempt,e.note
                         from submissions s left join submission_events e on e.submission_id=s.id
                         where s.id = any(%s) order by s.id,e.created_at,e.id""", (ids,))
    submissions, events = {}, []
    for row in rows:
        sid = row[0]
        submissions[sid] = {"submission_id": sid, "status": row[1], "verdict": row[2], "worker_id": row[3],
                            "attempts": row[4], "created_at": row[5].isoformat(),
                            "started_at": row[6].isoformat() if row[6] else None,
                            "finished_at": row[7].isoformat() if row[7] else None,
                            "time_ms": row[8], "memory_kb": row[9]}
        if row[10]:
            events.append({"submission_id": sid, "event": row[10], "time": row[11].isoformat(),
                           "worker_id": row[12], "attempt": row[13], "note": row[14]})
    return submissions, events


def queue_waits(submissions, events):
    grouped = {}
    for event in events:
        grouped.setdefault(event["submission_id"], []).append(event)
    waits = []
    for sid, evs in grouped.items():
        origin = datetime.fromisoformat(submissions[sid]["created_at"])
        for ev in evs:
            t = datetime.fromisoformat(ev["time"])
            if ev["event"] == "REQUEUED":
                origin = t
            elif ev["event"] == "ASSIGNED":
                waits.append(round((t-origin).total_seconds()*1000, 3))
    return waits


def peak_concurrency(submissions):
    points = []
    for row in submissions.values():
        points.append((row["created_at"], 1))
        if row["finished_at"]:
            points.append((row["finished_at"], -1))
    active = peak = 0
    for _, delta in sorted(points, key=lambda x: (x[0], x[1])):
        active += delta
        peak = max(peak, active)
    return peak


def create_run(kind, vus, count):
    run_id = datetime.now().strftime("%Y%m%dT%H%M%S") + "-" + kind + "-" + uuid.uuid4().hex[:6]
    folder = OUT / {"accuracy": "02-accuracy", "load": "03-load", "scaling": "04-worker-scaling"}[kind] / run_id
    folder.mkdir(parents=True, exist_ok=False)
    return run_id, folder


def run(kind, vus, count, observe_s):
    run_id, folder = create_run(kind, vus, count)
    conn = db()
    workers = worker_ids(conn)
    config = {"run_id": run_id, "kind": kind, "started_at": now(), "git_commit": command("git", "rev-parse", "HEAD"),
              "base_url": BASE, "problem_id": PROBLEM_ID, "vus": vus, "iterations": count,
              "observation_s": observe_s, "registered_workers": workers,
              "docker_cpu": command("docker", "info", "--format", "{{.NCPU}}"),
              "docker_memory_bytes": command("docker", "info", "--format", "{{.MemTotal}}"),
              "host": platform.platform(), "go_judge_parallelism": 4}
    (folder / "config.json").write_text(json.dumps(config, indent=2, ensure_ascii=False), encoding="utf-8")
    auth = token()
    session = requests.Session()
    session.headers.update({"Authorization": "Bearer " + auth})
    resource_rows = []
    sampling_stop = threading.Event()
    def sample_resources():
        while not sampling_stop.is_set():
            for line in command("docker", "stats", "--no-stream", "--format", "{{json .}}").splitlines():
                try:
                    item = json.loads(line)
                    if item.get("Name", "").startswith("codejudge-"):
                        resource_rows.append({"time": now(), "container": item.get("Name"),
                                              "cpu_percent": item.get("CPUPerc"), "memory_usage": item.get("MemUsage"),
                                              "memory_percent": item.get("MemPerc")})
                except json.JSONDecodeError:
                    pass
            sampling_stop.wait(3)
    sampler = threading.Thread(target=sample_resources, daemon=True)
    sampler.start()
    if kind == "accuracy":
        planned = list(SOURCES.items())
    else:
        planned = [("AC", AC)] * count
    requests_rows = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=vus) as pool:
        futures = [pool.submit(submit, session, source, run_id) for _, source in planned]
        for (expected, _), future in zip(planned, futures):
            requests_rows.append({"run_id": run_id, "expected": expected, **future.result()})
    accepted = [r["submission_id"] for r in requests_rows if r["submission_id"] is not None]
    if len(accepted) != len(set(accepted)):
        raise RuntimeError("Duplicate submission IDs returned")
    states = wait_terminal(conn, accepted, observe_s)
    sampling_stop.set()
    sampler.join(timeout=10)
    write_csv(folder / "resources.csv", resource_rows, ["time","container","cpu_percent","memory_usage","memory_percent"])
    submissions, events = event_details(conn, accepted)
    for row in requests_rows:
        detail = submissions.get(row["submission_id"], {})
        row.update({"status": detail.get("status"), "verdict": detail.get("verdict"),
                    "worker_id": detail.get("worker_id"), "attempts": detail.get("attempts"),
                    "result": ("PASS" if detail.get("status") == "FINISHED" and detail.get("verdict") == row["expected"] else "FAIL") if kind == "accuracy" else ""})
    write_csv(folder / "submissions.csv", requests_rows,
              ["run_id","expected","request_at","http_status","http_ms","submission_id","error","status","verdict","worker_id","attempts","result"])
    write_csv(folder / "events.csv", events, ["submission_id","event","time","worker_id","attempt","note"])
    write_csv(folder / "verdicts.csv", [dict(run_id=run_id, **v) for v in submissions.values()],
              ["run_id","submission_id","status","verdict","worker_id","attempts","created_at","started_at","finished_at","time_ms","memory_kb"])
    if kind == "accuracy":
        tests = query(conn, "select submission_id,test_index,status,time_ms,memory_kb from submission_test_results where submission_id = any(%s) order by submission_id,test_index", (accepted,))
        write_csv(folder / "test_results.csv", [{"submission_id": x[0],"test_index": x[1],"status": x[2],"time_ms": x[3],"memory_kb": x[4]} for x in tests],
                  ["submission_id","test_index","status","time_ms","memory_kb"])
    finished = [r for r in submissions.values() if r["status"] == "FINISHED"]
    failed = [r for r in submissions.values() if r["status"] == "FAILED"]
    http_values = [r["http_ms"] for r in requests_rows if r["http_status"] == 200]
    verdict_values = [(datetime.fromisoformat(r["finished_at"])-datetime.fromisoformat(r["created_at"])).total_seconds()*1000
                      for r in submissions.values() if r["finished_at"]]
    waits = queue_waits(submissions, events)
    active_start = min(starts) if (starts := [r["request_at"] for r in requests_rows]) else time.time()
    active_end = max([datetime.fromisoformat(r["finished_at"]).timestamp() for r in submissions.values() if r["finished_at"]] or [time.time()])
    utilization = {}
    for ev in events:
        if ev["event"] != "ASSIGNED" or not ev["worker_id"]:
            continue
        sid = ev["submission_id"]
        finish = submissions[sid]["finished_at"]
        if not finish:
            continue
        start_t = datetime.fromisoformat(ev["time"]).timestamp()
        end_t = datetime.fromisoformat(finish).timestamp()
        utilization[ev["worker_id"]] = utilization.get(ev["worker_id"], 0) + max(0, end_t-start_t)
    util_rows = [{"run_id": run_id, "worker_id": wid, "busy_s": round(utilization.get(wid, 0),3),
                  "online_s": round(active_end-active_start,3),
                  "utilization_percent": round(100*utilization.get(wid,0)/(active_end-active_start),2) if active_end>active_start else None}
                 for wid in workers]
    write_csv(folder / "worker_utilization.csv", util_rows,
              ["run_id","worker_id","busy_s","online_s","utilization_percent"])
    starts = [r["request_at"] for r in requests_rows]
    ends = [datetime.fromisoformat(r["finished_at"]).timestamp() for r in submissions.values() if r["finished_at"]]
    duration = max(ends or [time.time()]) - min(starts or [time.time()])
    summary = {"run_id": run_id, "kind": kind, "ended_at": now(), "requests": len(requests_rows),
               "http_200": sum(r["http_status"] == 200 for r in requests_rows),
               "http_failed": sum(r["http_status"] != 200 for r in requests_rows),
               "unique_submission_ids": len(accepted), "finished": len(finished), "failed": len(failed),
               "unfinished_at_observation_end": len(accepted)-len(finished)-len(failed),
               "http_ms": summary_stats(http_values), "verdict_ms": summary_stats(verdict_values),
               "queue_wait_ms": summary_stats(waits), "queue_wait_attempts": len(waits),
               "duration_s": round(duration, 3), "completion_throughput_per_s": round(len(finished)/duration, 4) if duration > 0 else None,
               "http_error_rate": round(sum(r["http_status"] != 200 for r in requests_rows)/len(requests_rows), 5),
               "peak_concurrent_submissions": peak_concurrency(submissions),
               "registered_workers": workers}
    summary["worker_utilization_percent"] = {r["worker_id"]: r["utilization_percent"] for r in util_rows}
    if kind == "accuracy":
        summary["accuracy_pass"] = sum(r["result"] == "PASS" for r in requests_rows)
    (folder / "summary.json").write_text(json.dumps(summary, indent=2, ensure_ascii=False), encoding="utf-8")
    (folder / "backend.log").write_text(safe_log(command("docker", "compose", "logs", "--no-color", "--since", config["started_at"], "backend")), encoding="utf-8")
    (folder / "worker.log").write_text(safe_log(command("docker", "compose", "logs", "--no-color", "--since", config["started_at"], "worker")), encoding="utf-8")
    conn.close()
    print(json.dumps({"folder": str(folder), **summary}, ensure_ascii=False))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("kind", choices=["accuracy", "load", "scaling"])
    parser.add_argument("--vus", type=int, default=5)
    parser.add_argument("--count", type=int, default=10)
    parser.add_argument("--observe", type=int, default=180)
    args = parser.parse_args()
    run(args.kind, args.vus, args.count, args.observe)
