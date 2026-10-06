import socket
import struct
import threading
import unittest

from judgement import protocol
from judgement.protocol import (
    HEADER_SIZE,
    MAGIC,
    MAX_PAYLOAD,
    OP_HEARTBEAT,
    OP_TASK_ASSIGN,
    OP_TASK_RESULT,
    FrameDecoder,
    InvalidMagicError,
    PayloadTooLargeError,
    UnknownOpcodeError,
)


class PackTest(unittest.TestCase):
    def test_header_layout(self):
        frame = protocol.pack(OP_HEARTBEAT, {"type": "PING"})
        magic, opcode, length = struct.unpack(">BBI", frame[:HEADER_SIZE])
        self.assertEqual((magic, opcode), (MAGIC, OP_HEARTBEAT))
        self.assertEqual(length, len(frame) - HEADER_SIZE)

    def test_utf8_payload_roundtrip(self):
        payload = {"sourceCode": 'int main(){ cout << "Xin chào\\n"; }\n// ký tự \x00 \n', "n": 1}
        frames = FrameDecoder().feed(protocol.pack(OP_TASK_ASSIGN, payload))
        self.assertEqual(frames, [(OP_TASK_ASSIGN, payload)])

    def test_invalid_magic(self):
        with self.assertRaises(InvalidMagicError):
            protocol.parse_header(struct.pack(">BBI", 0xEE, OP_HEARTBEAT, 0))

    def test_unknown_opcode(self):
        with self.assertRaises(UnknownOpcodeError):
            protocol.parse_header(struct.pack(">BBI", MAGIC, 0x7F, 0))

    def test_payload_too_large_declared(self):
        with self.assertRaises(PayloadTooLargeError):
            protocol.parse_header(struct.pack(">BBI", MAGIC, OP_TASK_RESULT, MAX_PAYLOAD + 1))


class SocketTest(unittest.TestCase):
    def setUp(self):
        self.a, self.b = socket.socketpair()
        self.b.settimeout(5)

    def tearDown(self):
        self.a.close()
        self.b.close()

    def test_sticky_packets(self):
        """Nhiều frame dính liền trong một lần gửi vẫn tách đúng."""
        msgs = [{"i": i, "pad": "x" * i * 100} for i in range(5)]
        self.a.sendall(b"".join(protocol.pack(OP_HEARTBEAT, m) for m in msgs))
        got = [protocol.recv_message(self.b) for _ in msgs]
        self.assertEqual(got, [(OP_HEARTBEAT, m) for m in msgs])

    def test_fragmented_byte_by_byte(self):
        """Frame bị chia nhỏ tới từng byte vẫn ghép lại đúng."""
        payload = {"sourceCode": "#include <bits/stdc++.h>\n" * 50}
        frame = protocol.pack(OP_TASK_ASSIGN, payload)

        def sender():
            for i in range(len(frame)):
                self.a.send(frame[i : i + 1])

        t = threading.Thread(target=sender)
        t.start()
        self.assertEqual(protocol.recv_message(self.b), (OP_TASK_ASSIGN, payload))
        t.join()

    def test_closed_mid_frame(self):
        self.a.sendall(protocol.pack(OP_HEARTBEAT, {"x": 1})[:4])
        self.a.close()
        with self.assertRaises(protocol.ConnectionClosed):
            protocol.recv_message(self.b)

    def test_garbage_rejected(self):
        self.a.sendall(b"GET / HTTP/1.1\r\n\r\n")
        with self.assertRaises(InvalidMagicError):
            protocol.recv_message(self.b)


class FrameDecoderTest(unittest.TestCase):
    def test_arbitrary_chunking(self):
        msgs = [{"k": i} for i in range(10)]
        stream = b"".join(protocol.pack(OP_HEARTBEAT, m) for m in msgs)
        dec = FrameDecoder()
        out = []
        for i in range(0, len(stream), 7):
            out += dec.feed(stream[i : i + 7])
        self.assertEqual([p for _, p in out], msgs)


if __name__ == "__main__":
    unittest.main()
