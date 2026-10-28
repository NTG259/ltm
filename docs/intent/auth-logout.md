# Intent: Auth — Logout

## Statement of Intent

| | |
|---|---|
| **Outcome** | Logout đúng nghĩa — bấm thoát thì server xóa session, token không dùng lại được |
| **User** | Tất cả người dùng (admin + sinh viên) |
| **Why now** | Tính năng đầu tiên trong đợt hoàn thiện; Auth là nền tảng của mọi chức năng khác |
| **Success** | Sau khi logout, gọi API cũ với token cũ → `401 Unauthorized`; UI không còn trạng thái đăng nhập |
| **Constraint** | Đơn giản nhất có thể — xóa `UserSession` trong DB, clear `localStorage` phía client |
| **Out of scope** | Danh sách thiết bị đang đăng nhập, revoke từng session riêng lẻ, rate limiting login, "nhớ đăng nhập" |

## Scope chi tiết

### Backend

- `DELETE /api/auth/logout`
  - Yêu cầu Bearer token hợp lệ trong header `Authorization`
  - Tìm `UserSession` theo hash của token → xóa khỏi DB
  - Trả về `204 No Content`
  - Nếu token không tồn tại / đã hết hạn → vẫn trả `204` (idempotent)

### Frontend

- Thêm nút **Đăng xuất** trên giao diện (AppLayout / menu)
- Gọi `DELETE /api/auth/logout` với token hiện tại
- Sau khi nhận response: xóa token khỏi `localStorage`, redirect về `/login`
- Không cần dialog xác nhận

### Không làm

- Không liệt kê các session đang mở
- Không cho revoke session theo ID
- Không thêm rate limiting cho login
- Không thêm "nhớ đăng nhập" / refresh token

## Confirmed

Đã xác nhận bởi người dùng — 2026-10-28.
