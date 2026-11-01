# Use case chính của CodeJudge

Tài liệu này mô tả các chức năng đang có trong backend và frontend. Tệp `CodeJudge-UseCases.vpp` chứa một sơ đồ tổng quan và ba sơ đồ chi tiết theo vai trò; thư mục `preview/` chứa ảnh PNG xuất từ Visual Paradigm.

## Sinh viên

1. Đăng nhập, đăng xuất và đổi mật khẩu.
2. Xem lớp học, học phần và nội dung bài học được phép truy cập.
3. Tải tài liệu của bài học và theo dõi tiến độ học tập.
4. Tìm kiếm, xem đề bài và viết mã C++ trong workspace.
5. Chạy thử mã với input tự chọn.
6. Nộp bài luyện tập; theo dõi trạng thái, verdict, kết quả từng testcase và lịch sử nộp.
7. Xem kỳ thi; đăng ký hoặc hủy đăng ký theo điều kiện hiện tại của hệ thống.
8. Vào không gian làm bài thi và nộp bài trong kỳ thi.
9. Xem bảng xếp hạng sinh viên và kết quả kỳ thi.

## Giảng viên

1. Đăng nhập, đăng xuất và đổi mật khẩu.
2. Xem, cập nhật lớp được phân công; quản lý sinh viên trong lớp (thêm, nhập CSV, xóa, đặt lại mật khẩu).
3. Gán hoặc bỏ gán học phần và kỳ thi cho lớp thuộc quyền quản lý.
4. Tạo, chỉnh sửa và xóa học phần của mình; biên soạn chủ đề, bài học, tài liệu và gắn đề bài vào chủ đề.
5. Xem và sử dụng đề bài trong kho chung. Giảng viên không có quyền tạo, sửa hoặc xóa đề trong kho này.
6. Tạo, chỉnh sửa và xóa kỳ thi của mình bằng các đề có sẵn.
7. Theo dõi bài nộp, tiến độ học tập và bảng xếp hạng trong phạm vi lớp được phân công.
8. Giám sát hiện diện, tiến độ làm bài và các vi phạm trong kỳ thi.
9. Chạy và xem báo cáo kiểm tra mã nguồn tương đồng của kỳ thi thuộc quyền quản lý.

## Quản trị viên (Admin)

1. Đăng nhập và đăng xuất.
2. Tạo, nhập CSV, xóa tài khoản giảng viên và đặt lại mật khẩu của họ.
3. Phân công hoặc hủy phân công giảng viên cho lớp.
4. Tạo, chỉnh sửa, xóa lớp; quản lý sinh viên và đặt lại mật khẩu sinh viên.
5. Tạo, chỉnh sửa, ẩn/hiện, xóa đề bài; quản lý testcase và nhập testcase từ ZIP.
6. Quản lý học phần, chủ đề, bài học, tài liệu và liên kết đề bài.
7. Tạo, chỉnh sửa, xóa kỳ thi; gán kỳ thi và học phần cho lớp.
8. Xem bài nộp, thống kê tổng quan và bảng xếp hạng.
9. Giám sát hiện diện, tiến độ thi, vi phạm; chạy kiểm tra mã nguồn tương đồng.
10. Giám sát Worker, hàng đợi và log; ngắt Worker hoặc xóa bản ghi Worker đã mất kết nối.

## Ranh giới hiện tại

- `docs/specs/SPEC-notifications.md` mô tả hệ thống thông báo dự kiến; mã nguồn hiện tại chưa có NotificationController hoặc NotificationBell.
- `docs/specs/SPEC-contest-scoping.md` mô tả việc giới hạn danh sách kỳ thi theo lớp và bỏ bước đăng ký riêng; frontend hiện tại vẫn gọi API đăng ký/hủy đăng ký kỳ thi.
- Các use case trên là mục tiêu của người dùng. Redis Streams, TCP Master–Worker, heartbeat và sandbox là cơ chế nội bộ hỗ trợ các mục tiêu đó, không phải actor người dùng trong sơ đồ này.
