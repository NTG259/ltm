# Intent: Problem — PDF đề bài + bài tập cuối Unit

## Statement of Intent

| | |
|---|---|
| **Outcome** | Giảng viên tạo bài tập bằng cách upload PDF thay cho text, và gán bài tập vào cuối Unit trong Course |
| **User** | Giảng viên (tạo), sinh viên (làm bài + xem PDF đề) |
| **Why now** | Đề bài thực tế thường là PDF từ giáo trình; text editor hiện tại không đủ để format đề bài phức tạp |
| **Success** | Giảng viên upload PDF → sinh viên vào WorkspacePage thấy nút xem/download PDF thay vì statement text; cuối mỗi Unit có danh sách bài tập thực hành để làm |
| **Constraint** | PDF thay thế hoàn toàn statement text; bài tập thực hành gắn vào cuối Unit (không phải Lesson) |
| **Out of scope** | Render PDF inline trong trình duyệt (chỉ cần view/download), bài tập gắn vào Lesson, nhiều file đính kèm per bài tập |

## Scope chi tiết

### Phần 1: PDF đề bài

#### Backend

- Thêm column `statement_pdf_url VARCHAR` vào bảng `problems`
- `statement` (text hiện tại) vẫn giữ nguyên column nhưng không dùng khi có PDF
- `POST /api/problems/{id}/statement-pdf` — upload file PDF, lưu vào storage (local filesystem hoặc object storage), trả về URL
- `GET /api/problems/{id}` — trả thêm field `statementPdfUrl` trong response
- Chỉ giảng viên sở hữu bài tập mới được upload

#### Frontend (WorkspacePage)

- Nếu `statementPdfUrl` có giá trị: hiện nút **"Xem đề bài (PDF)"** + **"Tải xuống"** thay cho statement text
- Nếu không có PDF: fallback về statement text như hiện tại (backward compatible)
- Nút "Xem" mở PDF trong tab mới (`window.open(url, '_blank')`)
- Nút "Tải xuống" dùng `<a href={url} download>`

#### Storage

- MVP: lưu file vào `uploads/problems/` trên filesystem của server, serve qua `/api/files/problems/{filename}`
- Không cần object storage (S3/GCS) cho scope hiện tại

---

### Phần 2: Bài tập thực hành cuối Unit

#### Backend

- Thêm bảng `unit_exercises` (`unit_id`, `problem_id`, `order_index`)
- `GET /api/courses/{courseId}/units/{unitId}/exercises` — danh sách bài tập cuối unit
- `POST /api/courses/{courseId}/units/{unitId}/exercises` — giảng viên gán bài tập vào unit (body: `{ problemId, orderIndex }`)
- `DELETE /api/courses/{courseId}/units/{unitId}/exercises/{problemId}` — bỏ gán

#### Frontend (Course)

- Trang chi tiết Unit: sau danh sách Lesson, thêm section **"Bài tập thực hành"**
- Hiển thị danh sách bài tập với tên + nút "Làm bài" → link vào WorkspacePage
- Trang quản lý Unit (giảng viên): thêm UI chọn bài tập từ danh sách bài tập của mình để gán

## Confirmed

Đã xác nhận bởi người dùng — 2026-10-28.
