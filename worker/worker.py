"""
TCP Judge Worker – kết nối Master (port 9000), nhận task, chấm qua go-judge.

Protocol (MasterProtocol):
  Header 6 bytes: [0xAA][opcode][uint32_big_endian_length]
  Body: JSON UTF-8
"""

import json
import logging
import os
import socket
import struct
import threading
import time
import uuid
from typing import Optional

import requests

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("worker")

MAGIC = 0xAA
OP_HEARTBEAT       = 0x01
OP_WORKER_REGISTER = 0x02
OP_TASK_ASSIGN     = 0x03
OP_TASK_STATUS     = 0x04
OP_TASK_RESULT     = 0x05

LANGUAGE_COMPILE = {
    "cpp17": (["g++", "-std=c++17", "-O2", "-o", "a", "a.cpp"], "a.cpp"),
    "cpp14": (["g++", "-std=c++14", "-O2", "-o", "a", "a.cpp"], "a.cpp"),
    "cpp11": (["g++", "-std=c++11", "-O2", "-o", "a", "a.cpp"], "a.cpp"),
    "cpp":   (["g++", "-std=c++17", "-O2", "-o", "a", "a.cpp"], "a.cpp"),
    "c":     (["gcc",  "-O2",        "-o", "a", "a.c"],          "a.c"),
}


class Worker:
    def __init__(self, master_host: str, master_port: int, go_judge_url: str, worker_id: str):
        self.master_host = master_host
        self.master_port = master_port
        self.go_judge_url = go_judge_url.rstrip("/")
        self.worker_id = worker_id
        self._sock: Optional[socket.socket] = None
        self._write_lock = threading.Lock()
        self._busy = False
        self._completed = 0

    # ------------------------------------------------------------------ send/recv

    def _send(self, opcode: int, payload: dict) -> None:
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        frame = bytes([MAGIC, opcode]) + struct.pack(">I", len(data)) + data
        with self._write_lock:
            self._sock.sendall(frame)

    def _recv_exact(self, n: int) -> bytes:
        buf = bytearray()
        while len(buf) < n:
            chunk = self._sock.recv(n - len(buf))
            if not chunk:
                raise ConnectionError("Connection closed by master")
            buf.extend(chunk)
        return bytes(buf)

    def _recv_message(self):
        header = self._recv_exact(6)
        if header[0] != MAGIC:
            raise ValueError(f"Bad magic byte: 0x{header[0]:02X}")
        opcode = header[1]
        length = struct.unpack(">I", header[2:6])[0]
        body = self._recv_exact(length)
        return opcode, json.loads(body.decode("utf-8"))

    # ------------------------------------------------------------------ lifecycle

    def run(self) -> None:
        while True:
            try:
                log.info("Connecting to master %s:%d ...", self.master_host, self.master_port)
                self._sock = socket.create_connection((self.master_host, self.master_port), timeout=10)
                self._sock.settimeout(None)
                log.info("Connected")
                self._register()
                self._message_loop()
            except Exception as exc:
                log.error("Connection error: %s – reconnecting in 5s", exc)
                if self._sock:
                    try:
                        self._sock.close()
                    except Exception:
                        pass
                time.sleep(5)

    def _register(self) -> None:
        self._send(OP_WORKER_REGISTER, {
            "workerId": self.worker_id,
            "hostname": socket.gethostname(),
            "compiler": "g++ 13",
            "sandbox":  "go-judge",
            "version":  "1.0.0",
        })
        log.info("REGISTER sent as %s", self.worker_id)

    def _message_loop(self) -> None:
        while True:
            opcode, payload = self._recv_message()
            if opcode == OP_HEARTBEAT:
                self._send(OP_HEARTBEAT, {
                    "type":      "PONG",
                    "ts":        payload.get("ts", 0),
                    "busy":      self._busy,
                    "completed": self._completed,
                })
            elif opcode == OP_WORKER_REGISTER:
                accepted = payload.get("accepted", False)
                log.info("Registration %s: %s", "ACCEPTED" if accepted else "REJECTED", payload)
            elif opcode == OP_TASK_ASSIGN:
                threading.Thread(target=self._handle_task, args=(payload,), daemon=True).start()
            else:
                log.warning("Unknown opcode 0x%02X", opcode)

    # ------------------------------------------------------------------ judging

    def _handle_task(self, task: dict) -> None:
        self._busy = True
        sid        = task["submissionId"]
        source     = task["sourceCode"]
        language   = task.get("language", "cpp17").lower()
        time_ms    = task.get("timeLimitMs", 1000)
        mem_mb     = task.get("memoryLimitMb", 256)
        tests      = task.get("tests", [])
        token      = task.get("attemptToken", "")
        stop_first = task.get("stopOnFirstFailure", False)

        log.info("Task #%d  lang=%s  tests=%d", sid, language, len(tests))
        file_id = None
        try:
            self._send(OP_TASK_STATUS, {"submissionId": sid, "status": "COMPILING"})
            ok, file_id, compile_log = self._compile(source, language)

            if not ok:
                self._send(OP_TASK_RESULT, {
                    "submissionId":  sid,
                    "verdict":       "CE",
                    "score":         0,
                    "timeMs":        0,
                    "memoryKb":      0,
                    "passed":        0,
                    "total":         len(tests),
                    "tests":         [],
                    "compileLog":    compile_log,
                    "securityMessage": "",
                    "attemptToken":  token,
                })
                return

            self._send(OP_TASK_STATUS, {"submissionId": sid, "status": "TESTING"})

            test_results = []
            passed = 0
            peak_time_ms = 0
            peak_mem_kb  = 0
            overall      = "AC"

            for tc in tests:
                r = self._run_test(file_id, tc["input"], tc["output"], time_ms, mem_mb)
                verdict_tc = r["verdict"]
                test_results.append({
                    "index":    tc["index"],
                    "status":   verdict_tc,
                    "timeMs":   r["timeMs"],
                    "memoryKb": r["memoryKb"],
                    "output":   r.get("stdout", "")[:512],
                    "stderr":   r.get("stderr",  "")[:256],
                    "exitCode": r.get("exitCode"),
                    "signal":   r.get("signal"),
                    "detail":   r.get("detail"),
                })
                peak_time_ms = max(peak_time_ms, r["timeMs"])
                peak_mem_kb  = max(peak_mem_kb,  r["memoryKb"])
                if verdict_tc == "AC":
                    passed += 1
                else:
                    if overall == "AC":
                        overall = verdict_tc
                    if stop_first:
                        # Mark remaining as SKIPPED
                        remaining_idx = tests.index(tc) + 1
                        for skipped_tc in tests[remaining_idx:]:
                            test_results.append({
                                "index":    skipped_tc["index"],
                                "status":   "SKIPPED",
                                "timeMs":   0,
                                "memoryKb": 0,
                                "output":   "",
                                "stderr":   "",
                                "exitCode": None,
                                "signal":   None,
                                "detail":   None,
                            })
                        break

            score = round(100 * passed / len(tests)) if tests else 0
            self._send(OP_TASK_RESULT, {
                "submissionId":  sid,
                "verdict":       overall,
                "score":         score,
                "timeMs":        peak_time_ms,
                "memoryKb":      peak_mem_kb,
                "passed":        passed,
                "total":         len(tests),
                "tests":         test_results,
                "compileLog":    compile_log,
                "securityMessage": "",
                "attemptToken":  token,
            })
            log.info("Task #%d done: %s %d/%d", sid, overall, passed, len(tests))

        except Exception as exc:
            log.exception("Error handling task #%d", sid)
            self._send(OP_TASK_RESULT, {
                "submissionId":  sid,
                "verdict":       "RTE",
                "score":         0,
                "timeMs":        0,
                "memoryKb":      0,
                "passed":        0,
                "total":         len(tests),
                "tests":         [],
                "compileLog":    "",
                "securityMessage": str(exc),
                "attemptToken":  token,
            })
        finally:
            if file_id:
                try:
                    requests.delete(f"{self.go_judge_url}/file/{file_id}", timeout=5)
                except Exception:
                    pass
            self._busy = False
            self._completed += 1

    # ------------------------------------------------------------------ go-judge helpers

    def _compile(self, source: str, language: str):
        args, filename = LANGUAGE_COMPILE.get(language, LANGUAGE_COMPILE["cpp17"])
        body = {
            "cmd": [{
                "args": args,
                "env": ["PATH=/usr/local/bin:/usr/bin:/bin"],
                "files": [
                    {"content": ""},
                    {"name": "stdout", "max": 65536},
                    {"name": "stderr", "max": 65536},
                ],
                "cpuLimit":    30_000_000_000,
                "realCpuLimit": 60_000_000_000,
                "memoryLimit": 536_870_912,
                "procLimit":   50,
                "copyIn": {filename: {"content": source}},
                "copyOutCached": ["a"],
            }]
        }
        resp = requests.post(f"{self.go_judge_url}/run", json=body, timeout=60)
        resp.raise_for_status()
        result = resp.json()[0]

        status  = result.get("status", "")
        stderr  = result.get("files", {}).get("stderr", "")
        file_id = result.get("fileIds", {}).get("a", "")

        return status == "Accepted", file_id, stderr

    def _run_test(self, file_id: str, input_data: str, expected: str, time_ms: int, mem_mb: int) -> dict:
        body = {
            "cmd": [{
                "args": ["/w/a"],
                "env": ["PATH=/usr/local/bin:/usr/bin:/bin", "ONLINE_JUDGE=1"],
                "files": [
                    {"content": input_data},
                    {"name": "stdout", "max": 1_048_576},
                    {"name": "stderr", "max": 65_536},
                ],
                "cpuLimit":    time_ms * 1_000_000,
                "realCpuLimit": time_ms * 3_000_000,
                "memoryLimit": mem_mb * 1_048_576,
                "stackLimit":  mem_mb * 1_048_576,
                "procLimit":   1,
                "copyIn": {"a": {"fileId": file_id}},
            }]
        }
        resp = requests.post(f"{self.go_judge_url}/run", json=body, timeout=60)
        resp.raise_for_status()
        result = resp.json()[0]

        status    = result.get("status", "")
        stdout    = result.get("files", {}).get("stdout", "")
        stderr    = result.get("files", {}).get("stderr", "")
        time_ns   = result.get("time", 0)
        memory_b  = result.get("memory", 0)
        exit_code = result.get("exitStatus")
        signal    = result.get("signal")

        r_time_ms = time_ns  // 1_000_000
        r_mem_kb  = memory_b // 1_024

        status_map = {
            "Accepted":           None,
            "TimeLimitExceeded":  "TLE",
            "MemoryLimitExceeded":"MLE",
            "RuntimeError":       "RTE",
            "OutputLimitExceeded":"WA",
            "FileError":          "RTE",
            "NonzeroExitStatus":  "RTE",
            "Signalled":          "RTE",
            "InternalError":      "RTE",
        }

        if status in status_map and status_map[status] is not None:
            verdict = status_map[status]
        elif status == "Accepted":
            verdict = self._check_lines(stdout, expected)
        else:
            verdict = "RTE"

        return {
            "verdict":  verdict,
            "timeMs":   r_time_ms,
            "memoryKb": r_mem_kb,
            "stdout":   stdout,
            "stderr":   stderr,
            "exitCode": exit_code,
            "signal":   str(signal) if signal else None,
            "detail":   status if status not in ("Accepted",) else None,
        }

    @staticmethod
    def _check_lines(actual: str, expected: str) -> str:
        a = [l.rstrip() for l in actual.rstrip("\n").split("\n")]
        e = [l.rstrip() for l in expected.rstrip("\n").split("\n")]
        return "AC" if a == e else "WA"


if __name__ == "__main__":
    wid = os.getenv("WORKER_ID", "").strip() or socket.gethostname()
    Worker(
        master_host  = os.getenv("MASTER_HOST",  "backend"),
        master_port  = int(os.getenv("MASTER_PORT", "9000")),
        go_judge_url = os.getenv("GO_JUDGE_URL", "http://go-judge:5050"),
        worker_id    = wid,
    ).run()
