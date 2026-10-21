# Edge Cases — Distributed Judge (Redis Architecture)

> Scope: Redis-based queue, priority tiers (contest > practice > custom test),
> full idempotency, multi-tenant, real-time metrics.
> Target: 100–200 students; stress-test to 1000.

---

## 1. Worker lifecycle

| # | Case | Hậu quả | Câu hỏi cần trả lời |
|---|------|----------|---------------------|
| W1 | Worker chết **giữa compile** | Task còn trong Redis PEL → requeue | Attempt counter tăng ở đâu? Redis hay DB? |
| W2 | Worker chết sau khi chạy **7/10 test** | Requeue từ đầu — không lưu progress | Có cần lưu partial result không, hay luôn luôn chạy lại toàn bộ? |
| W3 | Worker **nhận task từ Redis rồi crash ngay** (chưa kịp xử lý gì) | Task nằm trong PEL, không ai xử lý | Visibility timeout bao lâu là đủ? (compile 20s + N × time_limit) |
| W4 | Worker **gửi kết quả xong rồi crash** trước khi Master ACK Redis | Master không nhận → PEL retry → worker khác nhận → chấm lại | Idempotency: check `submission.status != FINISHED` trước khi ghi DB |
| W5 | Worker **đóng băng** (process còn sống, TCP connected, không respond heartbeat) | Heartbeat timeout 15s phát hiện | Phân biệt "đang compile chậm" vs "đóng băng thật" → cần task-level keepalive |
| W6 | Worker **mất mạng với Master** nhưng vẫn đang chạy bình thường | Master failover → worker khác nhận → **2 worker cùng chấm 1 bài** | Idempotency bắt buộc; dùng `attempt_token` trong task payload |
| W7 | **Tất cả worker chết cùng lúc** | Queue đầy, không ai chấm | Queue persistent → bài an toàn; alert ngay khi worker count = 0 |
| W8 | Worker cũ **reconnect với cùng worker-id** đang có task in-flight | State mới/cũ lẫn lộn | Master reject registration nếu worker-id đã có session active |
| W9 | Worker **rất chậm** (HDD I/O spike, chấm 3× thời gian bình thường) | Vẫn alive, nhưng throughput giảm; các worker khác idle | Least-Busy phải dựa trên queue-depth thực, không chỉ "có busy không" |

---

## 2. Master lifecycle

| # | Case | Vấn đề | Câu hỏi |
|---|------|---------|---------|
| M1 | Master restart khi Redis queue có bài | Queue persistent → OK; không cần rebuild từ DB | Cần verify: các PEL entry có được re-claim không? |
| M2 | Master restart khi worker đang chấm | Worker mất TCP → abandon → reconnect → Master thấy PEL → requeue | Logic re-claim PEL khi Master boot lên |
| M3 | Master crash **sau khi pop task từ Redis nhưng trước khi giao cho worker** | Task nằm trong PEL không ai xử lý mãi mãi | PEL idle timeout + recovery job định kỳ |
| M4 | Master crash **giữa lúc ghi DB** kết quả | DB: `TESTING`; Redis: đã ACK → task biến mất | Thứ tự: **ghi DB trước, ACK Redis sau** |
| M5 | Master OOM (out of memory) | Có thể corrupt in-flight state | Giữ minimal state trong RAM; source of truth là Redis + DB |

---

## 3. Redis

| # | Case | Vấn đề | Câu hỏi |
|---|------|---------|---------|
| R1 | Redis **connection drop tạm thời** (vài giây) | Master không push/pop được | Retry với exponential backoff; queue submissions locally? |
| R2 | Redis **restart** không có persistence (AOF/RDB tắt) | Toàn bộ queue mất | **Bắt buộc bật AOF**; hoặc rebuild queue từ DB rows `IN_QUEUE` khi detect Redis empty |
| R3 | Redis **full** (`maxmemory` reached) | Push mới bị reject silently | Alert + reject submission với lỗi rõ ràng; đừng để mất bài im lặng |
| R4 | **Visibility timeout** của Redis Streams quá ngắn | Bài compile lâu bị tái giao dù worker đang chạy tốt | Timeout > max_judge_time = 20s compile + N_tests × time_limit_per_test |
| R5 | **Visibility timeout** quá dài | Worker chết thật nhưng task không được requeue kịp | Cân bằng với W5; cần task-level heartbeat từ worker |

---

## 4. Priority queue & starvation

| # | Case | Vấn đề | Câu hỏi |
|---|------|---------|---------|
| P1 | Contest A có 500 bài, Contest B có 10 bài | Contest B starvation nếu FIFO đơn thuần | Weighted fair queuing, hoặc queue riêng per-contest? |
| P2 | **Practice submissions** chiếm hết worker trong giờ contest | Contest latency tăng | Priority phải hard-preempt, không chỉ soft-priority |
| P3 | Contest kết thúc nhưng bài **vẫn còn trong queue** | Nên chấm tiếp hay drop? Điểm có được tính? | Policy cần rõ: cutoff cứng hay "chấm xong, không tính điểm"? |
| P4 | Student **spam submit** 10 lần trong 5 giây | Choán hết worker, student khác đói | Per-student rate limit; max 1 in-flight per student per contest? |
| P5 | **Custom test** của student chiếm slot trong contest peak | Latency contest tăng | Custom test = lowest priority, có thể reject luôn nếu queue depth cao |
| P6 | **Priority inversion**: practice bài nặng (100 tests) block contest bài nhẹ (5 tests) | Dù priority đúng, wall-clock vẫn bị block | Preemption hay time-slicing không khả thi với judge; chỉ giải bằng worker pool riêng? |

---

## 5. Idempotency

| # | Case | Vấn đề | Giải pháp |
|---|------|---------|-----------|
| I1 | Worker gửi TASK_RESULT **2 lần** (network retry) | DB ghi đè lần 2 | Check `status != FINISHED` trước `finish()` — nhưng race condition nếu 2 thread xử lý cùng lúc |
| I2 | Failover xong, **worker cũ vẫn gửi kết quả** về | Master không biết đây là kết quả stale | Dùng `attempt_token` (UUID) trong task payload; reject nếu token không khớp |
| I3 | Master xử lý TASK_RESULT **2 lần** do message duplicate trong Redis | `finish()` được gọi 2 lần | `finish()` phải idempotent: nếu đã FINISHED thì no-op, không throw |
| I4 | **DB và Redis out-of-sync**: DB nói `FINISHED`, Redis vẫn có task trong queue | Worker chấm lại bài đã xong | Check DB trước khi bắt đầu chấm: nếu `FINISHED` thì ACK Redis và bỏ qua |
| I5 | **DB và Redis out-of-sync**: DB nói `IN_QUEUE`, Redis queue trống (sau crash) | Bài bị stuck mãi | Recovery job: scan DB rows `IN_QUEUE`/`COMPILING`/`TESTING` không có PEL entry → re-push |

---

## 6. Multi-tenant

| # | Case | Vấn đề | Câu hỏi |
|---|------|---------|---------|
| T1 | Admin **xóa contest** khi còn bài trong queue | Worker nhận task → contest/problem không còn → crash hoặc wrong result | Master check contest tồn tại trước khi dispatch; worker cũng cần handle gracefully |
| T2 | Admin **xóa problem/test cases** khi bài đang chấm | Worker crash giữa chừng | Soft-delete; hoặc worker trả về verdict `SYSTEM_ERROR` |
| T3 | **Cùng 1 student** trong 2 contest submit cùng lúc | 2 task cùng lúc từ 1 student | OK về logic; nhưng rate limit per-student hay per-contest? |
| T4 | Contest A và Contest B dùng **cùng problem** | Test cases được share; không có vấn đề về isolation | Confirm: test case files trên worker là read-only? |
| T5 | Admin **reset bài thi** (xóa toàn bộ submissions của 1 contest) khi đang có bài in-flight | DB rows bị xóa; worker vẫn đang chấm | Cần cancel signal trước khi xóa |

---

## 7. Load spike

| # | Case | Vấn đề | Câu hỏi |
|---|------|---------|---------|
| L1 | **1000 submissions cùng lúc** (hết giờ contest, mọi người submit cuối) | Queue depth tăng đột ngột | Max queue depth bao nhiêu trước khi reject? Estimated wait time phải hiển thị |
| L2 | **Tất cả worker bận**, queue đầy | New submission blocked chờ | Reject hay queue? Nếu queue thì timeout bao lâu? |
| L3 | **Worker mới join** giữa peak | Nên nhận việc ngay lập tức | Dispatch logic phải pick new worker khi nó register |
| L4 | Worker có **hardware chậm hơn** các worker khác | Luôn có work, nhưng throughput thấp hơn | Least-Busy nên tính weighted by latency_ms, không chỉ queue count |

---

## 8. Real-time metrics edge cases

| # | Case | Vấn đề |
|---|------|---------|
| Met1 | Worker chết → throughput giảm nhưng không có alert | Admin không biết hệ thống đang yếu đi |
| Met2 | Queue depth tăng nhanh, estimated wait time vọt lên | Dashboard phải reflect realtime, không cache cũ |
| Met3 | **Counter drift**: Master restart reset counter in-memory | Metrics chart có spike/gap ảo |
| Met4 | **Metric lag**: worker report xong nhưng dashboard delay 30s | Contest admin thấy thông tin cũ khi ra quyết định |

---

## 9. Operational

| # | Case | Cần |
|---|------|-----|
| O1 | Admin muốn **cancel** bài đang chấm | Cancel signal tới worker; worker ACK và dừng |
| O2 | Admin muốn **requeue** bài `FAILED` thủ công | API re-push vào Redis với attempt reset |
| O3 | Admin muốn **ưu tiên** 1 bài cụ thể ngay lập tức | `LPUSH` thay vì `RPUSH` cho priority cao nhất |
| O4 | **Queue depth** quá cao → reject submission với lỗi thân thiện | "Hệ thống đang tải cao, thử lại sau X phút" |

---

## Checklist trước khi design

- [ ] Chọn Redis Streams hay Redis List? (Streams có PEL built-in, List cần manual processing-set)
- [ ] `attempt_token` lưu ở đâu? (Redis entry hay DB column?)
- [ ] Thứ tự đảm bảo: ghi DB → ACK Redis (không bao giờ ngược lại)
- [ ] Recovery job interval bao lâu? (scan DB rows stuck > visibility_timeout)
- [ ] Visibility timeout = bao nhiêu giây? (function của N_tests và time_limit)
- [ ] Worker pool có chia theo priority tier không, hay dùng chung?
- [ ] Rate limit per-student: enforce ở Master (trước khi push Redis) hay ở queue?
