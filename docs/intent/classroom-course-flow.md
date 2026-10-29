# Intent: Luồng Lớp học – Khóa học (Sinh viên)

**Ngày:** 2026-10-29  
**Trạng thái:** Đã xác nhận

## Vấn đề

Sinh viên hiện có thể tự duyệt và đăng ký khóa học qua `/courses`. Đây là sai nghiệp vụ.

## Luồng đúng

1. Admin/giảng viên tạo lớp học
2. Admin thêm sinh viên vào lớp (qua CSV import)
3. Admin gán **một** khóa học cho lớp (1 lớp : 1 khóa học)
4. Sinh viên đăng nhập → vào tab **Lớp học** → bấm vào lớp → thấy **kỳ thi + nội dung khóa học** ngay trong trang lớp

## Cấu trúc khóa học

```
Khóa học
└── Chương 1
│     ├── File PDF tài liệu (nhiều file)
│     └── Bài tập (nhiều problem)
└── Chương 2
      ├── ...
      └── ...
```

- Bài tập: chọn problem có sẵn trong hệ thống HOẶC tạo problem mới
- Khi sinh viên bấm vào bài tập → chuyển sang `WorkspacePage` bình thường

## Thay đổi cần làm

| # | Phạm vi | Mô tả |
|---|---------|-------|
| 1 | Frontend (student nav) | Ẩn `/courses` khỏi menu sinh viên |
| 2 | Admin + Lecturer UI | Thêm chức năng gán khóa học cho lớp; quản lý chương, PDF, bài tập |
| 3 | Student classroom detail | Thêm tab/section khóa học bên cạnh kỳ thi |
| 4 | Backend | API CRUD cho course-chapter-file-problem gắn với classroom |
| 5 | DB | Schema: classroom_course, course_chapters, chapter_files, chapter_problems |

## Ngoài phạm vi

- Sinh viên tự duyệt / đăng ký khóa học
- Tạo role giảng viên mới (đã có spec riêng tại `docs/intent/role-lecturer.md`)
- Nhiều khóa học trên 1 lớp
- Giao diện làm bài riêng trong khóa học
