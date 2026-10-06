"""Kiểm thử tích hợp Worker với một Master giả qua TCP thật."""

import os
import shutil
import socket
import threading
import unittest

from judgement import protocol
from judgement.judge import Judge
from judgement.protocol import OP_HEARTBEAT, OP_TASK_ASSIGN, OP_TASK_RESULT, OP_TASK_STATUS, OP_WORKER_REGISTER
from judgement.worker import Worker

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HAS_GXX = shutil.which("g++") is not None and os.name == "posix"

TESTS = [{"input": "3 5", "output": "8"}, {"input": "-7 10", "output": "3"}]
AC = "#include <bits/stdc++.h>\nint main(){long long a,b;std::cin>>a>>b;std::cout<<a+b;}"
SLOW = "#include <bits/stdc++.h>\nint main(){volatile long long x=0; while(true) x++;}"


def assign(sid, source, **extra):
    return {"submissionId": sid, "sourceCode": source, "tests": TESTS, "timeLimitMs": 1000,
            "memoryLimitMb": 256, "attempt": 1, **extra}


@unittest.skipUnless(HAS_GXX, "cần g++ trên Linux")
class WorkerTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.judge = Judge()

    def setUp(self):
        self.server = socket.create_server(("127.0.0.1", 0))
        self.server.settimeout(10)
        port = self.server.getsockname()[1]
        self.worker = Worker("worker-test", "127.0.0.1", port, judge=self.judge, master_timeout=10)
        self.thread = threading.Thread(target=self.worker.run_forever, daemon=True)
        self.thread.start()
        self.conn = self.accept()

    def tearDown(self):
        self.worker.stop()
        self.thread.join(timeout=10)
        self.conn.close()
        self.server.close()

    def accept(self):
        conn, _ = self.server.accept()
        conn.settimeout(15)
        opcode, payload = protocol.recv_message(conn)
        self.assertEqual(opcode, OP_WORKER_REGISTER)
        self.assertEqual(payload["workerId"], "worker-test")
        self.assertIn("cpp17", payload["languages"])
        return conn

    def collect_until_result(self, conn):
        statuses = []
        while True:
            opcode, payload = protocol.recv_message(conn)
            if opcode == OP_TASK_RESULT:
                return statuses, payload
            if opcode == OP_TASK_STATUS:
                statuses.append(payload)

    def test_heartbeat(self):
        protocol.send_message(self.conn, OP_HEARTBEAT, {"type": "PING", "ts": 42})
        opcode, payload = protocol.recv_message(self.conn)
        self.assertEqual(opcode, OP_HEARTBEAT)
        self.assertEqual((payload["type"], payload["ts"], payload["busy"]), ("PONG", 42, False))

    def test_assign_and_result(self):
        protocol.send_message(self.conn, OP_TASK_ASSIGN, assign(1001, AC))
        statuses, result = self.collect_until_result(self.conn)
        self.assertEqual(statuses[0]["status"], "COMPILING")
        self.assertEqual(statuses[-1]["progress"], {"current": 2, "total": 2})
        self.assertTrue(all(s["submissionId"] == 1001 for s in statuses))
        self.assertEqual((result["submissionId"], result["verdict"], result["score"]), (1001, "AC", 100))
        self.assertEqual(result["workerId"], "worker-test")

    def test_ping_answered_while_judging_and_busy_rejected(self):
        protocol.send_message(self.conn, OP_TASK_ASSIGN, assign(1, SLOW))
        protocol.send_message(self.conn, OP_HEARTBEAT, {"type": "PING", "ts": 7})
        protocol.send_message(self.conn, OP_TASK_ASSIGN, assign(2, AC))
        pong = rejected = None
        while pong is None or rejected is None:
            opcode, payload = protocol.recv_message(self.conn)
            if opcode == OP_HEARTBEAT:
                pong = payload
            elif opcode == OP_TASK_RESULT and payload["submissionId"] == 2:
                rejected = payload
        self.assertTrue(pong["busy"])
        self.assertEqual(pong["currentTask"], 1)
        self.assertEqual(rejected["status"], "REJECTED")
        _, result = self.collect_until_result(self.conn)
        self.assertEqual((result["submissionId"], result["verdict"]), (1, "TLE"))

    def test_reconnect_after_master_drops(self):
        protocol.send_message(self.conn, OP_TASK_ASSIGN, assign(5, SLOW))
        self.conn.close()  # Master "chết" giữa lúc chấm
        self.conn = self.accept()  # Worker tự kết nối lại và đăng ký lại
        protocol.send_message(self.conn, OP_TASK_ASSIGN, assign(6, AC, attempt=2))
        _, result = self.collect_until_result(self.conn)
        self.assertEqual((result["submissionId"], result["verdict"], result["attempt"]), (6, "AC", 2))

    def test_bad_payload_reports_error(self):
        protocol.send_message(self.conn, OP_TASK_ASSIGN, {"submissionId": 9, "sourceCode": AC, "tests": []})
        _, result = self.collect_until_result(self.conn)
        self.assertEqual(result["status"], "ERROR")


if __name__ == "__main__":
    unittest.main()
