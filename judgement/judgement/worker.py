"""Judge Worker: kết nối TCP tới Master (:9000), nhận bài, chấm và gửi kết quả.

Luồng chính đọc bản tin từ Master (để PING luôn được trả lời kể cả khi đang
chấm), còn mỗi bài chấm chạy trên một luồng riêng. Mọi lần ghi socket đi qua
``_send_lock`` để các frame từ hai luồng không đan xen nhau.

Bản tin (payload JSON, xem README):

* Worker -> Master: ``OP_WORKER_REGISTER`` ngay khi kết nối, ``OP_HEARTBEAT``
  (PONG) trả lời mỗi PING, ``OP_TASK_STATUS`` khi biên dịch / chạy từng test,
  ``OP_TASK_RESULT`` khi xong.
* Master -> Worker: ``OP_HEARTBEAT`` (PING), ``OP_TASK_ASSIGN``.

Mất kết nối (FIN/RST, hoặc Master im lặng quá ``master_timeout``) thì bài đang
chấm bị hủy (Master sẽ Failover cho Worker khác) và Worker tự kết nối lại.
"""

from __future__ import annotations

import logging
import os
import platform
import socket
import sys
import threading
import time
from typing import Any

from . import __version__, protocol, sandbox
from .judge import Cancelled, Judge, JudgeError, Task, compiler_version
from .protocol import (
    OP_HEARTBEAT,
    OP_TASK_ASSIGN,
    OP_TASK_RESULT,
    OP_TASK_STATUS,
    OP_WORKER_REGISTER,
    OPCODE_NAMES,
)

log = logging.getLogger("judgement.worker")


class Worker:
    def __init__(
        self,
        worker_id: str,
        master_host: str = "127.0.0.1",
        master_port: int = 9000,
        judge: Judge | None = None,
        master_timeout: float = 20.0,
        reconnect_max: float = 10.0,
    ) -> None:
        self.worker_id = worker_id
        self.master = (master_host, master_port)
        self.judge = judge or Judge()
        self.master_timeout = master_timeout
        self.reconnect_max = reconnect_max

        self._sock: socket.socket | None = None
        self._send_lock = threading.Lock()
        self._state_lock = threading.Lock()
        self._current: Any = None  # submissionId đang chấm
        self._cancel = threading.Event()
        self._thread: threading.Thread | None = None
        self._stop = threading.Event()
        self.completed = 0

    # ------------------------------------------------------------ vòng đời
    def run_forever(self) -> int:
        delay = 1.0
        log.info("%s khởi động, Master %s:%d", self.worker_id, *self.master)
        try:
            while not self._stop.is_set():
                try:
                    sock = socket.create_connection(self.master, timeout=5)
                except OSError as e:
                    log.warning("Không kết nối được Master (%s), thử lại sau %.0fs", e, delay)
                    self._stop.wait(delay)
                    delay = min(delay * 2, self.reconnect_max)
                    continue
                delay = 1.0
                self.serve(sock)
        except KeyboardInterrupt:
            log.info("Nhận Ctrl+C, dừng Worker")
        finally:
            self.stop()
        return 0

    def stop(self) -> None:
        self._stop.set()
        self._cancel.set()
        sandbox.kill_all()
        self._close()

    def serve(self, sock: socket.socket) -> None:
        """Phục vụ một kết nối tới khi nó đóng."""
        sock.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_KEEPALIVE, 1)
        sock.settimeout(self.master_timeout)
        self._sock = sock
        peer = "%s:%d" % sock.getpeername()[:2]
        log.info("Đã kết nối Master %s", peer)
        try:
            self._send(sock, OP_WORKER_REGISTER, self._register_payload())
            while not self._stop.is_set():
                opcode, payload = protocol.recv_message(sock)
                self._dispatch(sock, opcode, payload or {})
        except protocol.ConnectionClosed:
            log.warning("Master %s đóng kết nối", peer)
        except TimeoutError:
            log.warning("Không nhận được gì từ Master trong %.0fs, coi như mất kết nối", self.master_timeout)
        except protocol.ProtocolError as e:
            log.error("Bản tin không hợp lệ từ Master: %s", e)
        except OSError as e:
            if not self._stop.is_set():
                log.warning("Lỗi socket: %s", e)
        finally:
            self._close()
            with self._state_lock:
                if self._current is not None:
                    log.warning("Hủy bài #%s đang chấm (Master sẽ giao lại)", self._current)
                    self._cancel.set()
                    sandbox.kill_all()  # không chạy nốt test hiện tại, giải phóng Worker ngay

    # ------------------------------------------------------------ xử lý bản tin
    def _dispatch(self, sock: socket.socket, opcode: int, payload: dict[str, Any]) -> None:
        log.debug("<- %s %s", OPCODE_NAMES[opcode], payload)
        if opcode == OP_HEARTBEAT:
            if payload.get("type", "PING") == "PING":
                with self._state_lock:
                    current = self._current
                self._send(sock, OP_HEARTBEAT, {
                    "type": "PONG",
                    "workerId": self.worker_id,
                    "ts": payload.get("ts"),
                    "busy": current is not None,
                    "currentTask": current,
                    "completed": self.completed,
                })
        elif opcode == OP_TASK_ASSIGN:
            self._accept_task(sock, payload)
        elif opcode == OP_WORKER_REGISTER:
            log.info("Master xác nhận đăng ký: %s", payload)
        else:
            log.warning("Bỏ qua opcode %s không dành cho Worker", OPCODE_NAMES[opcode])

    def _accept_task(self, sock: socket.socket, payload: dict[str, Any]) -> None:
        sid = payload.get("submissionId")
        with self._state_lock:
            previous = self._thread if self._cancel.is_set() else None
        if previous is not None:
            previous.join(timeout=5)  # bài cũ đã bị hủy (mất kết nối), chờ nó dọn xong
        with self._state_lock:
            busy = self._current
            if busy is None:
                self._current = sid
                self._cancel = threading.Event()
        if busy is not None:
            log.warning("Từ chối bài #%s: đang chấm #%s", sid, busy)
            self._send(sock, OP_TASK_RESULT, self._error_payload(payload, "REJECTED", f"Worker đang chấm bài #{busy}"))
            return
        log.info("Nhận bài #%s (lần %s)", sid, payload.get("attempt", 1))
        self._thread = threading.Thread(
            target=self._run_task, args=(sock, payload, self._cancel), name=f"judge-{sid}", daemon=True
        )
        self._thread.start()

    def _run_task(self, sock: socket.socket, payload: dict[str, Any], cancel: threading.Event) -> None:
        sid = payload.get("submissionId")
        attempt = payload.get("attempt", 1)
        header = {"submissionId": sid, "attempt": attempt, "workerId": self.worker_id}
        try:
            task = Task.from_payload(payload)

            def on_status(msg: dict[str, Any]) -> None:
                if cancel.is_set():
                    return
                self._send(sock, OP_TASK_STATUS, {**header, **msg})

            result = self.judge.judge(task, on_status, cancel)
            if cancel.is_set():
                raise Cancelled()
            log.info("Bài #%s: %s (%d/100), %d ms", sid, result.verdict, result.score, result.judge_time_ms)
            self._send(sock, OP_TASK_RESULT, {**header, **result.to_json()})
            self.completed += 1
        except Cancelled:
            log.info("Đã hủy bài #%s", sid)
        except JudgeError as e:
            if cancel.is_set():  # tiến trình bị giết do hủy bài, không phải lỗi máy chấm
                log.info("Đã hủy bài #%s", sid)
            else:
                log.error("Không chấm được bài #%s: %s", sid, e)
                self._send(sock, OP_TASK_RESULT, self._error_payload(payload, "ERROR", str(e)))
        except ValueError as e:
            log.error("Không chấm được bài #%s: %s", sid, e)
            self._send(sock, OP_TASK_RESULT, self._error_payload(payload, "ERROR", str(e)))
        except Exception as e:  # lỗi ngoài dự kiến: báo Master thay vì để Worker treo bài
            log.exception("Lỗi nội bộ khi chấm bài #%s", sid)
            self._send(sock, OP_TASK_RESULT, self._error_payload(payload, "ERROR", f"{type(e).__name__}: {e}"))
        finally:
            with self._state_lock:
                self._current = None

    # ------------------------------------------------------------ tiện ích
    def _send(self, sock: socket.socket, opcode: int, payload: dict[str, Any]) -> bool:
        """Gửi một frame; bỏ qua nếu ``sock`` không còn là kết nối hiện tại."""
        with self._send_lock:
            if sock is not self._sock:
                return False
            try:
                protocol.send_message(sock, opcode, payload)
            except OSError as e:
                log.warning("Gửi %s thất bại: %s", OPCODE_NAMES[opcode], e)
                return False
        log.debug("-> %s %s", OPCODE_NAMES[opcode], payload)
        return True

    def _close(self) -> None:
        with self._send_lock:
            sock, self._sock = self._sock, None
        if sock is not None:
            try:
                sock.close()
            except OSError:
                pass

    def _error_payload(self, payload: dict[str, Any], status: str, message: str) -> dict[str, Any]:
        return {
            "submissionId": payload.get("submissionId"),
            "attempt": payload.get("attempt", 1),
            "workerId": self.worker_id,
            "status": status,
            "verdict": None,
            "error": message,
        }

    def _register_payload(self) -> dict[str, Any]:
        cfg = self.judge.config
        return {
            "workerId": self.worker_id,
            "hostname": socket.gethostname(),
            "pid": os.getpid(),
            "version": __version__,
            "platform": f"{platform.system()} {platform.release()}",
            "python": sys.version.split()[0],
            "languages": ["cpp17"],
            "compiler": compiler_version(cfg.compiler),
            "sandbox": "rlimit+static" if cfg.static else ("rlimit" if sandbox.IS_POSIX else "timeout-only"),
            "parallelism": 1,
            "startedAt": int(time.time() * 1000),
        }
