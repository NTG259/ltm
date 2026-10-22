# Task 05 — Error Handling & Failover

**Dependency:** Task 03 (protocol — PING/PONG), Task 04 (queue — requeue vào Redis).

## Objective

Thiết kế cơ chế giám sát worker và tự phục hồi khi sự cố xảy ra: heartbeat, failover, attempt_token chống stale result, và xử lý các edge case nguy hiểm nhất.

## Research areas

- **Split-brain problem** trong distributed judge: Worker cũ vẫn sống và gửi kết quả sau khi đã bị failover sang Worker mới
- **PEL (Pending Entry List)** trong Redis Streams: idle timeout, `XAUTOCLAIM`
- **Heartbeat vs TCP keep-alive**: tại sao cần application-level heartbeat dù TCP đã có keep-alive
- **Idempotency tại DB**: `finish()` phải no-op khi gọi lần 2

## Design deliverables

### 1. Heartbeat sequence

```
Master (scheduler, mỗi 5s)          Worker
  ──── PING {type:"PING", ts:now} ──────►
  ◄─── PONG {type:"PONG", ts, busy,        ──
             currentTask, completed,
             latencyMs}
  
  Master tính: latencyMs = now - ts
  Master cập nhật: worker.lastPongAt = now
```

**Timeout detection:**
```
checkHeartbeats() — chạy mỗi 5s:
  for worker in activeWorkers:
    if now - worker.lastPongAt > 15s:
      worker.close()
      onWorkerDisconnected(worker)
```

**onWorkerDisconnected(worker):**
```
1. activeWorkers.remove(worker.id)
2. update workers table: status=DEAD, disconnectedAt=now
3. if worker.currentTask != null:
   sub = findSubmission(worker.currentTask)
   sub.requeue(attempt++)       // tăng attempt
   if attempt <= 3:
     pushToRedisStream(sub)     // đẩy lại queue
   else:
     sub.fail("Exceeded max attempts")
4. broadcastWorkerUpdate()
5. dispatchNext()               // drain queue với workers còn lại
```

### 2. attempt_token — chặn stale result (CRITICAL)

**Vấn đề:** Worker A đang chấm bài #1042. Master timeout → failover → Worker B nhận bài #1042. Worker A "hồi sinh" và gửi TASK_RESULT về. Nếu không có cơ chế chặn, kết quả của Worker A ghi đè kết quả của Worker B.

**Giải pháp:**
```
Khi dispatch TASK_ASSIGN:
  attemptToken = UUID.randomUUID().toString()
  lưu vào submission.attemptToken (DB column mới)
  đưa vào payload TASK_ASSIGN.attemptToken

Khi nhận TASK_RESULT:
  if result.attemptToken != submission.attemptToken:
    log("Stale result rejected, token mismatch")
    return  // bỏ qua, không ghi DB, không XACK
  else:
    finish(result)
    XACK(redisStream, messageId)
```

### 3. Edge cases cần handle

| Case | Mô tả | Xử lý |
|------|-------|-------|
| W3 | Worker nhận task rồi crash ngay (PEL stale) | XAUTOCLAIM sau visibility_timeout |
| W4 | Master crash sau XACK nhưng trước ghi DB | Không xảy ra — luôn ghi DB trước XACK |
| W5 | Worker đóng băng (alive nhưng không respond) | Heartbeat 15s timeout phát hiện |
| W6 | Worker cũ "hồi sinh" gửi kết quả stale | `attemptToken` mismatch → reject |
| W8 | Worker reconnect với cùng ID đang có session | Master reject REGISTER nếu worker-id đã active |
| M3 | Master crash sau pop Redis nhưng trước giao Worker | PEL idle timeout → XAUTOCLAIM → re-dispatch |

### 4. Custom test failover (ngoại lệ)

Custom test (`submissionId < 0`) **không có failover**:
- Không lưu vào Redis Stream
- Timeout 15s → `CompletableFuture.completeExceptionally()`
- HTTP request trả lỗi ngay cho client

### 5. Idempotency tại DB

```java
// Submission.finish() — idempotent
public synchronized void finish(TaskResult result) {
    if (this.status == SubmissionStatus.FINISHED) {
        log.warn("finish() called on already-finished submission {}", id);
        return;  // no-op
    }
    // ghi verdict, score, tests...
    this.status = SubmissionStatus.FINISHED;
}
```

### 6. Logging audit trail

Mọi sự kiện failover phải ghi vào `submission_events` (append-only):
```
REQUEUED: "Worker worker-2 disconnected after 15s timeout, attempt 2/3"
REJECTED: "Worker worker-1 busy, requeued without increment"
STALE_REJECTED: "Attempt token mismatch from worker-1, discarded"
```

## Quality checklist

- [ ] Heartbeat sequence diagram có đủ: chu kỳ, payload, timeout threshold
- [ ] `onWorkerDisconnected()` pseudocode đủ để agent implement
- [ ] `attemptToken` được giải thích rõ tại sao cần (split-brain scenario)
- [ ] `attemptToken` có trong: TASK_ASSIGN payload, DB column, TASK_RESULT validation
- [ ] 6 edge cases (W3, W4, W5, W6, W8, M3) đều có hướng xử lý cụ thể
- [ ] Custom test failover được tách riêng — không dùng cơ chế requeue
- [ ] `finish()` idempotent: không throw exception khi gọi 2 lần
- [ ] Mọi failover event đều được ghi vào `submission_events`
- [ ] Phân biệt rõ `attempt++` (worker mất kết nối) vs không tăng (worker từ chối vì bận)
- [ ] DB migration: thêm column `attempt_token VARCHAR` vào `submissions`

## Mapping báo cáo

- §8.7 Proposed Approach → Fault tolerance design
- §8.10 Implementation → Error handling mechanism
- §8.14 Novelty → attempt_token chống stale result, auto-failover
- §6 Requirements → Error handling: connection failure, timeout, duplicate request
