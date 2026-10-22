# Task 03 — Network & Protocol Design

**Dependency:** Task 01 (biết component nào giao tiếp với component nào).

## Objective

Thiết kế đầy đủ 3 kênh giao tiếp: REST API (Client↔Master), WebSocket (Client↔Master real-time), và Custom TCP Protocol (Master↔Worker). Đây là phần **trọng tâm kỹ thuật** của báo cáo.

## Research areas

- Custom binary protocol design: tại sao chọn binary (6-byte header) thay vì text protocol
- WebSocket RFC 6455: handshake, frame format, ping/pong, connection lifecycle
- HTTP/2 vs HTTP/1.1 — có nên upgrade không, tradeoff với Spring Boot
- REST API versioning và error response format chuẩn
- TCP keep-alive vs application-level heartbeat — tại sao cần cả hai

## Design deliverables

### 1. Custom TCP Protocol (Master ↔ Worker)

**Frame format:**
```
┌────────┬─────────┬──────────────────┬─────────────────────────┐
│ Magic  │ Opcode  │ Length (uint32BE) │ Payload (JSON UTF-8)    │
│ 0xAA   │ 1 byte  │ 4 bytes           │ ≤ 10 MB                 │
└────────┴─────────┴──────────────────┴─────────────────────────┘
Total header: 6 bytes
```

**Opcode table đầy đủ** với payload schema cho mỗi opcode:

| Opcode | Tên | Chiều | Payload schema (JSON fields) |
|--------|-----|-------|------------------------------|
| `0x01` | HEARTBEAT | M↔W | `{type, ts, busy?, currentTask?, completed?}` |
| `0x02` | WORKER_REGISTER | W→M (+ ACK M→W) | `{workerId, compiler, sandbox, version, hostname}` |
| `0x03` | TASK_ASSIGN | M→W | `{submissionId, sourceCode, timeLimitMs, memoryLimitMb, language, checker, stopOnFirstFailure, attempt, attemptToken, tests:[{index,input,output}]}` |
| `0x04` | TASK_STATUS | W→M | `{submissionId, status, progress?:{current,total}}` |
| `0x05` | TASK_RESULT | W→M | `{submissionId, attemptToken, verdict, score, timeMs, memoryKb, passed, total, tests:[...], compileLog?, securityMessage?}` |

**Connection lifecycle:**
```
Worker connects TCP → Worker sends REGISTER → Master ACKs
Master sends PING every 5s → Worker replies PONG
Master sends TASK_ASSIGN → Worker replies TASK_STATUS × N → Worker replies TASK_RESULT
[Worker disconnect] → Master detects timeout 15s → Failover
```

**Error codes** — khi nào Worker gửi `status:"ERROR"` vs `status:"REJECTED"`:
- `ERROR`: lỗi máy chấm (Master nên failover)
- `REJECTED`: worker đang bận (không tính attempt)

### 2. WebSocket Events (Client ↔ Master, port `:8001`)

**Connection lifecycle:**
```
Client opens WS → Client sends AUTH{token} → Master validates → Session active
Master broadcasts events → Client receives
[Timeout/disconnect] → Client auto-reconnects with exponential backoff
```

**Auth message:**
```json
{"type": "AUTH", "token": "<sha256-of-bearer-token>"}
```

**Event table:**

| type | Trigger | Payload | Recipient |
|------|---------|---------|-----------|
| `SUBMISSION_UPDATE` | Status change | `{submissionId, status, verdict?, score?, tests?}` | All |
| `WORKER_UPDATE` | Worker event | `{workers:[...], queueSize}` | All |
| `CONTEST_UPDATE` | Submission finished in contest | `{contestId}` | All |
| `PROCTOR_ALERT` | Tab switch detected | `{userId, violationType, count}` | Admin |
| `PRESENCE_UPDATE` | Student connect/disconnect | `{userId, type:"ONLINE"|"OFFLINE"}` | Admin |
| `LOG` | SystemLog written | `{level, message, ts}` | Admin |

### 3. REST API (Client ↔ Master, port `:8000` qua Nginx)

**Auth:** Bearer token header `Authorization: Bearer <token>`.

**Response format chuẩn:**
```json
// Success
{"data": {...}, "success": true}

// Error
{"error": "message", "code": "ERROR_CODE", "success": false}
```

**Endpoints chính** (ghi rõ request/response schema cho mỗi endpoint):

| Method | Path | Auth | Mô tả |
|--------|------|------|-------|
| POST | `/api/auth/login` | Public | Student: MSSV+name. Admin: password |
| POST | `/api/submissions` | Student | Nộp bài — body: `{problemId, sourceCode, contestId?}` |
| GET | `/api/submissions/:id` | Auth | Chi tiết bài nộp + test results |
| GET | `/api/submissions/:id/stream` | Auth | SSE stream trạng thái (alternative to WS) |
| GET | `/api/problems` | Auth | Danh sách đề |
| GET | `/api/contests/:id/standings` | Auth | Bảng xếp hạng ICPC |
| POST | `/api/run` | Student | Custom test — body: `{sourceCode, input}` |
| GET | `/api/admin/workers` | Admin | Danh sách worker + queue |

## Quality checklist

- [ ] TCP frame format có thể implement bằng `DataInputStream`/`DataOutputStream` Java và `struct.pack` Python mà không cần hỏi thêm
- [ ] Mỗi opcode có đầy đủ: direction, payload fields (tên + kiểu dữ liệu), điều kiện gửi
- [ ] `attemptToken` (UUID) có trong TASK_ASSIGN và TASK_RESULT payload để chặn stale result
- [ ] WebSocket connection lifecycle: auth, event loop, reconnect đều được mô tả
- [ ] REST API: tất cả endpoint có request body schema và response schema
- [ ] Error codes: phân biệt rõ client error (4xx) vs server error (5xx) vs judge error
- [ ] Custom TCP protocol có section giải thích WHY binary (6-byte header) thay vì JSON-lines — phục vụ novelty
- [ ] Connection failure handling: timeout, partial read, invalid magic byte đều có hướng xử lý
- [ ] Protocol đủ để agent viết `MasterProtocol.java` và `protocol.py` không cần hỏi lại

## Mapping báo cáo

- §8.5 Background → "tại sao không dùng HTTP thuần để giao tiếp với Worker"
- §8.7 Proposed Approach → Communication flow
- §8.9 Network Communication Design (full section)
- §8.14 Novelty → Custom binary TCP protocol
- §8.19 Appendix → Protocol specification
