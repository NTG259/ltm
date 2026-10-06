"""Quy trình chấm một bài nộp C++: quét tĩnh -> biên dịch -> chạy từng test -> tổng hợp.

Giống cách dùng go-judge điển hình (một lệnh ``/run`` để biên dịch, rồi mỗi test
một lệnh ``/run`` với ``cpuLimit``/``memoryLimit``), nhưng chạy tại chỗ qua
``sandbox.run`` và quy đổi trạng thái về 7 nhãn của hệ thống:
``AC WA TLE MLE RTE CE SEC``.
"""

from __future__ import annotations

import functools
import logging
import os
import re
import shutil
import struct
import subprocess
import tempfile
import threading
import time
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any

from . import checker, sandbox, scanner
from .sandbox import MiB, Limits, Status

log = logging.getLogger(__name__)

SOURCE_NAME = "solution.cpp"
BINARY_NAME = "solution.exe" if os.name == "nt" else "solution"
SUPPORTED_LANGUAGES = {"cpp17", "c++17", "cpp", "c++"}


class JudgeError(Exception):
    """Lỗi phía máy chấm (không phải lỗi của thí sinh) – Master nên giao lại bài."""


class Cancelled(Exception):
    """Bài bị hủy giữa chừng (ví dụ mất kết nối tới Master)."""


@dataclass
class JudgeConfig:
    compiler: str = "g++"
    std: str = "c++17"
    static: bool | None = None  # None = tự phát hiện
    compile_cpu_ms: int = 10_000
    compile_clock_ms: int = 20_000
    compile_memory_mb: int = 1536
    compile_log_max: int = 16 * 1024
    output_limit_mb: int = 64
    output_preview_max: int = 4 * 1024  # số byte output gửi kèm mỗi test về Master
    stderr_preview_max: int = 2 * 1024
    work_root: str | None = None
    keep_files: bool = False


@dataclass
class TestCase:
    index: int
    input: str
    output: str


@dataclass
class Task:
    submission_id: Any
    source_code: str
    tests: list[TestCase]
    time_limit_ms: int = 1000
    memory_limit_mb: int = 256
    language: str = "cpp17"
    checker: str = "lines"
    stop_on_first_failure: bool = True
    attempt: int = 1

    @classmethod
    def from_payload(cls, p: dict[str, Any]) -> Task:
        """Đọc payload ``OP_TASK_ASSIGN`` (khóa camelCase như API của frontend)."""
        if "submissionId" not in p or "sourceCode" not in p:
            raise ValueError("payload thiếu submissionId hoặc sourceCode")
        raw_tests = p.get("tests") or []
        if not raw_tests:
            raise ValueError("đề bài không có test nào")
        tests = [
            TestCase(index=int(t.get("index", i + 1)), input=t.get("input", ""), output=t.get("output", t.get("expected", "")))
            for i, t in enumerate(raw_tests)
        ]
        return cls(
            submission_id=p["submissionId"],
            source_code=p["sourceCode"],
            tests=tests,
            time_limit_ms=int(p.get("timeLimitMs", 1000)),
            memory_limit_mb=int(p.get("memoryLimitMb", 256)),
            language=str(p.get("language", "cpp17")),
            checker=p.get("checker") or "lines",
            stop_on_first_failure=bool(p.get("stopOnFirstFailure", True)),
            attempt=int(p.get("attempt", 1)),
        )


@dataclass
class TestResult:
    index: int
    status: str  # AC WA TLE MLE RTE hoặc SKIPPED
    time_ms: int | None = None
    memory_kb: int | None = None
    output: str | None = None
    stderr: str | None = None
    exit_code: int | None = None
    signal: str | None = None
    detail: str | None = None

    def to_json(self) -> dict[str, Any]:
        d = {
            "index": self.index,
            "status": self.status,
            "timeMs": self.time_ms,
            "memoryKb": self.memory_kb,
            "output": self.output,
            "stderr": self.stderr,
            "exitCode": self.exit_code,
            "signal": self.signal,
            "detail": self.detail,
        }
        return {k: v for k, v in d.items() if v is not None}


@dataclass
class JudgeResult:
    submission_id: Any
    verdict: str
    score: int = 0
    time_ms: int = 0
    memory_kb: int = 0
    passed: int = 0
    total: int = 0
    tests: list[TestResult] = field(default_factory=list)
    compile_log: str | None = None
    security_message: str | None = None
    judge_time_ms: int = 0

    def to_json(self) -> dict[str, Any]:
        d = {
            "submissionId": self.submission_id,
            "status": "FINISHED",
            "verdict": self.verdict,
            "score": self.score,
            "timeMs": self.time_ms,
            "memoryKb": self.memory_kb,
            "passed": self.passed,
            "total": self.total,
            "tests": [t.to_json() for t in self.tests],
            "compileLog": self.compile_log,
            "securityMessage": self.security_message,
            "judgeTimeMs": self.judge_time_ms,
        }
        return {k: v for k, v in d.items() if v is not None}


StatusCallback = Callable[[dict[str, Any]], None]


def _preview(data: bytes, limit: int) -> str:
    text = data[:limit].decode("utf-8", errors="replace")
    return text + "\n…(đã cắt bớt)" if len(data) > limit else text


@functools.cache
def compiler_version(compiler: str = "g++") -> str | None:
    try:
        out = subprocess.run([compiler, "--version"], capture_output=True, text=True, timeout=10)
    except (OSError, subprocess.TimeoutExpired):
        return None
    return out.stdout.splitlines()[0] if out.returncode == 0 and out.stdout else None


@functools.cache
def static_link_supported(compiler: str = "g++") -> bool:
    """Thử link tĩnh một chương trình rỗng (cần libc.a / libstdc++.a)."""
    if os.name != "posix":
        return False
    with tempfile.TemporaryDirectory(prefix="judge-probe-") as d:
        src = os.path.join(d, "probe.cpp")
        with open(src, "w") as f:
            f.write("#include <iostream>\nint main(){std::cout<<1;}\n")
        try:
            r = subprocess.run([compiler, "-static", src, "-o", os.path.join(d, "probe")], capture_output=True, timeout=60)
        except (OSError, subprocess.TimeoutExpired):
            return False
        return r.returncode == 0


def static_memory_bytes(path: str) -> int:
    """Tổng ``p_memsz`` các segment ``PT_LOAD`` của file ELF (code + data + bss).

    Mảng toàn cục khổng lồ làm tiến trình chết ngay lúc nạp (SIGSEGV, RSS ~ 0)
    khi vượt ``RLIMIT_AS``; đo trước từ ELF để báo đúng ``MLE`` thay vì ``RTE``.
    """
    try:
        with open(path, "rb") as f:
            ident = f.read(64)
            if ident[:4] != b"\x7fELF":
                return 0
            is64, little = ident[4] == 2, ident[5] == 1
            e = "<" if little else ">"
            if is64:
                phoff, = struct.unpack_from(e + "Q", ident, 0x20)
                phentsize, phnum = struct.unpack_from(e + "HH", ident, 0x36)
            else:
                phoff, = struct.unpack_from(e + "I", ident, 0x1C)
                phentsize, phnum = struct.unpack_from(e + "HH", ident, 0x2A)
            f.seek(phoff)
            table = f.read(phentsize * phnum)
    except (OSError, struct.error):
        return 0
    total = 0
    for i in range(phnum):
        entry = table[i * phentsize : (i + 1) * phentsize]
        p_type, = struct.unpack_from(e + "I", entry, 0)
        if p_type != 1:  # PT_LOAD
            continue
        memsz, = struct.unpack_from(e + "Q", entry, 0x28) if is64 else struct.unpack_from(e + "I", entry, 0x14)
        total += memsz
    return total


class Judge:
    def __init__(self, config: JudgeConfig | None = None) -> None:
        self.config = config or JudgeConfig()
        if sandbox.IS_POSIX:
            try:
                sandbox.ensure_launcher(self.config.compiler)
            except (OSError, sandbox.SandboxError) as e:
                raise JudgeError(str(e)) from e
        if self.config.static is None:
            self.config.static = static_link_supported(self.config.compiler)
            if not self.config.static and os.name == "posix":
                log.warning("Không link tĩnh được: chương trình thí sinh vẫn mở được file (RLIMIT_NOFILE nới lỏng)")

    # ------------------------------------------------------------------ public
    def judge(
        self,
        task: Task,
        on_status: StatusCallback | None = None,
        cancel: threading.Event | None = None,
    ) -> JudgeResult:
        started = time.monotonic()
        notify = on_status or (lambda _msg: None)
        if task.language.lower() not in SUPPORTED_LANGUAGES:
            raise JudgeError(f"ngôn ngữ '{task.language}' không được hỗ trợ")
        compare = checker.get_checker(task.checker)

        result = self._judge(task, notify, cancel, compare)
        result.judge_time_ms = round((time.monotonic() - started) * 1000)
        return result

    # ----------------------------------------------------------------- private
    def _judge(self, task, notify, cancel, compare) -> JudgeResult:
        total = len(task.tests)
        skipped = [TestResult(t.index, "SKIPPED") for t in task.tests]

        violation = scanner.scan(task.source_code)
        if violation:
            return JudgeResult(task.submission_id, "SEC", total=total, tests=skipped, security_message=str(violation))

        safe_id = re.sub(r"[^\w.-]", "_", str(task.submission_id))[:40]
        workdir = tempfile.mkdtemp(prefix=f"sub-{safe_id}-", dir=self.config.work_root)
        try:
            notify({"status": "COMPILING"})
            ok, compile_log = self._compile(task, workdir)
            if not ok:
                return JudgeResult(task.submission_id, "CE", total=total, tests=skipped, compile_log=compile_log)

            binary = os.path.join(workdir, BINARY_NAME)
            limits = Limits(
                cpu_ms=task.time_limit_ms,
                memory_bytes=task.memory_limit_mb * MiB,
                output_bytes=self.config.output_limit_mb * MiB,
                # Binary tĩnh không cần mở thư viện .so -> chỉ để lại stdin/stdout/stderr.
                open_files=3 if self.config.static else 64,
            )
            static_mem = static_memory_bytes(binary)

            tests: list[TestResult] = []
            for pos, tc in enumerate(task.tests, start=1):
                if cancel is not None and cancel.is_set():
                    raise Cancelled(f"bài #{task.submission_id} bị hủy ở test {pos}/{total}")
                notify({"status": "TESTING", "progress": {"current": pos, "total": total}, "running": tc.index})
                if static_mem > limits.memory_bytes:
                    tr = TestResult(
                        tc.index, "MLE", time_ms=0, memory_kb=static_mem // 1024,
                        detail=f"Bộ nhớ tĩnh {static_mem // MiB} MB vượt giới hạn {task.memory_limit_mb} MB",
                    )
                else:
                    tr = self._run_test(binary, workdir, tc, limits, compare)
                tests.append(tr)
                notify({"status": "TESTING", "progress": {"current": pos, "total": total}, "test": tr.to_json()})
                if tr.status != "AC" and task.stop_on_first_failure:
                    tests.extend(skipped[pos:])
                    break
            return self._summarize(task, tests, compile_log or None)
        finally:
            if self.config.keep_files:
                log.info("Giữ thư mục chấm %s", workdir)
            else:
                shutil.rmtree(workdir, ignore_errors=True)

    def _compile(self, task: Task, workdir: str) -> tuple[bool, str]:
        cfg = self.config
        with open(os.path.join(workdir, SOURCE_NAME), "w", encoding="utf-8") as f:
            f.write(task.source_code)
        args = [
            cfg.compiler, f"-std={cfg.std}", "-O2", "-pipe", "-DONLINE_JUDGE",
            "-fdiagnostics-color=never", "-fmax-errors=20",
            *(["-static"] if cfg.static else []),
            SOURCE_NAME, "-o", BINARY_NAME,
        ]
        res = sandbox.run(sandbox.Cmd(
            args=args,
            cwd=workdir,
            limits=Limits(
                cpu_ms=cfg.compile_cpu_ms,
                clock_ms=cfg.compile_clock_ms,
                memory_bytes=cfg.compile_memory_mb * MiB,
                extra_memory_bytes=512 * MiB,
                output_bytes=256 * MiB,
                open_files=256,
            ),
            stderr_max=cfg.compile_log_max,
        ))
        text = (res.stderr + res.stdout).decode("utf-8", errors="replace").replace(workdir + os.sep, "")
        if res.status is Status.INTERNAL_ERROR:
            raise JudgeError(f"không chạy được trình biên dịch: {res.error}")
        if res.status is Status.ACCEPTED:
            return True, text.strip()
        if res.status is Status.TIME_LIMIT_EXCEEDED:
            text += f"\nBiên dịch vượt quá {cfg.compile_clock_ms // 1000} giây."
        elif res.status is Status.MEMORY_LIMIT_EXCEEDED:
            text += f"\nTrình biên dịch dùng quá {cfg.compile_memory_mb} MB bộ nhớ."
        elif res.status is Status.OUTPUT_LIMIT_EXCEEDED:
            text += "\nFile thực thi quá lớn."
        return False, text.strip() or res.describe()

    def _run_test(self, binary: str, workdir: str, tc: TestCase, limits: Limits, compare) -> TestResult:
        cfg = self.config
        res = sandbox.run(sandbox.Cmd(
            args=[binary],
            cwd=workdir,
            stdin=tc.input.encode("utf-8"),
            limits=limits,
            env={"PATH": "/usr/bin:/bin", "LANG": "C.UTF-8"} if os.name == "posix" else None,
            stderr_max=cfg.stderr_preview_max,
        ))
        if res.status is Status.INTERNAL_ERROR:
            raise JudgeError(res.error)

        tr = TestResult(
            index=tc.index,
            status="AC",
            time_ms=res.time_ms,
            memory_kb=res.memory_bytes // 1024,
            output=_preview(res.stdout, cfg.output_preview_max),
            stderr=_preview(res.stderr, cfg.stderr_preview_max) or None,
            exit_code=res.exit_status if res.status is Status.NONZERO_EXIT_STATUS else None,
            signal=res.signal_name or None,
            detail=res.describe(),
        )
        st = res.status
        if st is Status.ACCEPTED:
            tr.status = "AC" if compare(res.stdout, tc.output) else "WA"
            tr.detail = None if tr.status == "AC" else "Đầu ra không khớp đáp án"
        elif st is Status.TIME_LIMIT_EXCEEDED:
            tr.status = "TLE"
        elif st is Status.MEMORY_LIMIT_EXCEEDED or b"std::bad_alloc" in res.stderr:
            # Cấp phát vượt RLIMIT_AS -> new ném bad_alloc -> abort (SIGABRT), RSS chưa kịp tăng.
            if st is not Status.MEMORY_LIMIT_EXCEEDED:
                tr.detail = "std::bad_alloc – cấp phát vượt giới hạn bộ nhớ"
            tr.status = "MLE"
        elif st is Status.OUTPUT_LIMIT_EXCEEDED:
            tr.status = "WA"
            tr.detail = f"Output vượt {cfg.output_limit_mb} MB"
        else:  # NONZERO_EXIT_STATUS, SIGNALLED
            tr.status = "RTE"
        return tr

    @staticmethod
    def _summarize(task: Task, tests: list[TestResult], compile_log: str | None) -> JudgeResult:
        total = len(task.tests)
        passed = sum(t.status == "AC" for t in tests)
        failed = next((t for t in tests if t.status not in ("AC", "SKIPPED")), None)
        return JudgeResult(
            submission_id=task.submission_id,
            verdict=failed.status if failed else "AC",
            score=round(passed * 100 / total),
            time_ms=max((t.time_ms or 0 for t in tests), default=0),
            memory_kb=max((t.memory_kb or 0 for t in tests), default=0),
            passed=passed,
            total=total,
            tests=tests,
            compile_log=compile_log,  # cảnh báo của g++ (nếu có)
        )
