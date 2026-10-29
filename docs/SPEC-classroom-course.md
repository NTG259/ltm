# Spec: Khóa học gắn với Lớp học

**Intent:** `docs/intent/classroom-course-flow.md`  
**Phiên bản Flyway tiếp theo:** V13

---

## Mục tiêu

- Sinh viên chỉ truy cập khóa học qua lớp học được xếp — không tự duyệt/đăng ký
- Admin / Giảng viên gán một khóa học duy nhất cho mỗi lớp
- Mỗi chương (course_unit) có thêm danh sách file PDF tài liệu
- Trang lớp học của sinh viên hiển thị khóa học gắn kèm (kỳ thi + khóa học trong cùng một trang)

---

## Những gì đã có (không đổi)

| Bảng | Vai trò |
|------|---------|
| `courses` | Khóa học (tiêu đề, mô tả, published) |
| `course_units` | Chương (order_index, title, course_id) |
| `course_unit_problems` | Bài tập gắn với chương (problem_id FK) |
| `course_lessons` | Nội dung lý thuyết Markdown + code mẫu mỗi chương |
| `user_unit_progress` | Tiến độ hoàn thành chương của sinh viên |

---

## DB — V13

```sql
-- 1. Gán khóa học cho lớp (1 lớp : 1 khóa học)
CREATE TABLE IF NOT EXISTS classroom_courses (
    classroom_id BIGINT NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
    course_id    BIGINT NOT NULL REFERENCES courses(id)    ON DELETE CASCADE,
    assigned_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (classroom_id),           -- 1 lớp tối đa 1 khóa
    UNIQUE (classroom_id)
);

CREATE INDEX IF NOT EXISTS ix_classroom_courses_course ON classroom_courses(course_id);

-- 2. File PDF tài liệu gắn với từng chương
CREATE TABLE IF NOT EXISTS course_unit_files (
    id          BIGSERIAL PRIMARY KEY,
    unit_id     BIGINT       NOT NULL REFERENCES course_units(id) ON DELETE CASCADE,
    filename    VARCHAR(255) NOT NULL,           -- tên file gốc hiển thị
    file_key    VARCHAR(512) NOT NULL,           -- path lưu trữ (DB / object storage)
    file_size   BIGINT,                          -- bytes
    order_index INT          NOT NULL DEFAULT 1,
    uploaded_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_course_unit_files_unit ON course_unit_files(unit_id, order_index);
```

---

## API Endpoints

### Classroom ↔ Course

| Method | Path | Auth | Mô tả |
|--------|------|------|-------|
| `GET` | `/api/classrooms/{id}/course` | Student (chỉ lớp của mình), Admin, Lecturer | Lấy thông tin khóa học gắn với lớp kèm danh sách chương, file, bài tập |
| `PUT` | `/api/classrooms/{id}/course/{courseId}` | Admin, Lecturer (lớp của mình) | Gán / đổi khóa học cho lớp |
| `DELETE` | `/api/classrooms/{id}/course` | Admin, Lecturer (lớp của mình) | Huỷ gán khóa học |

#### `GET /api/classrooms/{id}/course` — Response

```json
{
  "courseId": 1,
  "title": "Lập trình C++ Cơ bản",
  "description": "...",
  "units": [
    {
      "id": 3,
      "title": "Chủ đề 1: Nhập xuất cin/cout",
      "orderIndex": 1,
      "files": [
        {
          "id": 7,
          "filename": "slides-chuong1.pdf",
          "fileSize": 204800,
          "orderIndex": 1
        }
      ],
      "problems": [
        {
          "id": 1,
          "title": "A + B Problem",
          "difficulty": "EASY",
          "orderIndex": 1
        }
      ]
    }
  ]
}
```

> Trả `404` nếu lớp chưa được gán khóa học.  
> Sinh viên chỉ gọi được endpoint này nếu thuộc lớp đó (`classroom_students`).

---

### File PDF

| Method | Path | Auth | Mô tả |
|--------|------|------|-------|
| `POST` | `/api/courses/units/{unitId}/files` | Admin, Lecturer | Upload file PDF (multipart/form-data) |
| `DELETE` | `/api/courses/units/{unitId}/files/{fileId}` | Admin, Lecturer | Xoá file |
| `GET` | `/api/courses/units/{unitId}/files/{fileId}/download` | Required | Tải file PDF |

`POST` request: `Content-Type: multipart/form-data`, field `file` (PDF), field `filename` (optional override).  
`POST` response:
```json
{ "id": 7, "filename": "slides-chuong1.pdf", "fileSize": 204800, "orderIndex": 1 }
```

**Giới hạn:** tối đa 20 MB mỗi file, chỉ chấp nhận `application/pdf`.

---

## Frontend

### 1. Ẩn `/courses` khỏi menu sinh viên

File: `frontend/src/components/AppLayout.jsx`

```diff
- { key: '/courses', icon: <ReadOutlined />, label: <Link to="/courses">Khóa học</Link> },
```

Sinh viên không còn truy cập `/courses` qua nav. Route vẫn có thể giữ hoặc redirect về `/my-classrooms`.

---

### 2. `MyClassroomDetailPage` — thêm tab Khóa học

Trang hiện tại chỉ có danh sách kỳ thi. Thêm **Tabs** với 2 tab:

- **Tab 1 — Kỳ thi** (nội dung như hiện tại)
- **Tab 2 — Khóa học** (gọi `GET /api/classrooms/{id}/course`)

Giao diện tab Khóa học:
```
┌─ Collapse: Chương 1: Nhập xuất ────────────────────────────┐
│  📄 slides-chuong1.pdf                    [Tải xuống]       │
│  📄 bai-tap-mau.pdf                       [Tải xuống]       │
│  ─────────────────────────────────────────────────────────  │
│  Bài tập:                                                   │
│  [1] A + B Problem    EASY    [→ Làm bài]                   │
└─────────────────────────────────────────────────────────────┘
┌─ Collapse: Chương 2: Biến và Kiểu dữ liệu ─────────────────┐
│  ...                                                         │
└─────────────────────────────────────────────────────────────┘
```

- Dùng `Collapse` (Ant Design) cho danh sách chương
- "Làm bài" → `navigate('/problems/:id')`
- "Tải xuống" → `GET /api/courses/units/{unitId}/files/{fileId}/download`

---

### 3. Admin/Lecturer — gán khóa học cho lớp

File: `frontend/src/pages/admin/AdminClassroomDetailPage.jsx`

Thêm section **Khóa học** trong trang quản lý lớp:
- Hiển thị khóa học đang gán (nếu có)
- Nút **Gán khóa học** → modal Select khóa học từ danh sách `GET /api/courses`
- Nút **Huỷ gán**

---

## Các việc cần làm (theo thứ tự)

| # | Phạm vi | Việc |
|---|---------|------|
| 1 | DB | Flyway V13: tạo `classroom_courses` + `course_unit_files` |
| 2 | Backend | Entity + Repository: `ClassroomCourse`, `CourseUnitFile` |
| 3 | Backend | `ClassroomController`: `GET/PUT/DELETE /api/classrooms/{id}/course` |
| 4 | Backend | `CourseUnitFileController`: upload/download/delete PDF |
| 5 | Frontend | Ẩn `/courses` khỏi nav sinh viên |
| 6 | Frontend | `MyClassroomDetailPage`: thêm Tabs + tab Khóa học |
| 7 | Frontend | `AdminClassroomDetailPage`: thêm section gán khóa học |
| 8 | Mock API | Thêm mock cho `getClassroomCourse`, `assignCourse`, `uploadUnitFile` |
