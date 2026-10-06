"""Chạy một tiến trình với giới hạn tài nguyên (tương đương ``envexec`` của go-judge).

Trên Linux/POSIX, việc chạy được giao cho ``launcher.c`` (biên dịch một lần khi
khởi động, giống ``runner`` của go-sandbox):

* tiến trình con nằm trong process group riêng, ``PR_SET_PDEATHSIG`` để chết
  theo launcher; khi quá giờ launcher ``kill(-pgid)`` cả cây tiến trình;
* bộ nhớ giới hạn theo **RSS thực dùng** như ``memory.max`` cgroup của go-judge:
  launcher đọc ``/proc/<pid>/statm`` mỗi 5 ms và diệt tiến trình khi vượt. Không đặt
  ``RLIMIT_AS`` mặc định vì glibc lấy ``RLIMIT_STACK`` làm stack cho mỗi luồng mới,
  nên chương trình tạo luồng sẽ bị abort (go-judge cũng chỉ đặt AS khi được yêu cầu);
* giới hạn bằng ``setrlimit``: ``RLIMIT_STACK``, ``RLIMIT_FSIZE`` (giới hạn output vì
  stdout ghi ra file tạm), ``RLIMIT_NOFILE``, ``RLIMIT_CPU`` (dự phòng),
  ``RLIMIT_CORE = 0``; ``RLIMIT_AS`` chỉ khi ``address_space_bytes`` > 0;
* vòng "waiter" mỗi 5 ms (giống ``worker/waiter.go``) kiểm tra thời gian thực và
  thời gian CPU;
* CPU time và RSS đỉnh lấy từ ``wait4`` của chính launcher, nên không bị lẫn
  RSS của tiến trình Python.

Trên Windows chỉ có giới hạn thời gian thực, bộ nhớ không được đo.

Lưu ý: rlimit không cô lập file system / mạng / số tiến trình như cgroup +
namespace + seccomp của go-judge; phần đó được bù bằng quét tĩnh (``scanner``)
và ``RLIMIT_NOFILE`` (xem ``judge``).
"""

from __future__ import annotations

import enum
import errno
import hashlib
import os
import signal
import subprocess
import tempfile
import threading
from dataclasses import dataclass, field

IS_POSIX = os.name == "posix"
MiB = 1024 * 1024
_LAUNCHER_SOURCE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "launcher.c")


class Status(enum.Enum):
    """Trạng thái chạy, cùng ngữ nghĩa với ``envexec.Status`` của go-judge."""

    ACCEPTED = "Accepted"  # thoát mã 0, trong giới hạn
    MEMORY_LIMIT_EXCEEDED = "Memory Limit Exceeded"
    TIME_LIMIT_EXCEEDED = "Time Limit Exceeded"
    OUTPUT_LIMIT_EXCEEDED = "Output Limit Exceeded"
    NONZERO_EXIT_STATUS = "Nonzero Exit Status"
    SIGNALLED = "Signalled"
    INTERNAL_ERROR = "Internal Error"


@dataclass
class Limits:
    cpu_ms: int = 1000
    clock_ms: int = 0  # 0 = 3 x cpu_ms + 1s (chờ I/O, máy bận)
    memory_bytes: int = 256 * MiB  # giới hạn RSS; 0 = không giới hạn
    address_space_bytes: int = 0  # RLIMIT_AS, 0 = không đặt (như go-judge mặc định)
    stack_bytes: int = 0  # 0 = bằng memory_bytes
    output_bytes: int = 64 * MiB
    open_files: int = 64

    @property
    def effective_clock_ms(self) -> int:
        return self.clock_ms or self.cpu_ms * 3 + 1000


@dataclass
class Cmd:
    args: list[str]
    cwd: str
    stdin: bytes = b""
    limits: Limits = field(default_factory=Limits)
    env: dict[str, str] | None = None
    stderr_max: int = 64 * 1024  # chỉ giữ lại tối đa bấy nhiêu byte stderr


@dataclass
class Result:
    status: Status
    exit_status: int = 0
    signal: int = 0
    time_ms: int = 0  # thời gian CPU (user + sys)
    run_time_ms: int = 0  # thời gian thực
    memory_bytes: int = 0  # RSS đỉnh
    stdout: bytes = b""
    stderr: bytes = b""
    error: str = ""

    @property
    def signal_name(self) -> str:
        if not self.signal:
            return ""
        try:
            return signal.Signals(self.signal).name
        except ValueError:
            return f"signal {self.signal}"

    def describe(self) -> str:
        """Mô tả ngắn, ví dụ ``Signalled (SIGFPE)`` hoặc ``Nonzero Exit Status (3)``."""
        if self.status is Status.SIGNALLED:
            return f"{self.status.value} ({self.signal_name})"
        if self.status is Status.NONZERO_EXIT_STATUS:
            return f"{self.status.value} ({self.exit_status})"
        if self.error:
            return f"{self.status.value}: {self.error}"
        return self.status.value


class SandboxError(RuntimeError):
    pass


# ----------------------------------------------------------------- launcher
_launcher_path: str | None = None
_launcher_lock = threading.Lock()


def ensure_launcher(compiler: str = "g++", cache_dir: str | None = None) -> str:
    """Biên dịch ``launcher.c`` (một lần, có cache theo hash mã nguồn) và trả về đường dẫn."""
    global _launcher_path
    with _launcher_lock:
        if _launcher_path and os.path.exists(_launcher_path):
            return _launcher_path
        with open(_LAUNCHER_SOURCE, "rb") as f:
            source = f.read()
        digest = hashlib.sha256(source + compiler.encode()).hexdigest()[:12]
        cache_dir = cache_dir or os.path.join(tempfile.gettempdir(), f"judgement-{os.getuid()}")
        os.makedirs(cache_dir, mode=0o700, exist_ok=True)
        target = os.path.join(cache_dir, f"launcher-{digest}")
        if not os.path.exists(target):
            tmp = f"{target}.{os.getpid()}.tmp"
            # -x c++: biên dịch được bằng chính g++ dùng để chấm, không cần gcc riêng.
            cmd = [compiler, "-x", "c++", "-O2", "-o", tmp, _LAUNCHER_SOURCE]
            proc = subprocess.run(cmd, capture_output=True, text=True)
            if proc.returncode != 0:
                raise SandboxError(f"không biên dịch được launcher: {proc.stderr.strip()}")
            os.replace(tmp, target)  # nguyên tử: nhiều Worker khởi động cùng lúc vẫn an toàn
        _launcher_path = target
        return target


# Các process group launcher đang chạy, để dọn khi Worker bị tắt (Ctrl+C) giữa chừng.
_active_groups: set[int] = set()
_active_lock = threading.Lock()


def kill_all() -> None:
    """Hủy mọi lệnh đang chạy: SIGTERM để launcher diệt cả cây tiến trình con rồi thoát."""
    with _active_lock:
        groups = list(_active_groups)
    for pgid in groups:
        try:
            os.killpg(pgid, signal.SIGTERM)
        except (ProcessLookupError, PermissionError):
            pass


def _killpg(pgid: int) -> None:
    try:
        os.killpg(pgid, signal.SIGKILL)
    except (ProcessLookupError, PermissionError):
        pass


def _read_capped(f, limit: int) -> bytes:
    f.seek(0)
    return f.read(limit)


def run(cmd: Cmd) -> Result:
    """Chạy ``cmd`` đến khi kết thúc hoặc bị giết, trả về ``Result``."""
    if not IS_POSIX:
        return _run_fallback(cmd)

    launcher = ensure_launcher()
    limits = cmd.limits
    clock_ms = limits.effective_clock_ms
    stack = limits.stack_bytes or limits.memory_bytes
    if limits.address_space_bytes:
        stack = min(stack, limits.address_space_bytes)

    rfd, wfd = os.pipe()
    with (
        os.fdopen(rfd, "rb") as result_pipe,
        tempfile.TemporaryFile(dir=cmd.cwd) as fin,
        tempfile.TemporaryFile(dir=cmd.cwd) as fout,
        tempfile.TemporaryFile(dir=cmd.cwd) as ferr,
    ):
        fin.write(cmd.stdin)
        fin.seek(0)
        args = [
            launcher, str(wfd), str(limits.cpu_ms), str(clock_ms), str(limits.memory_bytes),
            str(limits.address_space_bytes), str(stack),
            str(limits.output_bytes), str(limits.open_files), "--", *cmd.args,
        ]
        try:
            proc = subprocess.Popen(
                args,
                cwd=cmd.cwd,
                stdin=fin,
                stdout=fout,
                stderr=ferr,
                env=cmd.env if cmd.env is not None else _default_env(),
                start_new_session=True,
                pass_fds=(wfd,),
            )
        except OSError as e:
            os.close(wfd)
            return Result(Status.INTERNAL_ERROR, error=f"không khởi chạy được launcher: {e}")
        os.close(wfd)

        with _active_lock:
            _active_groups.add(proc.pid)
        try:
            proc.wait(timeout=clock_ms / 1000 + 5)  # launcher tự giới hạn, đây chỉ là dự phòng
        except subprocess.TimeoutExpired:
            _killpg(proc.pid)
            proc.wait()
        finally:
            with _active_lock:
                _active_groups.discard(proc.pid)

        line = result_pipe.read().decode().split()
        if proc.returncode != 0 or len(line) != 8:
            stderr = _read_capped(ferr, 4096).decode(errors="replace").strip()
            return Result(Status.INTERNAL_ERROR, error=f"launcher lỗi (mã {proc.returncode}): {stderr}")
        signaled, exit_code, sig, cpu_us, wall_us, maxrss_kb, killed, exec_errno = map(int, line)

        result = Result(
            status=Status.ACCEPTED,
            exit_status=exit_code,
            signal=sig,
            time_ms=round(cpu_us / 1000),
            run_time_ms=round(wall_us / 1000),
            memory_bytes=maxrss_kb * 1024,  # Linux: ru_maxrss tính bằng KiB
            stdout=_read_capped(fout, limits.output_bytes),
            stderr=_read_capped(ferr, cmd.stderr_max),
        )

    if exec_errno:
        if exec_errno in (errno.ENOMEM, errno.E2BIG):
            # Nạp ELF vượt RLIMIT_AS (chỉ khi đặt address_space_bytes) -> exec thất bại.
            result.status = Status.MEMORY_LIMIT_EXCEEDED
            result.error = os.strerror(exec_errno)
        else:
            result.status = Status.INTERNAL_ERROR
            result.error = f"exec {cmd.args[0]}: {os.strerror(exec_errno)}"
        return result

    if signaled:
        result.status = Status.SIGNALLED
        if sig == signal.SIGXCPU:
            result.status = Status.TIME_LIMIT_EXCEEDED
        elif sig == signal.SIGXFSZ:
            result.status = Status.OUTPUT_LIMIT_EXCEEDED
    elif exit_code != 0:
        result.status = Status.NONZERO_EXIT_STATUS

    # Giống envexec/run_single.go: kiểm tra lại theo số đo thực tế, MLE ưu tiên sau cùng.
    if killed == 1 or result.time_ms > limits.cpu_ms:
        result.status = Status.TIME_LIMIT_EXCEEDED
    if killed == 2 or (limits.memory_bytes and result.memory_bytes > limits.memory_bytes):
        result.status = Status.MEMORY_LIMIT_EXCEEDED
    return result


def _run_fallback(cmd: Cmd) -> Result:
    """Windows: chỉ có giới hạn thời gian thực, không đo được CPU và bộ nhớ."""
    import time

    start = time.monotonic()
    try:
        proc = subprocess.run(
            cmd.args,
            cwd=cmd.cwd,
            input=cmd.stdin,
            capture_output=True,
            env=cmd.env,
            timeout=cmd.limits.cpu_ms / 1000,
        )
    except subprocess.TimeoutExpired as e:
        return Result(
            Status.TIME_LIMIT_EXCEEDED,
            time_ms=cmd.limits.cpu_ms,
            run_time_ms=round((time.monotonic() - start) * 1000),
            stdout=e.stdout or b"",
            stderr=(e.stderr or b"")[: cmd.stderr_max],
        )
    except OSError as e:
        return Result(Status.INTERNAL_ERROR, error=f"không khởi chạy được {cmd.args[0]}: {e}")
    elapsed = round((time.monotonic() - start) * 1000)
    result = Result(
        Status.ACCEPTED,
        exit_status=proc.returncode,
        time_ms=elapsed,
        run_time_ms=elapsed,
        stdout=proc.stdout[: cmd.limits.output_bytes],
        stderr=proc.stderr[: cmd.stderr_max],
    )
    if len(proc.stdout) > cmd.limits.output_bytes:
        result.status = Status.OUTPUT_LIMIT_EXCEEDED
    elif proc.returncode != 0:
        result.status = Status.NONZERO_EXIT_STATUS
    return result


def _default_env() -> dict[str, str]:
    return {"PATH": os.environ.get("PATH", "/usr/bin:/bin"), "LANG": "C.UTF-8", "LC_ALL": "C.UTF-8"}
