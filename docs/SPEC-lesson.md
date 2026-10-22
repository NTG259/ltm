# Spec: lesson

## Objective

Module `lesson` cung cấp hệ thống quản lý và biên soạn nội dung bài giảng chi tiết (Lý thuyết Markdown + Mã nguồn C++ minh họa + Dữ liệu đầu vào STDIN) cho từng chủ đề (`course_units`) trong hệ thống khóa học CodeJudge LMS.

**User stories:**
- **Giảng viên / Admin**: Có thể trực tiếp biên soạn, cập nhật bài giảng lý thuyết (hỗ trợ Markdown, code blocks C++, lưu ý), nạp code ví dụ mẫu và dữ liệu kiểm thử STDIN trực quan từ trang quản trị mà không cần sửa code web.
- **Học viên**: Khi mở bất kỳ chủ đề nào, học viên đọc được bài giảng phong phú, định dạng chuẩn mực; có thể xem trước mã nguồn C++ mẫu và bấm nút "Chạy thử ngay (Try it)" để thử nghiệm ngay lập tức.

## Schema (Database)

Bảng `course_lessons`:
```sql
CREATE TABLE IF NOT EXISTS course_lessons (
    id             BIGSERIAL PRIMARY KEY,
    unit_id        BIGINT NOT NULL UNIQUE REFERENCES course_units(id) ON DELETE CASCADE,
    theory_content TEXT NOT NULL,
    sample_code    TEXT,
    sample_input   TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_course_lessons_unit ON course_lessons(unit_id);
```

## API Endpoints

| Method | Path | Auth | Mô tả |
|--------|------|------|-------|
| `GET` | `/api/courses/units/{unitId}/lesson` | Required | Lấy nội dung bài giảng chi tiết của một unit (trả về mẫu mặc định nếu chưa soạn) |
| `PUT` | `/api/courses/units/{unitId}/lesson` | Admin only | Tạo mới hoặc cập nhật bài giảng cho chủ đề |

### Request Payload (PUT):
```json
{
  "theoryContent": "## 1. Khái niệm cốt lõi\n...",
  "sampleCode": "#include <iostream>\n...",
  "sampleInput": "10 20"
}
```

### Response Payload:
```json
{
  "id": 1,
  "unitId": 1,
  "theoryContent": "...",
  "sampleCode": "...",
  "sampleInput": "...",
  "updatedAt": 1729528000000
}
```
