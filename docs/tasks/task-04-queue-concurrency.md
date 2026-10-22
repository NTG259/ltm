# Task 04 — Queue & Concurrency

**Dependency:** Task 01 (architecture), Task 03 (protocol — biết payload của TASK_ASSIGN).

## Objective

Thiết kế cơ chế hàng đợi bền vững với Redis Streams và thuật toán phân phối tải least-busy, đảm bảo thread-safe khi hàng trăm bài nộp đồng thời.

## Research areas

- **Redis Streams** vs Redis List: PEL (Pending Entry List), consumer groups, `XADD`/`XREADGROUP`/`XACK`/`XPENDING`
- **Priority queue** với Redis: dùng 3 stream riêng vs 1 stream + priority field
- **Least-busy dispatch**: cách đo "bận" (busy flag? queue depth? latency?)
- **Idempotency**: ghi DB trước hay ACK Redis trước? (thứ tự bắt buộc)
- **Thread safety**: `synchronized` vs `ReentrantLock` vs `StampedLock` cho dispatch
- **Visibility timeout**: tính toán giá trị phù hợp (compile_time + N × time_limit)

## Design deliverables

### 1. Redis Streams schema

**3 stream với priority tier:**
```
judge:contest   — priority cao nhất (thi đang diễn ra)
judge:practice  — priority trung bình (luyện tập)
judge:custom    — priority thấp nhất (custom test, có thể reject khi tải cao)
```

**Message fields trong mỗi stream entry:**
```
submissionId    : string (long)
attemptToken    : string (UUID)
sourceCode      : string (base64 nếu có binary)
timeLimitMs     : int
memoryLimitMb   : int
checker         : string (lines|tokens|exact)
stopOnFirst     : bool
testsJson       : string (JSON array của test cases)
enqueuedAt      : long (epoch ms)
attempt         : int
```

**Consumer group:** Master tạo 1 consumer group `master-dispatch` trên mỗi stream.

### 2. Dispatch algorithm

```
dispatchNext():
  for stream in [contest, practice, custom]:
    if stream has pending message:
      worker = pickLeastBusy(activeWorkers)
      if worker == null: return  // không có worker rảnh
      msg = XREADGROUP(stream, consumer=worker.id, count=1)
      sendTaskAssign(worker, msg)
      worker.busy = true
      worker.currentTask = submissionId
      // KHÔNG XACK ngay — ACK sau khi ghi DB xong
```

**pickLeastBusy():**
```
// Tiêu chí: latencyMs thấp nhất trong số worker không busy
return activeWorkers.values()
  .filter(w -> !w.busy && !w.closed)
  .min(Comparator.comparingLong(WorkerSession::getLatencyMs))
```

### 3. Thứ tự đảm bảo idempotency (CRITICAL)

```
Worker → TASK_RESULT
  ↓
Master writes verdict to DB (submission.finish())
  ↓ [nếu DB thành công]
Master XACK message từ Redis stream
  ↓
Master set worker.busy = false
  ↓
dispatchNext()
```

**Không bao giờ XACK trước khi ghi DB.** Nếu Master crash sau khi XACK nhưng trước khi ghi DB → bài biến mất. Ngược lại nếu crash sau khi ghi DB nhưng trước XACK → bài được chấm lại, idempotency check ngăn ghi đè.

### 4. Recovery khi Master restart

```
@PostConstruct start():
1. Claim PEL entries idle > visibility_timeout (XAUTOCLAIM)
2. Re-dispatch các entries đó với attempt++ 
3. Scan DB: submissions WHERE status IN ('IN_QUEUE','COMPILING','TESTING')
   AND NOT có PEL entry tương ứng → re-push vào stream
4. Start worker TCP listener
5. Start heartbeat scheduler
```

### 5. Visibility timeout calculation

```
visibility_timeout = compile_timeout + (max_tests × time_limit_per_test) + buffer
                   = 20s           + (100        × 10s               ) + 30s
                   = 1050s         ≈ 18 phút (worst case)
```

Task-level keepalive: Worker gửi `TASK_STATUS` mỗi 10s khi đang chấm để reset timeout.

### 6. Thread safety

- `dispatchNext()`: `synchronized` trên instance — đơn giản, không bottleneck vì call frequency thấp
- `activeWorkers`: `ConcurrentHashMap` — read nhiều, write ít
- `worker.send()`: `synchronized` trên `DataOutputStream` của từng worker — tránh interleaved frames

## Quality checklist

- [ ] 3 stream Redis được đặt tên rõ ràng và lý do priority được giải thích
- [ ] Tất cả fields của stream entry được liệt kê với kiểu dữ liệu
- [ ] `dispatchNext()` pseudocode đủ chi tiết để agent implement
- [ ] `pickLeastBusy()` có tiêu chí rõ ràng (latencyMs, không chỉ "ít bận nhất")
- [ ] Thứ tự "ghi DB → XACK Redis" được giải thích tại sao (idempotency)
- [ ] Visibility timeout có công thức tính cụ thể
- [ ] Task-level keepalive: Worker gửi gì và Master xử lý thế nào
- [ ] Recovery khi restart: xử lý cả PEL stale và DB orphan
- [ ] Rate limit per-student được thiết kế (chặn ở đâu, ngưỡng bao nhiêu)
- [ ] Khi `judge:custom` quá tải thì reject hay queue — có quy tắc rõ

## Mapping báo cáo

- §8.7 Proposed Approach → Queue design, Dispatch algorithm
- §8.10 Implementation → Concurrency mechanism
- §8.14 Novelty → Redis Streams priority queue, least-busy dispatch
- §9 Experimental → đo throughput khi queue đầy
