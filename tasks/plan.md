# Kế hoạch triển khai: Đăng ký tài khoản sinh viên

## Mục tiêu

> **Quyết định thay thế:** Giảng viên tạo lớp và import danh sách tài khoản. Sinh viên không tự đăng ký; chỉ đăng nhập bằng MSSV và mật khẩu do giảng viên cấp. Với quyết định này, phần kế hoạch bên dưới về `POST /api/auth/register` được thay bằng import CSV tài khoản trong phạm vi triển khai.

**Định dạng import được chọn: CSV UTF-8**, có tiêu đề `mssv,password` (có thể bổ sung `ho_ten` sau này). Ví dụ:

```csv
mssv,password
B20DCCN001,TempPass2026!
B20DCCN002,TempPass2026@
```

Khi import, hệ thống phải hash mật khẩu bằng BCrypt ngay trong transaction, chỉ báo số dòng thành công/lỗi và không trả lại hoặc ghi log mật khẩu. Tài khoản trùng MSSV phải bị bỏ qua/báo lỗi, không ghi đè mật khẩu hiện có. CSV phù hợp hơn XLSX cho phiên bản đầu vì Excel/Google Sheets đều xuất được, không cần thêm thư viện xử lý bảng tính và ít bề mặt tấn công hơn.

Thay luồng hiện tại, trong đó sinh viên được tạo tài khoản chỉ bằng MSSV và họ tên khi đăng nhập, bằng luồng đăng ký tối giản: mã sinh viên và mật khẩu. Sinh viên đăng ký một lần, rồi đăng nhập bằng đúng hai trường này.

## Phạm vi đã giả định

- Chỉ sinh viên được tự đăng ký; không có đăng ký quản trị viên.
- Biểu mẫu đăng ký gồm MSSV, mật khẩu và xác nhận mật khẩu; không thu thập họ tên.
- Đăng ký thành công tạo phiên đăng nhập 7 ngày như đăng nhập hiện tại, sau đó chuyển đến trang bài tập.
- Không có xác thực email/OTP, danh sách lớp hoặc mã mời trong đợt này.
- MSSV vẫn phải khớp mẫu hiện có: `^[A-Z][0-9]{2}[A-Z]{4}[0-9]{3}$`.

## Hiện trạng và quyết định kiến trúc

- `POST /api/auth/login` hiện tự tạo sinh viên chưa tồn tại và cập nhật họ tên. Hành vi này phải bỏ; nếu không, màn hình đăng ký không tạo được ranh giới bảo mật.
- Bảng `users` đã có `password_hash`; mật khẩu sinh viên sẽ dùng cùng BCrypt encoder như quản trị viên, không bổ sung thư viện mới.
- Hợp đồng API mới là `POST /api/auth/register`, dành riêng cho sinh viên, trả về cùng mẫu phiên `{ token, user }` như đăng nhập. Điều này giúp frontend tái sử dụng `storeSession` và WebSocket authentication.
- `POST /api/auth/login` cho sinh viên đổi payload thành `role`, `studentId`, `password`. Không trả lời khác biệt giữa MSSV không tồn tại và sai mật khẩu.
- Vì `users.full_name` đang là bắt buộc, tài khoản đăng ký mới tạm lưu MSSV làm `full_name`; giao diện không hiển thị trường này. Đây là giải pháp tương thích schema cho phiên bản đầu, không cần migration cột tên.

## Hợp đồng API đề xuất

### `POST /api/auth/register`

Request:

```json
{
  "studentId": "B20DCCN001",
  "password": "at-least-8-characters",
  "confirmPassword": "at-least-8-characters"
}
```

Response `201 Created`:

```json
{
  "token": "opaque-session-token",
  "user": { "id": "B20DCCN001", "name": "B20DCCN001", "role": "student" }
}
```

Lỗi: `400` cho dữ liệu không hợp lệ; `409` nếu MSSV đã có tài khoản đã kích hoạt; `429` khi vượt giới hạn thử. Không trả password hash hoặc chi tiết xác thực.

## Trình tự triển khai

```text
Migration + quy tắc tài khoản
        ↓
Service đăng ký / đăng nhập mật khẩu
        ↓
API contract + kiểm thử backend
        ↓
API client mock và thật
        ↓
Màn hình đăng ký / cập nhật đăng nhập
        ↓
Kiểm thử API, frontend và luồng trình duyệt
```

## Rủi ro và giảm thiểu

| Rủi ro | Ảnh hưởng | Giảm thiểu |
| --- | --- | --- |
| Tự đăng ký không chứng minh được MSSV thuộc về người đăng ký | Trung bình | Chấp nhận trong phạm vi đơn giản này; có thể bổ sung roster hoặc OTP sau. |
| Sinh viên đã tồn tại qua import lớp không có mật khẩu | Trung bình | Cho phép họ đặt mật khẩu qua đăng ký nếu MSSV chưa có password hash; tài khoản đã có hash phải báo trùng. |
| Dò mật khẩu hoặc tạo tài khoản hàng loạt | Cao | Rate-limit theo IP và MSSV, BCrypt, thông báo lỗi trung tính, logging sự kiện bảo mật. |
| Mock và API thật lệch nhau | Trung bình | Cập nhật collection/API contract và kiểm thử cùng bộ tình huống cho cả hai. |

## Điểm cần chốt trước khi triển khai

1. Chính sách mật khẩu đề xuất: tối thiểu 8 ký tự; có chấp nhận không?

## Điều kiện hoàn thành

- Sinh viên đăng ký hợp lệ bằng MSSV và mật khẩu, nhận phiên đăng nhập và không thể đăng ký trùng MSSV.
- Đăng nhập sinh viên yêu cầu mật khẩu; không còn tự tạo tài khoản qua endpoint đăng nhập.
- Mật khẩu chỉ được lưu BCrypt hash; API không lộ hash hay phân biệt MSSV không tồn tại/sai mật khẩu.
- Mock, frontend và backend dùng cùng contract; các kiểm thử API, backend, frontend và kiểm tra trình duyệt đều đạt.
