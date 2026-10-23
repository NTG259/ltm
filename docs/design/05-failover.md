# Task 05 — Error Handling & Failover

> Mapping báo cáo: §8.7 Proposed Approach → Fault tolerance design · §8.10 Implementation → Error handling mechanism · §8.14 Novelty → attempt_token chống stale result, auto-failover · §6 Requirements → connection failure, timeout, duplicate request

---

## 1. Heartbeat sequence

```
Master (scheduler, mỗi 5s)           Worker
        │                                │
        │── OP_HEARTBEAT PING ──────────▶│
        │   {type:"PING", ts:<epoch_ms>} │
        │                                │
        │◀── OP_HEARTBEAT PONG ──────────│
        │   {type:"PONG",                │
        │    ts:<epoch_ms>,              │
        │    busy:<bool>,                │
        │    currentTask:<long|null>,    │
        │    completed:<int>,            │
        │    latencyMs:<int>}            │
        │                                │
        │ latencyMs = now() - ts         │
        │ worker.lastPongAt = now()      │
```

**checkHeartbeats() — chạy mỗi 5s:**

```java
void checkHeartbeats() {
    long now = System.currentTimeMillis();
    for (WorkerSession worker : activeWorkers.values()) {
        if (now - worker.getLastPongAt() > HEARTBEAT_TIMEOUT_MS) {  // 15 000 ms
            log.warn("Worker {} silent for >15s, closing", worker.getId());
            worker.close();
            onWorkerDisconnected(worker);
        }
    }
}
```

**Tại sao cần application-level heartbeat dù TCP đã có keep-alive?**

TCP keep-alive mặc định có `tcp_keepidle = 7200s` (Linux) — quá chậm để phát hiện worker treo trong vòng 15s. Application-level PING/PONG cho phép:
- Kiểm soát timeout chính xác (5s interval, 15s threshold)
- Đo `latencyMs` để `pickLeastBusy()` dùng
- Biết `busy` state và `currentTask` để quyết định failover đúng bài

---

## 2. `onWorkerDisconnected()` pseudocode

```java
void onWorkerDisconnected(WorkerSession worker) {
    // 1. Xóa khỏi active pool
    activeWorkers.remove(worker.getId());
    workerRepo.updateStatus(worker.getId(), "DEAD");

    // 2. Xử lý bài đang chấm (nếu có)
    Long submissionId = worker.getCurrentTask();
    if (submissionId != null) {
        Submission sub = submissionRepo.findById(submissionId);

        if (sub != null && sub.getStatus() != FINISHED) {
            int newAttempt = sub.getAttempts() + 1;
            sub.setAttempts(newAttempt);

            if (newAttempt <= MAX_ATTEMPTS) {  // MAX_ATTEMPTS = 3
                // Tạo token mới cho attempt tiếp theo
                String newToken = UUID.randomUUID().toString();
                sub.setAttemptToken(newToken);
                sub.setStatus(IN_QUEUE);
                sub.setWorkerID(null);
                submissionRepo.save(sub);

                // Đẩy lại vào đúng stream (contest ưu tiên cao hơn)
                pushToStream(sub);

                // Ghi audit log
                submissionEventRepo.insert(sub.getId(), "REQUEUED",
                    "Worker " + worker.getId() + " disconnected after timeout, attempt "
                    + newAttempt + "/" + MAX_ATTEMPTS);
            } else {
                sub.setStatus(FAILED);
                sub.setErrorMessage("Exceeded max attempts (" + MAX_ATTEMPTS + ")");
                submissionRepo.save(sub);

                submissionEventRepo.insert(sub.getId(), "FAILED",
                    "Max attempts reached after worker disconnect");
            }
        }
    }

    // 3. Broadcast cập nhật worker list
    webSocketServer.broadcastWorkerUpdate();

    // 4. Drain queue với workers còn lại
    dispatchNext();
}
```

---

## 3. `attempt_token` — chặn stale result (split-brain scenario)

### 3.1 Vấn đề (split-brain)

```
Master           Worker-1 (chậm)      Worker-2
  │                  │                    │
  │── ASSIGN ────────▶│                  │
  │   {token: "A",   │                  │
  │    sid: 1042}    │                  │
  │                  │ [đang chấm...]   │
  │                  │                  │
  │ PONG missing >15s│                  │
  │ → Failover       │                  │
  │── ASSIGN ─────────────────────────▶│
  │   {token: "B",   │                  │
  │    sid: 1042}    │ [vẫn đang chấm] │
  │                  │                  │ [đang chấm...]
  │◀─ RESULT ────────│                  │
  │   {token: "A",   │                  │
  │    verdict: AC}  │                  │
  │                  │                  │
  │ token "A" ≠ current "B"            │
  │ → BỎ QUA ✗       │                  │
  │                  │                  │ RESULT {token: "B"}
  │◀──────────────────────────────────│
  │ token "B" = "B"  │                  │
  │ → CHẤP NHẬN ✓    │                  │
```

### 3.2 Implementation

**Khi dispatch TASK_ASSIGN:**
```java
String token = UUID.randomUUID().toString();
submissionRepo.updateAttemptToken(submissionId, token);  // ghi DB TRƯỚC khi gửi TCP
worker.send(OP_TASK_ASSIGN, payload.put("attemptToken", token));
```

**Khi nhận TASK_RESULT:**
```java
void handleTaskResult(WorkerSession worker, JsonObject result) {
    long submissionId = result.getLong("submissionId");
    String receivedToken = result.getString("attemptToken");

    Submission sub = submissionRepo.findById(submissionId);

    if (sub == null || !receivedToken.equals(sub.getAttemptToken())) {
        log.warn("Stale result rejected: sid={}, expected={}, got={}",
                 submissionId, sub == null ? "null" : sub.getAttemptToken(), receivedToken);
        submissionEventRepo.insert(submissionId, "STALE_REJECTED",
            "Token mismatch from " + worker.getId());
        return;  // bỏ qua — không ghi DB, không XACK
    }

    sub.finish(result);
    redis.xack(worker.getPendingStream(), worker.getPendingMessageId());
    worker.setBusy(false);
    dispatchNext();
}
```

---

## 4. Edge cases

| ID | Mô tả | Xử lý |
|----|-------|-------|
| **W3** | Worker nhận task rồi crash ngay (message vào PEL, không có RESULT) | `XAUTOCLAIM` sau `visibility_timeout` (≈18 phút) → re-dispatch với `attempt++` |
| **W4** | Master crash sau `XACK` nhưng trước ghi DB | **Không xảy ra** — luôn ghi DB trước XACK (thứ tự bắt buộc ở §3 Task 04) |
| **W5** | Worker đóng băng (alive, TCP còn nhưng không respond PONG) | `checkHeartbeats()` phát hiện sau 15s → `onWorkerDisconnected()` |
| **W6** | Worker cũ "hồi sinh" sau khi đã bị failover, gửi kết quả muộn | `attemptToken` mismatch → log `STALE_REJECTED` → bỏ qua |
| **W8** | Worker reconnect với cùng ID đang có session active | Master reject `REGISTER` nếu `activeWorkers.containsKey(workerId)` → Worker phải đổi ID hoặc chờ session cũ timeout |
| **M3** | Master crash sau pop Redis nhưng trước giao Worker | Message vẫn trong PEL → `XAUTOCLAIM` khi restart → re-dispatch |

---

## 5. Custom test failover (ngoại lệ)

Custom test (`submissionId < 0`) là request đồng bộ từ user — **không có failover**:

```java
// Tạo CompletableFuture lưu vào pendingRunTests
CompletableFuture<RunResult> future = new CompletableFuture<>();
pendingRunTests.put(negativeId, future);

// Giao cho worker (không qua Redis stream)
worker.send(OP_TASK_ASSIGN, payload);

// Timeout 15s
try {
    RunResult result = future.get(15, TimeUnit.SECONDS);
    return ResponseEntity.ok(result);
} catch (TimeoutException e) {
    pendingRunTests.remove(negativeId);
    return ResponseEntity.status(503).body("Judge timeout");
}
```

Worker disconnect trong lúc custom test → `future.completeExceptionally()` → HTTP 503 trả ngay cho user. Không tăng attempt, không requeue.

---

## 6. `finish()` idempotent

```java
public synchronized void finish(TaskResult result) {
    if (this.status == SubmissionStatus.FINISHED
            || this.status == SubmissionStatus.FAILED) {
        log.warn("finish() called on terminal submission {}, ignoring", id);
        return;  // no-op — không throw, không ghi đè
    }
    this.verdict     = result.getVerdict();
    this.score       = result.getScore();
    this.timeMs      = result.getTimeMs();
    this.memoryKb    = result.getMemoryKb();
    this.passedTests = result.getPassed();
    this.totalTests  = result.getTotal();
    this.finishedAt  = Instant.now();
    this.status      = SubmissionStatus.FINISHED;
    // save() gọi bởi @Transactional service layer
}
```

Thêm lớp bảo vệ ở DB:
```sql
-- Chỉ update nếu chưa FINISHED (rows affected = 0 nếu đã xong)
UPDATE submissions
SET status = 'FINISHED', verdict = ?, finished_at = now()
WHERE id = ? AND status IN ('COMPILING', 'TESTING');
```

---

## 7. Logging audit trail

Mọi sự kiện failover ghi vào `submission_events` (append-only, không xóa):

| Event | Nội dung mẫu |
|-------|-------------|
| `REQUEUED` | `"Worker worker-2 disconnected after 15s timeout, attempt 2/3"` |
| `REJECTED` | `"Worker worker-1 returned REJECTED (busy), requeued without increment"` |
| `STALE_REJECTED` | `"Attempt token mismatch from worker-1, result discarded"` |
| `FAILED` | `"Max attempts (3) reached, submission marked FAILED"` |
| `ASSIGNED` | `"Dispatched to worker-3, attempt 1, token abc-123"` |

---

## Quality checklist

- [x] Heartbeat sequence diagram: chu kỳ 5s, payload đầy đủ, timeout threshold 15s
- [x] `onWorkerDisconnected()` pseudocode đủ để agent implement Java
- [x] `attemptToken` giải thích split-brain scenario bằng diagram
- [x] `attemptToken` có trong: TASK_ASSIGN payload, DB column (`attempt_token UUID`), TASK_RESULT validation
- [x] 6 edge cases (W3, W4, W5, W6, W8, M3) có hướng xử lý cụ thể
- [x] Custom test failover tách riêng — không dùng cơ chế requeue, trả 503 ngay
- [x] `finish()` idempotent: no-op khi gọi lần 2, không throw exception
- [x] Mọi failover event ghi vào `submission_events`
- [x] Phân biệt `attempt++` (worker mất kết nối) vs không tăng (worker từ chối vì bận)
- [x] DB migration: `attempt_token UUID` đề xuất trong V11 (xem Task 02)
- [x] Tại sao application heartbeat cần thiết dù TCP đã có keep-alive
