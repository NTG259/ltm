# Task 01 — System Architecture

> Mapping báo cáo: §8.3 Keywords · §8.7 Proposed Approach → Architecture · §8.8 System Architecture

---

## 1. Kiến trúc tổng thể

Hệ thống gồm 5 loại node. **Nginx** và **Redis** là đề xuất cho production — môi trường dev hiện tại kết nối trực tiếp và dùng in-memory queue trong Master.

> ⚠ **Hiện tại vs Đề xuất:** Dev không có Nginx (client → `:8000`/`:8001` trực tiếp) và không có Redis (queue = `ConcurrentLinkedQueue<Long>` trong RAM Master). Nginx và Redis là đề xuất production.

```
Browser (React SPA)
    │ HTTP :8000 · WS :8001 (dev: trực tiếp; production: qua Nginx)
    ▼
[Nginx :80/443]  ← Đề xuất: reverse proxy, TLS termination, load balancing
    │
    ▼
Master (Spring Boot)
  ├─ REST :8000      ← Spring Boot Tomcat
  ├─ WebSocket :8001 ← Tự cài RFC 6455 (MasterWebSocketServer.java)
  ├─ TCP :9000       ← Tự cài binary protocol (WorkerSession.java)
  ├─ In-Memory Queue ← ConcurrentLinkedQueue<Long> (→ Redis đề xuất)
  └─ JDBC            ← PostgreSQL (Neon Cloud)
         │ TCP :9000
    ┌────┴────┬─────────┐
    ▼         ▼         ▼
Worker-1   Worker-2  Worker-N   ← Python, scale ngang
(Python)   (Python)  (Python)
```

---

## 2. Data flow — vòng đời một bài nộp

```
Client                 Master               Queue   Worker          DB
  │                      │                    │       │              │
  │ POST /submissions     │                    │       │              │
  │──────────────────────▶│                    │       │              │
  │                       │ INSERT IN_QUEUE    │       │              │
  │                       │────────────────────────────────────────▶ │
  │                       │ enqueue(id=1001)   │       │              │
  │                       │───────────────────▶│       │              │
  │◀──────────────────────│ 200 {id:1001}      │       │              │
  │                       │                    │       │              │
  │◀══════════════════════│ [WS] IN_QUEUE       │       │              │
  │                       │                    │       │              │
  │                       │   dispatchNext()   │       │              │
  │                       │◀───────────────────│       │              │
  │                       │ OP_TASK_ASSIGN ─────────▶  │              │
  │                       │                    │       │ COMPILING     │
  │                       │◀════════════════════════─  │ OP_TASK_STATUS│
  │◀══════════════════════│ [WS] COMPILING      │       │              │
  │                       │                    │       │ TESTING       │
  │                       │◀════════════════════════─  │ OP_TASK_STATUS│
  │                       │                    │       │ OP_TASK_RESULT│
  │                       │◀════════════════════════─  │ {verdict:AC}  │
  │                       │ UPDATE FINISHED    │       │              │
  │                       │────────────────────────────────────────▶ │
  │◀══════════════════════│ [WS] FINISHED, AC   │       │              │

── HTTP    ══ WebSocket push    ── TCP Binary
```

**Error path — Worker mất kết nối:**
```
Master: checkHeartbeats() mỗi 5s
  → Worker silent > 15s → close socket
  → onWorkerDisconnected() → sub.requeue(attempt++)
  → Nếu attempt ≤ 3: enqueue lại (front of queue)
  → Nếu attempt > 3: UPDATE status=FAILED
```

---

## 3. Port map

| Port | Giao thức | Từ | Đến | Mô tả | Trạng thái |
|------|-----------|-----|-----|-------|------------|
| 80/443 | HTTP/HTTPS | Client | Nginx | Public entry, TLS termination | Đề xuất |
| 5173 | HTTP | Dev Browser | Vite | Frontend dev server + HMR | Dev only |
| 8000 | HTTP REST | Client / Nginx | Master | Auth, submit, problems, contests, courses | ✓ Implemented |
| 8001 | WebSocket RFC 6455 | Client / Nginx | Master | Real-time push: submission status, workers, proctor | ✓ Implemented |
| 9000 | TCP Binary | Worker (outbound) | Master | Custom protocol: task assign, status, result, heartbeat | ✓ Implemented |
| 6379 | Redis | Master | Redis | Durable queue + pub/sub (thay in-memory) | Đề xuất |
| 5432 | PostgreSQL JDBC | Master | Neon Cloud | Persistent storage | ✓ Implemented |

---

## 4. Tại sao tách Master thành ba port riêng biệt?

Ba port là **ba server socket chạy song song trong cùng một JVM**, mỗi cái phục vụ một communication pattern khác nhau:

| | :8000 REST | :8001 WebSocket | :9000 TCP Binary |
|---|---|---|---|
| **Giao thức** | HTTP/1.1 | HTTP Upgrade → WS frames (RFC 6455) | Custom binary (6-byte header) |
| **Kết nối** | Short-lived (đóng sau response) | Long-lived (giữ cả session) | Long-lived (giữ cả vòng đời Worker) |
| **Chiều** | Client → Server | Chủ yếu Server → Client (push) | Hai chiều ngang nhau |
| **Ai kết nối** | Bất kỳ HTTP client | Browser (public internet) | Worker Python (internal, trusted) |
| **Auth** | Bearer token header | Token trong WS message đầu tiên | Worker ID trong OP_REGISTER |
| **Scale strategy** | Stateless → load balance tự do | Sticky session (giữ connection state) | Internal only |
| **Implement** | Spring Boot Tomcat (tự động) | Tự cài RFC 6455 (`MasterWebSocketServer`) | Tự cài (`WorkerSession`) |

**Tại sao không merge vào một port?**

Nếu merge, Master phải **đọc từng byte đầu tiên** để phân biệt đây là HTTP request, WebSocket upgrade hay binary frame — tức là tự làm lại thứ OS + protocol stack đã làm tốt. Ngoài ra mỗi loại kết nối có cấu hình khác nhau:

- REST cần timeout ngắn; WebSocket và TCP Worker cần keepalive dài
- REST stateless → scale ngang dễ; WebSocket cần sticky session nếu có nhiều Master instance
- TCP Worker chỉ cho phép internal network — tách port giúp firewall/Nginx chặn port này với bên ngoài

> **Câu trả lời cho buổi bảo vệ:** Ba port phục vụ ba communication pattern — stateless request-response (REST), stateful server-push (WebSocket), và binary internal protocol (TCP). Tách port cho phép mỗi server có cấu hình độc lập và Nginx route đúng loại traffic đến đúng backend mà không cần inspect payload.

---

## 5. Component responsibilities

| Component | Làm gì | Không làm gì | Stateful? |
|-----------|--------|--------------|-----------|
| **Client SPA** | Render UI, gọi REST API, kết nối WebSocket, Monaco Editor, proctoring tab-switch detection | Không lưu nghiệp vụ; không chấm bài | Stateless (React state trong RAM tab) |
| **Nginx** *(đề xuất)* | Reverse proxy, TLS termination, load balance nhiều Master instance | Không xử lý nghiệp vụ; không đọc payload | Stateless |
| **Master** | AuthInterceptor, REST endpoints, WebSocket server tự cài (RFC 6455), TCP server :9000, FIFO dispatch, heartbeat monitor, Failover, DB read/write, plagiarism, LMS | Không biên dịch code; không chạy test trực tiếp | **Stateful** — in-memory queue, activeWorkers map |
| **Redis** *(đề xuất)* | Persistent FIFO queue, pub/sub kết quả | Không xử lý logic nghiệp vụ | Stateful |
| **Worker** | Nhận task qua TCP, chạy: static scan → g++ compile → sandbox execute → checker, gửi kết quả | Không ghi DB; không giao tiếp với Client | Stateless (chỉ giữ task đang xử lý) |
| **PostgreSQL** | Persistent storage, CHECK constraints, triggers, views cho leaderboard/standings | Không điều phối logic ứng dụng | **Stateful** (source of truth) |

---

## 6. Scale-out design

Để thêm Worker node mới vào cluster:

1. Khởi động Python worker với `--master-host <ip> --master-port 9000`
2. Worker tự kết nối TCP và gửi `OP_WORKER_REGISTER`
3. Master đăng ký vào `ConcurrentHashMap<String, WorkerSession> activeWorkers`
4. `dispatchNext()` tự động dispatch task đến Worker mới

> ✅ **Không cần config lại Master hay Nginx.** Worker cluster scale ngang hoàn toàn.

**Giới hạn hiện tại:** `dispatchNext()` dùng chiến lược *first-idle* (không phải true least-busy). Redis Streams (đề xuất) cho phép Worker tự pull — cân bằng tải tự nhiên hơn.

| Tiêu chí | In-memory Queue (hiện tại) | Redis Streams (đề xuất) |
|---|---|---|
| Durability khi Master restart | Mất queue → rebuild từ DB (partial index `ix_submissions_pending`) | Không mất — Redis lưu message trước khi ACK |
| Dispatch latency | ~0 ms (in-process) | ~1 ms (network hop) |
| Multi-Master support | Không — queue private mỗi instance | Có — nhiều Master cùng BRPOP |
| Load balancing model | Push (Master → Worker) | Pull (Worker tự lấy — cân bằng tự nhiên) |

---

## Quality checklist

- [x] Sơ đồ có đủ 5 nodes, có label port và giao thức tại mỗi mũi tên
- [x] Data flow bao gồm cả happy path và error path (worker mất kết nối)
- [x] Mỗi component liệt kê rõ trách nhiệm và giới hạn trách nhiệm
- [x] Ghi rõ component nào stateless / stateful
- [x] Scale-out: thêm Worker không yêu cầu config lại Master hay Nginx
- [x] Ghi rõ component nào có trong codebase hiện tại và component nào cần thêm mới (Nginx, Redis)
- [ ] Sơ đồ đủ để đưa thẳng vào báo cáo — cần vẽ lại bằng draw.io từ ASCII diagram ở trên
- [x] Một người chưa đọc code có thể hiểu toàn bộ hệ thống chỉ từ tài liệu này
