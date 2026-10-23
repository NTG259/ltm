# Task 03 — Network & Protocol Design

> Mapping báo cáo: §8.5 Background · §8.7 Proposed Approach → Communication flow · §8.9 Network Communication Design · §8.14 Novelty → Custom binary TCP · §8.19 Appendix → Protocol spec

---

## 1. Custom TCP Protocol (Master ↔ Worker, port `:9000`)

### 1.1 Tại sao binary protocol thay vì text/JSON-lines?

| Tiêu chí | JSON-lines (text) | Binary 6-byte header (chọn) |
|---|---|---|
| **Framing** | Dựa vào `\n` — payload có newline phải escape, dễ bug | Length field tường minh — đọc đúng `N` byte, không cần scan |
| **Overhead** | `Content-Length: 10485760\r\n\r\n` = thêm ký tự | 6 byte cố định, không phụ thuộc payload size |
| **Partial read** | Scanner phải buffer đến `\n` — treo nếu payload lớn | `readNBytes(length)` — đọc đúng một lần bằng `DataInputStream` |
| **Type checking** | Opcode nằm trong JSON field — parse JSON trước mới biết type | Opcode byte thứ 2 — biết ngay loại message trước khi parse JSON |
| **Magic byte validation** | Không có | `0xAA` đầu frame — phát hiện ngay kết nối lạc/corrupt |
| **Max payload** | Không enforce được đến khi parse xong | `uint32 BE` trong header — reject sớm nếu > 10 MB |
| **Implement** | Đơn giản hơn | 6 dòng Java (`DataInputStream.readNBytes`) + 4 dòng Python (`struct.unpack`) |

> **Novelty:** Giao thức binary tự thiết kế cho phép phát hiện và reject frame lỗi trước khi parse JSON — giảm CPU và memory khi Worker gửi payload không hợp lệ. Tương tự cách Redis RESP protocol dùng type-prefix byte thay vì parse toàn bộ message.

### 1.2 Frame format

```
Offset  Size  Type       Field
──────  ────  ─────────  ─────────────────────────────────────────
0       1B    uint8      MAGIC = 0xAA  (phát hiện kết nối lạc)
1       1B    uint8      OPCODE       (0x01–0x05, xem bảng dưới)
2       4B    uint32 BE  PAYLOAD_LEN  (số byte JSON UTF-8 tiếp theo)
6       ≤10MB UTF-8      PAYLOAD      (JSON body)

Total header: 6 bytes
Max frame:    6 + 10_485_760 = 10_485_766 bytes ≈ 10 MB
```

**Java đọc frame:**
```java
// MasterProtocol.java
static byte[] readMessage(DataInputStream in) throws IOException {
    int magic = in.readUnsignedByte();
    if (magic != 0xAA) throw new IOException("Invalid magic: 0x" + Integer.toHexString(magic));
    int opcode  = in.readUnsignedByte();
    int length  = in.readInt();  // reads 4 bytes big-endian
    if (length > MAX_PAYLOAD) throw new IOException("Payload too large: " + length);
    byte[] payload = in.readNBytes(length);
    return payload; // caller uses opcode from field above
}
```

**Python đọc frame:**
```python
# protocol.py
def recv_frame(sock):
    header = recv_exact(sock, 6)
    magic, opcode, length = struct.unpack(">BBL", header)
    if magic != 0xAA:
        raise ProtocolError(f"Invalid magic: {magic:#04x}")
    if length > MAX_PAYLOAD:
        raise ProtocolError(f"Payload too large: {length}")
    payload = recv_exact(sock, length)
    return opcode, json.loads(payload.decode("utf-8"))
```

### 1.3 Opcode table — đầy đủ payload schema

| Opcode | Tên | Chiều | Điều kiện gửi | Payload fields |
|--------|-----|-------|--------------|----------------|
| `0x01` | HEARTBEAT | M→W (PING) | Master mỗi 5s | `{type:"PING", ts:<epoch_ms>}` |
| `0x01` | HEARTBEAT | W→M (PONG) | Sau khi nhận PING | `{type:"PONG", ts:<epoch_ms>, busy:<bool>, currentTask:<submissionId\|null>, completed:<int>}` |
| `0x02` | WORKER_REGISTER | W→M | Worker kết nối, trước khi nhận task | `{workerId:<str>, compiler:"g++", sandbox:"launcher.c"\|"subprocess", version:<str>, hostname:<str>}` |
| `0x02` | WORKER_REGISTER ACK | M→W | Sau khi nhận REGISTER | `{accepted:true, masterVersion:<str>}` |
| `0x03` | TASK_ASSIGN | M→W | Master dispatch task từ queue | `{submissionId:<long>, sourceCode:<str>, timeLimitMs:<int>, memoryLimitMb:<int>, language:"cpp17", checker:"lines"\|"tokens"\|"exact", stopOnFirstFailure:<bool>, attempt:<int>, attemptToken:<uuid-str>, tests:[{index:<int>, input:<str>, output:<str>}]}` |
| `0x04` | TASK_STATUS | W→M | Sau mỗi phase (COMPILING, TESTING) | `{submissionId:<long>, status:"COMPILING"\|"TESTING", progress?:{current:<int>, total:<int>}}` |
| `0x05` | TASK_RESULT | W→M | Khi hoàn thành tất cả test | `{submissionId:<long>, attemptToken:<uuid-str>, verdict:"AC"\|"WA"\|"TLE"\|"MLE"\|"RTE"\|"CE"\|"SEC", score:<0-100>, timeMs:<int>, memoryKb:<int>, passed:<int>, total:<int>, tests:[{index, status, timeMs, memoryKb, outputPreview}], compileLog?:<str≤4KB>, securityMessage?:<str>}` |

> **`attemptToken`** trong TASK_ASSIGN và TASK_RESULT: Master sinh UUID v4 khi giao task. Worker echo lại trong result. Master từ chối result nếu token không khớp (chặn stale result sau Failover — xem `docs/design/02-database-state-machine.md §6`).

### 1.4 Connection lifecycle

```
Worker                                   Master
  │                                         │
  │── TCP connect to :9000 ────────────────▶│
  │                                         │ Tạo WorkerSession
  │── OP_REGISTER {workerId,...} ──────────▶│
  │◀─ OP_REGISTER ACK {accepted:true} ──────│ Thêm vào activeWorkers map
  │                                         │
  │           ┌── every 5s ─────────────────│── OP_HEARTBEAT PING
  │◀──────────┘                             │
  │── OP_HEARTBEAT PONG {busy,...} ────────▶│
  │                                         │
  │◀─ OP_TASK_ASSIGN {submissionId,...} ────│ dispatchNext()
  │── OP_TASK_STATUS {COMPILING} ──────────▶│ UPDATE submissions SET status=COMPILING
  │── OP_TASK_STATUS {TESTING} ────────────▶│ UPDATE submissions SET status=TESTING
  │── OP_TASK_RESULT {verdict,...} ─────────▶│ UPDATE FINISHED, dispatchNext()
  │                                         │
  ·  [Network failure / PONG missing >15s]  ·
  │                                         │
  ·                            checkHeartbeats() fires
  ·                            close socket
  ·                            onWorkerDisconnected()
  ·                            → sub.requeue(attempt++)
  ·                            → dispatchNext()
```

### 1.5 Error & rejection codes

| Tình huống | Worker gửi gì | Master phản ứng |
|---|---|---|
| Worker đang bận, nhận task nhầm | `OP_TASK_RESULT {verdict:"REJECTED", ...}` | Không tính attempt; re-enqueue ngay |
| Lỗi máy chấm (g++ không tìm thấy) | `OP_TASK_RESULT {verdict:"CE", securityMessage:"compiler not found"}` | Tính attempt; Failover nếu attempt ≤ 3 |
| Magic byte sai | (Không có — connection bị close ngay) | Master throw IOException, close socket |
| Payload > 10 MB | (Không có — connection bị close ngay) | Master throw IOException, close socket |
| PONG missing > 15s | (Worker im lặng) | checkHeartbeats() → close + requeue |

---

## 2. WebSocket Events (Client ↔ Master, port `:8001`)

### 2.1 Tại sao WebSocket riêng, không dùng SSE trên cổng REST?

| | SSE trên :8000 | WebSocket :8001 (chọn) |
|---|---|---|
| **Chiều** | Một chiều (Server push only) | Hai chiều (Client cũng gửi được — dùng cho AUTH) |
| **HTTP overhead** | Mỗi reconnect là HTTP request mới với headers đầy đủ | Upgrade một lần, sau đó frame thuần |
| **Isolation** | Dùng chung Tomcat thread pool với REST | Server socket riêng — REST latency spike không ảnh hưởng WS |
| **Auth** | Header Authorization bình thường | WebSocket spec không cho custom header qua browser → cần AUTH frame đầu tiên |
| **Implement** | Spring SseEmitter (có sẵn) | Tự cài RFC 6455 (`MasterWebSocketServer.java`) |

> **Lý do tự cài RFC 6455:** Spring WebSocket (STOMP) mang thêm STOMP broker overhead không cần thiết cho use case này. Tự implement cho phép kiểm soát hoàn toàn auth flow và broadcast logic với ~400 dòng code.

### 2.2 RFC 6455 handshake

```
Client → Server (HTTP Upgrade):
  GET /ws HTTP/1.1
  Host: localhost:8001
  Upgrade: websocket
  Connection: Upgrade
  Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==
  Sec-WebSocket-Version: 13

Server → Client (101 Switching Protocols):
  HTTP/1.1 101 Switching Protocols
  Upgrade: websocket
  Connection: Upgrade
  Sec-WebSocket-Accept: s3pPLMBiTxaQ9kYGzzhZRbK+xOo=
  [SHA-1(key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"), base64]
```

### 2.3 Connection lifecycle với AUTH

```
Browser                                  Master
  │                                         │
  │── TCP + HTTP Upgrade ──────────────────▶│ MasterWebSocketServer accept
  │◀─ 101 Switching Protocols ──────────────│
  │                                         │ Session: state=UNAUTHENTICATED
  │── WS frame: {"type":"AUTH","token":"…"} ▶│
  │                                         │ Validate SHA-256 token
  │                                         │ Session: state=AUTHENTICATED, userId, role
  │◀─ {"type":"AUTH_OK","role":"ADMIN"} ────│
  │                                         │
  │◀─ {"type":"SUBMISSION_UPDATE",...} ─────│ Broadcast khi submission thay đổi
  │◀─ {"type":"WORKER_UPDATE",...} ─────────│ Broadcast khi worker state thay đổi
  │                                         │
  │── WS Ping frame ───────────────────────▶│ RFC 6455 ping/pong tự động
  │◀─ WS Pong frame ────────────────────────│
  │                                         │
  · [Mất kết nối]                           ·
  · Client reconnect với exponential backoff ·
  · (1s, 2s, 4s, 8s, max 30s)               ·
```

### 2.4 Event table — tất cả server-push events

| `type` | Trigger | Payload schema | Chỉ admin? |
|--------|---------|----------------|-----------|
| `SUBMISSION_UPDATE` | Submission status thay đổi (IN_QUEUE→COMPILING→TESTING→FINISHED) | `{submissionId, status, verdict?, score?, timeMs?, tests?:[{index,status,timeMs,memoryKb}]}` | Không — gửi đến user nộp bài và admin |
| `WORKER_UPDATE` | Worker register/disconnect/PONG | `{workers:[{id, status, currentTask, completed}], queueSize}` | Không — admin dùng nhiều hơn |
| `CONTEST_UPDATE` | Bài nộp trong contest FINISHED | `{contestId}` — client tự gọi GET standings | Không |
| `PROCTOR_ALERT` | Tab switch / focus loss | `{userId, violationType:"TAB_SWITCH"\|"FOCUS_LOSS", count, ts}` | **Có** |
| `PRESENCE_UPDATE` | Student kết nối/ngắt WS | `{userId, type:"ONLINE"\|"OFFLINE", ts}` | **Có** |
| `LOG` | System log ghi vào DB | `{level:"INFO"\|"WARN"\|"ERROR", message, workerId?, submissionId?, ts}` | **Có** |
| `AUTH_OK` | Sau AUTH thành công | `{role:"ADMIN"\|"STUDENT", userId, username}` | Không |
| `AUTH_FAIL` | Token sai / hết hạn | `{reason:"INVALID_TOKEN"\|"EXPIRED"}` | Không |

---

## 3. REST API (Client ↔ Master, port `:8000`)

### 3.1 Auth

```
Request header: Authorization: Bearer <token>
```

`AuthInterceptor.java` intercepts mọi `/api/**` (trừ `/api/auth/login`):
1. Lấy token từ header
2. SHA-256(token) → tìm trong bảng `sessions`
3. Kiểm tra `expires_at > now()` và `revoked_at IS NULL`
4. Set `request.setAttribute("userId", ...)` và `request.setAttribute("userRole", ...)`

### 3.2 Response format chuẩn

```json
// Success
{
  "data": { /* payload tùy endpoint */ },
  "success": true
}

// Error
{
  "error": "Mô tả lỗi cho user",
  "code": "ERROR_CODE",
  "success": false
}
```

**HTTP status codes:**

| Tình huống | HTTP status | `code` |
|---|---|---|
| Thành công | 200 / 201 | — |
| Validation lỗi | 400 | `VALIDATION_ERROR` |
| Token không hợp lệ | 401 | `UNAUTHORIZED` |
| Không đủ quyền | 403 | `FORBIDDEN` |
| Không tìm thấy | 404 | `NOT_FOUND` |
| Nộp ngoài giờ thi | 400 | `CONTEST_NOT_ACTIVE` |
| Server/DB lỗi | 500 | `INTERNAL_ERROR` |
| Judge system lỗi | 503 | `JUDGE_UNAVAILABLE` |

### 3.3 Endpoint spec đầy đủ

#### Auth

**`POST /api/auth/login`** — Public
```json
// Request
{ "mssv": "B20DCCN001", "fullName": "Nguyễn Văn A" }   // Student
{ "username": "admin", "password": "admin123" }           // Admin

// Response 200
{ "data": { "token": "<bearer-token>", "role": "STUDENT", "userId": 2 }, "success": true }
// Response 401
{ "error": "Tên đăng nhập hoặc mật khẩu không đúng", "code": "UNAUTHORIZED", "success": false }
```

#### Submissions

**`POST /api/submissions`** — Student
```json
// Request
{ "problemId": 1, "sourceCode": "#include...", "contestId": null }

// Response 201
{ "data": { "id": 1001, "status": "IN_QUEUE" }, "success": true }

// Response 400 (nộp ngoài giờ)
{ "error": "Kỳ thi đã kết thúc", "code": "CONTEST_NOT_ACTIVE", "success": false }
```

**`GET /api/submissions/:id`** — Auth (owner hoặc Admin)
```json
// Response 200
{
  "data": {
    "id": 1001, "status": "FINISHED", "verdict": "AC",
    "score": 100, "timeMs": 54, "memoryKb": 1024,
    "tests": [{ "index": 1, "status": "AC", "timeMs": 54, "memoryKb": 1024 }]
  },
  "success": true
}
```

**`POST /api/run`** — Student (custom test, không lưu DB)
```json
// Request
{ "problemId": 1, "sourceCode": "#include...", "input": "3 5\n" }

// Response 200
{
  "data": {
    "verdict": "AC", "output": "8\n", "timeMs": 12,
    "compileLog": null
  },
  "success": true
}
```

#### Problems

**`GET /api/problems`** — Auth
```json
// Response 200
{
  "data": [
    {
      "id": 1, "title": "A + B", "difficulty": "EASY",
      "tags": ["implementation"],
      "stats": { "totalSubmissions": 120, "acceptedSubmissions": 85, "solvedUsers": 60 }
    }
  ],
  "success": true
}
```

**`GET /api/problems/:id`** — Auth
```json
// Response 200
{
  "data": {
    "id": 1, "title": "A + B",
    "statement": "<markdown>", "timeLimit": 1000, "memoryLimit": 256,
    "checker": "lines",
    "sampleTests": [{ "input": "3 5", "output": "8" }]
  },
  "success": true
}
```

#### Contests

**`GET /api/contests/:id/standings`** — Auth
```json
// Response 200
{
  "data": {
    "contestId": 1,
    "problems": [{ "id": 1, "label": "A" }],
    "rows": [
      {
        "rank": 1, "userId": 2, "username": "B20DCCN001", "fullName": "Nguyễn Văn A",
        "solved": 3, "penalty": 45,
        "cells": {
          "A": { "solved": true, "wrong": 0, "solveMinute": 12, "firstSolve": true },
          "B": { "solved": true, "wrong": 1, "solveMinute": 23, "firstSolve": false }
        }
      }
    ]
  },
  "success": true
}
```

#### Admin

**`GET /api/admin/workers`** — Admin
```json
// Response 200
{
  "data": {
    "workers": [
      { "id": "worker-1", "status": "IDLE", "currentTask": null, "completed": 42 }
    ],
    "queueSize": 3,
    "totalWorkers": 2,
    "idleWorkers": 1
  },
  "success": true
}
```

**`POST /api/contests/:id/plagiarism/run`** — Admin
```json
// Request: body empty
// Response 202 (accepted, async)
{ "data": { "reportId": 7, "status": "RUNNING" }, "success": true }
```

---

## 4. Connection failure handling

### TCP (Master ↔ Worker)

| Lỗi | Detection | Xử lý |
|-----|-----------|-------|
| Partial read (frame incomplete) | `readNBytes` block đến khi đủ bytes hoặc EOF | EOF → close socket → `onWorkerDisconnected()` |
| Magic byte sai (`≠ 0xAA`) | Byte đầu tiên check ngay | Throw IOException → close socket |
| Payload > 10 MB | `length > MAX_PAYLOAD` trong header | Throw IOException → close socket |
| PONG missing > 15s | `checkHeartbeats()` scheduler mỗi 5s | Close socket → Failover → requeue |
| Worker process crash | TCP FIN nhận được | `onWorkerDisconnected()` ngay lập tức |
| Network partition (không có FIN) | PONG timeout 15s | Cùng flow với PONG missing |

### WebSocket (Client ↔ Master)

| Lỗi | Detection | Xử lý |
|-----|-----------|-------|
| AUTH timeout (không gửi AUTH sau 10s) | Master scheduler | Close connection |
| Token hết hạn trong session | Kiểm tra `expires_at` mỗi broadcast | Close connection với `AUTH_FAIL` |
| Client disconnect | TCP FIN / IOException | Xóa session khỏi `activeSessions` map |
| Client reconnect | Client mở WS mới | Tạo session mới — phải AUTH lại |

### REST

| Lỗi | HTTP Status | Xử lý phía client |
|-----|-------------|-------------------|
| DB timeout | 503 `JUDGE_UNAVAILABLE` | Frontend hiển thị thông báo, retry sau 3s |
| Validation thất bại | 400 `VALIDATION_ERROR` | Frontend hiển thị message từ `error` field |
| Token hết hạn | 401 `UNAUTHORIZED` | Frontend redirect đến login |

---

## 5. Tại sao không dùng HTTP/2?

Spring Boot 4 (Tomcat 10) hỗ trợ HTTP/2, nhưng hệ thống này không upgrade vì:

1. **WebSocket over HTTP/2** (RFC 8441 — Extended CONNECT) chưa được Tomcat hỗ trợ hoàn chỉnh — sẽ phải migrate `MasterWebSocketServer` sang Spring WebFlux/Netty
2. **Multiplexing** HTTP/2 hữu ích khi client gửi nhiều request song song — use case chính ở đây là submit một lần và chờ WebSocket push, không đủ lợi ích
3. **TLS required** cho HTTP/2 production — trong scope này Nginx xử lý TLS termination, backend giữ HTTP/1.1

---

## Quality checklist

- [x] TCP frame format đủ để implement `DataInputStream`/`DataOutputStream` Java + `struct.pack` Python không cần hỏi thêm
- [x] Mỗi opcode: direction, payload fields (tên + kiểu dữ liệu), điều kiện gửi
- [x] `attemptToken` UUID có trong TASK_ASSIGN và TASK_RESULT — giải thích mục đích
- [x] WebSocket: auth flow, event loop, reconnect backoff
- [x] REST API: tất cả endpoint chính có request + response schema
- [x] Error codes: phân biệt 4xx client / 5xx server / 503 judge unavailable
- [x] Section WHY binary (6-byte header) thay vì JSON-lines — có bảng so sánh + novelty
- [x] Connection failure handling: magic byte sai, payload quá lớn, PONG timeout, TCP FIN
- [x] HTTP/2 decision documented
