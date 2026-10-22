# Task 07 — Experimental Setup & Measurement

**Dependency:** Tất cả cụm 1–6 phải implement xong trước khi đo.

## Objective

Thiết kế kịch bản thực nghiệm, công cụ đo lường, và cách thu thập số liệu thực để chứng minh hệ thống đạt gần đến NFR. Đây là phần **bằng chứng** cho toàn bộ báo cáo.

## Research areas

- **Locust** hoặc **k6**: load testing tool phù hợp cho HTTP + WebSocket
- **Redis `XLEN`, `XPENDING`**: đo queue depth và wait time
- **Prometheus + metrics endpoint**: Master expose metrics gì
- **Cách tính percentile** (p50, p95, p99) từ raw data
- **Concurrent submission simulation**: viết script gửi N bài cùng lúc và track từng bài

## Non-functional requirements (NFR) — thước đo

| ID | NFR | Target | Cách đo |
|----|-----|--------|---------|
| NFR-1 | Concurrent submissions không drop | ≥ 50 bài / lần | Gửi 50 bài đồng thời, đếm bài có verdict |
| NFR-2 | Queue wait time p95 (3 workers) | < 2 000 ms | `enqueuedAt` → `assignedAt` timestamp |
| NFR-3 | Worker throughput | ≥ 10 submissions/phút/worker | Đếm FINISHED / thời gian |
| NFR-4 | Worker utilization | ≥ 80% khi queue đầy | `WORKER_UPDATE` WebSocket events |
| NFR-5 | Queue durability khi restart | 0 bài mất | Gửi 10 bài, kill Master, restart, đếm verdict |
| NFR-6 | Memory isolation | 0 bài vượt MLE mà không bị kill | Gửi bài cố tình OOM, kiểm tra verdict |
| NFR-7 | Failover thành công | ≥ 95% bài được chấm lại | Kill worker đang chấm, kiểm tra requeue |

## Design deliverables

### 1. Test scenarios

**Scenario A — Throughput (NFR-1, 3, 4)**
```
Setup: 3 workers, queue rỗng
Input: 50 submissions cùng lúc (bài A+B đơn giản, chạy 100ms)
Measure:
  - Thời gian từ lúc gửi đến lúc tất cả có verdict
  - Worker utilization % (busy_time / total_time)
  - Bài nào bị drop (nếu có)
Expected: tất cả 50 bài có verdict trong < 60s, utilization > 80%
```

**Scenario B — Queue wait time (NFR-2)**
```
Setup: 1 worker (bottleneck), 20 submissions
Input: gửi 20 bài liên tiếp
Measure:
  - t_enqueue: lúc gửi POST /submissions
  - t_assign: lúc nhận SUBMISSION_UPDATE{status:COMPILING}
  - wait_time = t_assign - t_enqueue
Metric: p50, p95 của wait_time
Expected: p95 < 2000ms
```

**Scenario C — Queue durability (NFR-5)**
```
Setup: 3 workers, 10 submissions đang IN_QUEUE
Action: kill Master (SIGKILL)
Wait: 5 giây
Action: restart Master
Measure: đếm submissions có verdict sau restart
Expected: 10/10 submissions được chấm
```

**Scenario D — Memory isolation (NFR-6)**
```
Input: C++ program cấp phát 2 GB memory (vượt MLE = 256 MB)
Expected: verdict = MLE, không ảnh hưởng worker process
Verify: worker vẫn nhận bài tiếp theo bình thường
```

**Scenario E — Failover (NFR-7)**
```
Setup: 2 workers, 5 submissions đang chấm
Action: kill worker đang xử lý bài #3 (SIGKILL)
Measure: 
  - Thời gian từ disconnect đến requeue (≤ 20s)
  - Bài #3 có được chấm lại bởi worker còn lại không
Expected: bài #3 requeued trong 15s, verdict cuối cùng là đúng
```

### 2. Công cụ đo lường

**Load generator (Python script):**
```python
# load_test.py
async def submit_batch(n: int, problem_id: int):
    async with aiohttp.ClientSession() as session:
        tasks = [submit_one(session, problem_id) for _ in range(n)]
        results = await asyncio.gather(*tasks)
    return results

def measure_wait_time(submission_id: int):
    # Lắng nghe WebSocket SUBMISSION_UPDATE
    # Ghi t_enqueue khi gửi, t_compiling khi nhận status COMPILING
    pass
```

**Metrics collector:**
```python
# Đọc từ WebSocket stream WORKER_UPDATE mỗi 1s
# Ghi: timestamp, worker_id, busy, currentTask, queueSize
# Tính: utilization = sum(busy_seconds) / total_seconds
```

### 3. Data collection format

```csv
# scenario_a_throughput.csv
submission_id, enqueued_at, assigned_at, finished_at, verdict, worker_id
1001, 1700000000000, 1700000000150, 1700000000523, AC, worker-1
1002, 1700000000001, 1700000000151, 1700000000524, WA, worker-2
...
```

```csv
# scenario_b_wait_time.csv
submission_id, wait_time_ms
1001, 142
1002, 387
...
```

### 4. Tables cho báo cáo

**Table 1: Throughput**
| Workers | Submissions | Duration (s) | Throughput (sub/min) | Drop rate |
|---------|-------------|--------------|----------------------|-----------|
| 1 | 20 | ? | ? | ? |
| 3 | 50 | ? | ? | ? |
| 5 | 100 | ? | ? | ? |

**Table 2: Queue wait time**
| Load level | p50 (ms) | p95 (ms) | p99 (ms) |
|------------|----------|----------|----------|
| 10 subs/min | ? | ? | ? |
| 30 subs/min | ? | ? | ? |
| 50 subs/min | ? | ? | ? |

**Table 3: NFR achievement**
| NFR | Target | Measured | Met? |
|-----|--------|----------|------|
| Concurrent (NFR-1) | ≥ 50 | ? | ? |
| Wait time p95 (NFR-2) | < 2000ms | ? | ? |
| Throughput (NFR-3) | ≥ 10/min/worker | ? | ? |
| Durability (NFR-5) | 0 bài mất | ? | ? |

## Quality checklist

- [ ] NFR table có target cụ thể (số, không phải "nhanh hơn")
- [ ] Mỗi scenario có: setup, input, action, metric, expected outcome
- [ ] Script đo lường thực sự chạy được (không phải pseudo-code)
- [ ] Data collection format rõ ràng — CSV fields được đặt tên
- [ ] Scenario D (memory isolation) verify sandbox thực sự hoạt động
- [ ] Scenario E (failover) đo được thời gian detect + requeue
- [ ] Tables cho báo cáo có cấu trúc sẵn — chỉ cần điền số
- [ ] Ghi rõ hardware specs nơi chạy thực nghiệm (CPU, RAM, OS)
- [ ] Mỗi scenario có ít nhất 3 lần đo để lấy trung bình
- [ ] Kết quả "không đạt NFR" cũng phải có trong báo cáo (Discussion §8.13)

## Mapping báo cáo

- §8.11 Experimental Setup
- §8.12 Results (điền số vào tables)
- §8.13 Discussion (giải thích tại sao đạt/không đạt)
- §9 Yêu cầu thực nghiệm: concurrent submissions, queue wait time, throughput, worker utilization
