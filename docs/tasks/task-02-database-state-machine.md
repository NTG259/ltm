# Task 02 — Database & State Machine

**Dependency:** Task 01 (cần biết component nào cần lưu state).

## Objective

Thiết kế schema chuẩn hóa và máy trạng thái (state machine) cho vòng đời bài nộp — nền tảng để mọi component khác đọc/ghi dữ liệu nhất quán.

## Research areas

- PostgreSQL trigger và constraint dùng để enforce business rules tại tầng DB (không để lọt lên application layer)
- Partial index để tăng tốc query rebuild queue khi restart
- Idempotency tại DB: khi Master ghi TASK_RESULT 2 lần không làm corrupt data
- TIMESTAMPTZ vs BIGINT cho timestamp — tradeoff với frontend

## Design deliverables

1. **Schema đầy đủ** cho tất cả bảng (kể cả bảng đã có trong codebase, ghi rõ bảng nào thay đổi):
   - `users`, `sessions`
   - `problems`, `test_cases`
   - `contests`, `contest_problems`, `contest_participants`
   - `submissions`, `submission_test_results`, `submission_events`
   - `workers`, `system_logs`
   - `classrooms`, `classroom_students`, `classroom_contests`

2. **State machine diagram** cho `submissions.status`:
   ```
   IN_QUEUE → COMPILING → TESTING → FINISHED
                ↓              ↓
            IN_QUEUE ← (Failover, attempt ≤ 3)
                ↓
             FAILED (attempt > 3)
   ```
   Ghi rõ: điều kiện chuyển trạng thái, ai trigger, constraint nào enforce.

3. **Business rule enforcement** — bảng nào dùng trigger/constraint để chặn vi phạm:
   - `trg_submissions_contest`: chặn nộp bài ngoài giờ thi
   - `CHECK (status = 'FINISHED') = (verdict IS NOT NULL)`: hoàn tất ↔ có verdict
   - `attempt ≤ 3`: giới hạn failover

4. **Flyway migration plan** — danh sách file migration cần tạo/sửa:
   - V1–V7: đã có
   - V8+: cần thêm gì? (attempt_token column? Redis job_id column?)

5. **Views cho API** — danh sách view cần có:
   | View | Phục vụ API |
   |------|-------------|
   | `v_leaderboard` | `GET /api/leaderboard` |
   | `v_contest_standings` | `GET /api/contests/:id/standings` |
   | `v_contest_cells` | Ô ICPC per user/problem |
   | `v_problem_stats` | `GET /api/problems` |

6. **Idempotency design**: `finish()` phải no-op nếu đã `FINISHED`.

## Quality checklist

- [ ] Tất cả bảng có PRIMARY KEY, FK constraints, và NOT NULL đúng chỗ
- [ ] State machine: mọi transition đều có điều kiện rõ ràng (ai trigger, khi nào hợp lệ)
- [ ] Không có transition nào "ẩn" — tất cả đều documented
- [ ] Trigger `trg_submissions_contest` spec đầy đủ (điều kiện chặn)
- [ ] `finish()` idempotent: gọi 2 lần không gây lỗi hoặc dữ liệu sai
- [ ] Ghi rõ index nào quan trọng cho performance (partial index `ix_submissions_pending`)
- [ ] Flyway migration: V8+ spec rõ nếu cần thêm column mới
- [ ] Schema đủ cho agent viết entity Java và repository mà không cần hỏi lại
- [ ] View SQL được viết ra (không chỉ liệt kê tên view)

## Mapping báo cáo

- §8.7 Proposed Approach → Data flow, Database design
- §8.10 Implementation → Data structure
- §8.19 Appendix → Database schema
