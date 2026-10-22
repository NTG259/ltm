# Spec: graded (Bài tập thực hành & Tiến độ học tập)

## Objective

Module `graded` hoàn thiện chu trình học tập trực tuyến trong CodeJudge LMS:
1. Cho phép Giảng viên/Admin gắn 1 hoặc nhiều bài tập từ Ngân hàng đề (`problems`) vào từng chủ đề (`course_units`).
2. Sinh viên đọc lý thuyết, sau đó bấm mở IDE làm bài tập thực hành.
3. Khi sinh viên nộp bài đạt điểm tối đa (**`AC`** từ Judge Worker), hệ thống **tự động ghi nhận hoàn thành chủ đề vào CSDL**.
4. Sinh viên cũng có thể chủ động đánh dấu hoàn thành/chưa hoàn thành theo ý muốn.
5. Thanh tiến độ học tập (% hoàn thành khóa học) được tính và lưu cố định trong cơ sở dữ liệu (`user_unit_progress`).

## Database Schema

```sql
CREATE TABLE IF NOT EXISTS course_unit_problems (
    id          BIGSERIAL PRIMARY KEY,
    unit_id     BIGINT NOT NULL REFERENCES course_units(id) ON DELETE CASCADE,
    problem_id  BIGINT NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
    order_index INT NOT NULL DEFAULT 1,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (unit_id, problem_id)
);

CREATE INDEX IF NOT EXISTS ix_unit_problems_unit ON course_unit_problems(unit_id);

CREATE TABLE IF NOT EXISTS user_unit_progress (
    id           BIGSERIAL PRIMARY KEY,
    user_id      BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    unit_id      BIGINT NOT NULL REFERENCES course_units(id) ON DELETE CASCADE,
    completed    BOOLEAN NOT NULL DEFAULT TRUE,
    completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, unit_id)
);

CREATE INDEX IF NOT EXISTS ix_user_unit_progress_user ON user_unit_progress(user_id);
```

## API Endpoints

| Method | Path | Auth | Mô tả |
|--------|------|------|-------|
| `GET` | `/api/courses/units/{unitId}/problems` | Required | Lấy danh sách bài tập được gắn vào unit (kèm trạng thái đã giải AC của user) |
| `POST` | `/api/courses/units/{unitId}/problems` | Admin | Gắn bài tập vào unit `{ "problemId": 1 }` |
| `DELETE` | `/api/courses/units/{unitId}/problems/{problemId}` | Admin | Gỡ bài tập khỏi unit |
| `GET` | `/api/courses/{courseId}/progress` | Required | Lấy tiến độ học của user cho khóa học: `{ "completedUnitIds": [1, 2], "percent": 50 }` |
| `POST` | `/api/courses/units/{unitId}/toggle-progress` | Required | Đánh dấu hoặc hủy đánh dấu hoàn thành một unit |

## Tự động kích hoạt (Auto-progress on AC)

Khi một bài nộp kết thúc với phán quyết `Verdict.AC` trong `JudgeMasterService`:
- Kiểm tra xem `problem_id` đó có thuộc bất kỳ `course_unit_problems` nào không.
- Nếu có, tự động tạo hoặc cập nhật bản ghi `user_unit_progress` (`completed = true`) cho sinh viên nộp bài.
