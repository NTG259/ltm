# Intent: Role — Giảng viên

## Statement of Intent

| | |
|---|---|
| **Outcome** | Role giảng viên tự quản lý lớp học của mình mà không cần quyền admin toàn hệ thống |
| **User** | Giảng viên — người dạy, quản lý lớp, ra bài tập nội bộ |
| **Why now** | Hiện tại chỉ có admin làm được những việc này; giảng viên phải nhờ admin cho mọi thứ |
| **Success** | Giảng viên login, tạo lớp, thêm sinh viên, tạo bài tập + contest cho lớp đó, xem kết quả — không đụng đến phần còn lại của hệ thống |
| **Constraint** | Bài tập và contest giảng viên tạo chỉ dùng trong lớp của họ; tài khoản giảng viên do admin import từ file (như sinh viên) |
| **Out of scope** | Contest/bài tập dùng chung toàn hệ thống, tự đăng ký tài khoản, quản lý worker/judge, xem log hệ thống, plagiarism toàn hệ thống |

## Scope chi tiết

### Quyền của giảng viên

| Chức năng | Giảng viên | Ghi chú |
|---|---|---|
| Quản lý lớp học (tạo, sửa, xóa) | ✅ | Chỉ lớp của mình |
| Thêm/xóa sinh viên trong lớp | ✅ | Import CSV như hiện tại |
| Gán contest vào lớp | ✅ | Chỉ contest của mình hoặc contest chung do admin tạo |
| Tạo bài tập | ✅ | Không public — chỉ dùng trong contest của lớp |
| Tạo contest | ✅ | Scoped theo lớp — sinh viên ngoài lớp không thấy |
| Xem kết quả / standings lớp | ✅ | |
| Xem bài nộp của sinh viên trong lớp | ✅ | |
| Chạy plagiarism trong lớp | ✅ | Chỉ trong phạm vi lớp của mình |
| Tạo/quản lý tài khoản giảng viên khác | ❌ | Chỉ admin |
| Xem bài tập / contest của giảng viên khác | ❌ | |
| Quản lý worker/judge | ❌ | Chỉ admin |
| Xem system log | ❌ | Chỉ admin |
| Tạo contest chung toàn hệ thống | ❌ | Chỉ admin |

### Tài khoản giảng viên

- Admin tạo bằng file (CSV import) — tương tự luồng import sinh viên hiện tại
- Giảng viên login bằng `staffId` + `password` (tương tự sinh viên dùng `studentId`)
- Không có luồng tự đăng ký

### Backend

- Thêm `LECTURER` vào enum `UserRole` (hiện có `ADMIN`, `STUDENT`)
- Flyway migration: thêm column hoặc giá trị mới cho `users.role`
- `AuthInterceptor`: mở rộng để nhận diện `LECTURER` và route đúng
- Tách endpoint: các route `/api/admin/classrooms/**` → giảng viên chỉ truy cập lớp của mình (`ownerId = currentUser.id`)
- Bài tập + contest giảng viên tạo: thêm `ownerId` / `classroomId` để scoping

### Frontend

- Route mới `/teacher/*` song song với `/admin/*` và `/` (student)
- Layout riêng cho giảng viên: sidebar chỉ hiện Lớp học, Bài tập, Contest, Kết quả
- Không hiện: Workers, System Log, Leaderboard toàn hệ thống, Plagiarism toàn hệ thống

## Confirmed

Đã xác nhận bởi người dùng — 2026-10-28.
