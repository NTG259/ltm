# Task 04 — Queue & Concurrency

> Mapping báo cáo: §8.7 Proposed Approach → Queue design, Dispatch algorithm · §8.10 Implementation → Concurrency mechanism · §8.14 Novelty → Redis Streams priority queue, least-busy dispatch

---

## 1. Redis Streams schema

### 1.1 Tại sao Redis Streams thay vì Redis List hoặc in-memory queue?

| Tiêu chí | `ConcurrentLinkedQueue` (hiện tại) | Redis List (`LPUSH/BRPOP`) | Redis Streams (đề xuất) |
|---|---|---|---|
| Durability khi Master crash | Mất hết — rebuild từ DB partial index | Bền vững (Redis AOF) | Bền vững + PEL tracking |
| Multi-Master | Không | Có | Có |
| Visibility timeout / redelivery | Không có — cần logic riêng | Không có native | PEL + `XAUTOCLAIM` built-in |
| Priority tiers | Không (single FIFO) | Cần 3 list + polling | 3 stream + 1 consumer group |
| Audit / replay | Không | Không | `XRANGE` xem lại lịch sử |
| ACK tracking | Không | Không | `XACK` tường minh |

> **Novelty:** PEL (Pending Entry List) của Redis Streams giải quyết bài toán "at-least-once delivery" trong distributed system — một message không bị mất cho đến khi Master tường minh `XACK` sau khi ghi xong DB.

### 1.2 Priority tiers — 3 stream

```
judge:contest   ─── priority 1 (cao nhất) — bài nộp trong contest đang diễn ra
judge:practice  ─── priority 2             — bài luyện tập
judge:custom    ─── priority 3 (thấp nhất) — custom test (reject khi tải cao)
```

**Lý do tách stream thay vì 1 stream + priority field:**
- Redis Streams không hỗ trợ sort theo field — phải `XRANGE` toàn bộ rồi sort trong application
- Tách stream cho phép `XREADGROUP` chọn stream theo thứ tự ưu tiên, không cần sort

**Consumer group:** Master tạo 1 consumer group `master-dispatch` trên cả 3 stream khi startup.

```
XGROUP CREATE judge:contest  master-dispatch $ MKSTREAM
XGROUP CREATE judge:practice master-dispatch $ MKSTREAM
XGROUP CREATE judge:custom   master-dispatch $ MKSTREAM
```

### 1.3 Message fields trong stream entry

| Field | Kiểu | Mô tả |
|-------|------|-------|
| `submissionId` | string (long) | ID trong bảng `submissions` |
| `attemptToken` | string (UUID v4) | Token chống stale result |
| `sourceCode` | string | Source code UTF-8 (≤ 64 KB) |
| `timeLimitMs` | int | Giới hạn thời gian per test (ms) |
| `memoryLimitMb` | int | Giới hạn bộ nhớ per test (MB) |
| `checker` | string | `lines` / `tokens` / `exact` |
| `stopOnFirst` | bool | Dừng khi test đầu tiên fail |
| `testsJson` | string | JSON array `[{index, input, output}]` |
| `enqueuedAt` | long | epoch ms — tính queue wait time |
| `attempt` | int | 0–3 — số lần đã thử |
| `contestId` | string / null | Để route vào đúng stream |

> **Lưu ý:** `sourceCode` và `testsJson` có thể lớn (tổng ≤ 10 MB per entry). Redis Streams không có hard limit per field, nhưng entry quá lớn làm chậm `XREADGROUP` — cân nhắc store source trong DB và chỉ giữ reference trong stream cho production.

---

## 2. Dispatch algorithm

### 2.1 `dispatchNext()` pseudocode

```java
// JudgeMasterService.java
private synchronized void dispatchNext() {
    // Iterate priority: contest → practice → custom
    for (String stream : List.of("judge:contest", "judge:practice", "judge:custom")) {
        // Tìm worker rảnh (least-busy)
        WorkerSession worker = pickLeastBusy();
        if (worker == null) return;  // không có worker rảnh → dừng

        // Đọc 1 message từ stream (non-blocking)
        StreamMessage msg = redis.xreadgroup(stream, "master-dispatch",
                                             worker.getId(), count=1, block=0);
        if (msg == null) continue;  // stream rỗng → thử stream tiếp

        // Giao task
        long submissionId = Long.parseLong(msg.field("submissionId"));
        String attemptToken = msg.field("attemptToken");

        // Lưu token vào DB trước khi gửi TCP
        submissionRepo.updateAttemptToken(submissionId, attemptToken);

        worker.send(OP_TASK_ASSIGN, buildTaskPayload(msg));
        worker.setBusy(true);
        worker.setCurrentTask(submissionId);
        worker.setPendingMessageId(msg.id());
        worker.setPendingStream(stream);

        return;  // đã dispatch một bài — gọi lại nếu muốn drain
    }
}
```

> `synchronized` trên `dispatchNext()` đủ vì call frequency thấp (sau mỗi submission mới hoặc sau mỗi result). Không cần `ReentrantLock` hay `StampedLock`.

### 2.2 `pickLeastBusy()` — tiêu chí chọn worker

```java
private WorkerSession pickLeastBusy() {
    return activeWorkers.values().stream()
        .filter(w -> !w.isBusy() && !w.isClosed())
        .min(Comparator.comparingLong(WorkerSession::getLatencyMs))
        .orElse(null);
}
```

**Tiêu chí:** `latencyMs` thấp nhất trong số worker không bận — ưu tiên worker gần Master (độ trễ mạng thấp) và không phụ thuộc vào capacity thực tế của máy worker. Nếu 2 worker cùng latency → `min()` lấy worker có ID nhỏ hơn (tiebreak ổn định).

### 2.3 Rate limit per-student

Chặn tại `POST /api/submissions` trong `SubmissionController`:

```java
// Đếm submissions trong 60s gần nhất
int recentCount = submissionRepo.countRecentByUser(userId, 60);
if (recentCount >= 10) {
    throw new TooManyRequestsException("Giới hạn 10 bài/phút");
}
```

Với custom test `POST /api/run`: giới hạn chặt hơn — 3 request/phút/user.

Khi `judge:custom` quá tải (queue depth > 100): **reject ngay** với HTTP 503, không queue thêm. Contest và practice không bị reject — chỉ chờ.

---

## 3. Thứ tự đảm bảo idempotency (CRITICAL)

```
Worker gửi OP_TASK_RESULT
        │
        ▼
Master kiểm tra attemptToken
        │ khớp
        ▼
submission.finish(result)   ← ghi verdict vào DB
        │ thành công
        ▼
redis.xack(stream, messageId)  ← chỉ ACK sau khi DB OK
        │
        ▼
worker.setBusy(false)
        │
        ▼
dispatchNext()
```

**Tại sao "ghi DB trước, XACK sau":**

Nếu Master crash sau khi XACK nhưng trước ghi DB → message biến mất khỏi PEL → bài mất hoàn toàn. Ngược lại, nếu crash sau ghi DB nhưng trước XACK → message vẫn còn trong PEL → khi Master restart sẽ `XAUTOCLAIM` và re-dispatch → Worker chấm lại → `finish()` gọi lần 2 là no-op (idempotent) → kết quả đúng.

---

## 4. Visibility timeout

```
visibility_timeout = compile_timeout    +  (max_tests × time_limit_per_test)  +  buffer
                   = 20s                +  (100        × 10s                ) +  30s
                   = 1 050s  ≈  18 phút
```

**Task-level keepalive:** Worker gửi `OP_TASK_STATUS` mỗi 10s khi đang chấm (dù chưa sang phase mới). Master cập nhật `worker.lastPongAt` khi nhận — giữ heartbeat timeout không fire trong lúc worker đang bận chấm bài dài.

```
XAUTOCLAIM judge:contest master-dispatch <consumer> <visibility_timeout_ms> 0-0 COUNT 10
```

---

## 5. Recovery khi Master restart

```java
@PostConstruct
void onStart() {
    // Bước 1: Claim PEL entries đã idle quá visibility_timeout
    for (String stream : streams) {
        List<StreamMessage> stale = redis.xautoclaim(
            stream, "master-dispatch", "recovery",
            visibilityTimeoutMs, "0-0", count=100);
        for (StreamMessage msg : stale) {
            long submissionId = Long.parseLong(msg.field("submissionId"));
            Submission sub = submissionRepo.findById(submissionId);
            if (sub.getStatus() == FINISHED) {
                redis.xack(stream, msg.id());  // đã xong, ACK thôi
            } else {
                requeueWithIncrementedAttempt(sub, msg);
            }
        }
    }

    // Bước 2: Tìm submissions trong DB không có PEL entry (bị drop giữa chừng)
    List<Submission> orphans = submissionRepo.findByStatusIn(
        IN_QUEUE, COMPILING, TESTING);
    Set<Long> inRedis = getPendingIdsFromPEL();
    for (Submission sub : orphans) {
        if (!inRedis.contains(sub.getId())) {
            pushToStream(sub);  // đẩy lại vào đúng stream theo contestId
        }
    }

    // Bước 3: Start các server
    startWorkerTcpListener();
    startHeartbeatScheduler();
}
```

---

## 6. Thread safety summary

| Resource | Cơ chế | Lý do |
|----------|--------|-------|
| `dispatchNext()` | `synchronized` trên method | Call frequency thấp, không bottleneck |
| `activeWorkers` | `ConcurrentHashMap` | Read nhiều (heartbeat check), write ít (register/disconnect) |
| `worker.send()` | `synchronized` trên `DataOutputStream` | Tránh 2 thread ghi frame xen kẽ nhau trên cùng socket |
| `submissionQueue` (in-memory, nếu không có Redis) | `ConcurrentLinkedQueue` | Lock-free FIFO |
| `pendingRunTests` | `ConcurrentHashMap<Long, CompletableFuture>` | Custom test async tracking |

---

## Quality checklist

- [x] 3 stream đặt tên rõ ràng và lý do priority được giải thích
- [x] Tất cả fields của stream entry liệt kê với kiểu dữ liệu
- [x] `dispatchNext()` pseudocode đủ chi tiết để implement Java
- [x] `pickLeastBusy()` tiêu chí rõ ràng: latencyMs (không chỉ "ít bận nhất")
- [x] Thứ tự "ghi DB → XACK Redis" giải thích tại sao (at-least-once delivery)
- [x] Visibility timeout: công thức cụ thể (1050s)
- [x] Task-level keepalive: Worker gửi TASK_STATUS mỗi 10s
- [x] Recovery khi restart: xử lý cả PEL stale và DB orphan
- [x] Rate limit per-student: 10 bài/phút POST submissions, 3/phút run
- [x] `judge:custom` quá tải → reject 503, không queue — contest/practice không bị ảnh hưởng
