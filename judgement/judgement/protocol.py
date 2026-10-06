"""Giao thức nhị phân Master <-> Worker (TCP :9000).

Mỗi bản tin gồm header 6 byte big-endian ``>BBI`` và payload JSON UTF-8::

    +-------------+-----------+--------------------------+
    | Magic 0xAA  | Opcode    | Payload length (uint32)  |
    |   1 byte    |  1 byte   |         4 bytes          |
    +-------------+-----------+--------------------------+
    |               Payload (N bytes, JSON)              |
    +----------------------------------------------------+

``recv_exact`` đọc lặp cho tới khi đủ số byte, nên gói bị phân mảnh hay dính
liền nhau trong bộ đệm TCP đều được tách đúng.
"""

from __future__ import annotations

import json
import socket
import struct
from typing import Any

MAGIC = 0xAA
HEADER = struct.Struct(">BBI")
HEADER_SIZE = HEADER.size  # 6
MAX_PAYLOAD = 10 * 1024 * 1024  # 10 MB, chống cạn RAM

OP_HEARTBEAT = 0x01
OP_WORKER_REGISTER = 0x02
OP_TASK_ASSIGN = 0x03
OP_TASK_STATUS = 0x04
OP_TASK_RESULT = 0x05

OPCODE_NAMES = {
    OP_HEARTBEAT: "OP_HEARTBEAT",
    OP_WORKER_REGISTER: "OP_WORKER_REGISTER",
    OP_TASK_ASSIGN: "OP_TASK_ASSIGN",
    OP_TASK_STATUS: "OP_TASK_STATUS",
    OP_TASK_RESULT: "OP_TASK_RESULT",
}


class ProtocolError(Exception):
    """Bản tin không hợp lệ; bên nhận phải đóng kết nối."""


class InvalidMagicError(ProtocolError):
    pass


class PayloadTooLargeError(ProtocolError):
    pass


class UnknownOpcodeError(ProtocolError):
    pass


class ConnectionClosed(ConnectionError):
    """Đối tác đóng kết nối (FIN) giữa chừng hoặc trước khi gửi bản tin."""


def pack(opcode: int, payload: Any) -> bytes:
    """Đóng gói ``payload`` (dict/list/...) thành một frame hoàn chỉnh."""
    body = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    if len(body) > MAX_PAYLOAD:
        raise PayloadTooLargeError(f"payload {len(body)} bytes vượt trần {MAX_PAYLOAD}")
    return HEADER.pack(MAGIC, opcode, len(body)) + body


def parse_header(header: bytes) -> tuple[int, int]:
    """Kiểm tra header 6 byte, trả về ``(opcode, length)``."""
    magic, opcode, length = HEADER.unpack(header)
    if magic != MAGIC:
        raise InvalidMagicError(f"magic byte 0x{magic:02X} != 0x{MAGIC:02X}")
    if opcode not in OPCODE_NAMES:
        raise UnknownOpcodeError(f"opcode 0x{opcode:02X} không hỗ trợ")
    if length > MAX_PAYLOAD:
        raise PayloadTooLargeError(f"payload khai báo {length} bytes vượt trần {MAX_PAYLOAD}")
    return opcode, length


def recv_exact(sock: socket.socket, num_bytes: int) -> bytes:
    """Đọc đúng ``num_bytes`` byte, gom các mảnh TCP nhỏ lại với nhau."""
    buf = bytearray(num_bytes)
    view = memoryview(buf)
    got = 0
    while got < num_bytes:
        n = sock.recv_into(view[got:], num_bytes - got)
        if n == 0:
            raise ConnectionClosed(f"kết nối đóng sau {got}/{num_bytes} bytes")
        got += n
    return bytes(buf)


def recv_message(sock: socket.socket) -> tuple[int, Any]:
    """Nhận một bản tin hoàn chỉnh, trả về ``(opcode, payload)``."""
    opcode, length = parse_header(recv_exact(sock, HEADER_SIZE))
    body = recv_exact(sock, length) if length else b""
    try:
        payload = json.loads(body.decode("utf-8")) if body else None
    except (UnicodeDecodeError, json.JSONDecodeError) as e:
        raise ProtocolError(f"payload không phải JSON UTF-8: {e}") from e
    return opcode, payload


def send_message(sock: socket.socket, opcode: int, payload: Any) -> None:
    sock.sendall(pack(opcode, payload))


class FrameDecoder:
    """Bộ tách frame tăng dần cho luồng byte tùy ý (dùng khi không đọc blocking).

    ``feed`` nhận bất kỳ mảnh nào và trả về danh sách bản tin đã đủ.
    """

    def __init__(self) -> None:
        self._buf = bytearray()

    def feed(self, data: bytes) -> list[tuple[int, Any]]:
        self._buf += data
        out = []
        while len(self._buf) >= HEADER_SIZE:
            opcode, length = parse_header(bytes(self._buf[:HEADER_SIZE]))
            end = HEADER_SIZE + length
            if len(self._buf) < end:
                break
            body = bytes(self._buf[HEADER_SIZE:end])
            del self._buf[:end]
            out.append((opcode, json.loads(body.decode("utf-8")) if body else None))
        return out
