# Intent: Contest — Không cho thoát giữa chừng

## Statement of Intent

| | |
|---|---|
| **Outcome** | Một khi vào contest, sinh viên không thể thoát ra và quay lại — thoát là kết thúc phiên thi |
| **User** | Sinh viên tham gia contest |
| **Why now** | Ngăn gian lận kiểu "thoát ra tra tài liệu rồi vào lại" |
| **Success** | Thoát (bất kỳ cách nào) → dialog cảnh báo → xác nhận → session bị đánh dấu kết thúc → không vào lại được; điểm tính theo các bài đã submit trước đó |
| **Constraint** | Không tự submit code chưa hoàn chỉnh; chỉ khóa phiên |
| **Out of scope** | Auto-submit code đang viết, cấu hình per-contest (bật/tắt tính năng này), khôi phục phiên nếu mất điện/crash |

## Scope chi tiết

### Trạng thái participant

- Thêm column `exited_at TIMESTAMP` vào bảng `contest_participants`
- `exited_at IS NULL` → đang thi / chưa thi
- `exited_at IS NOT NULL` → đã kết thúc phiên, không cho vào lại

### Backend

- `POST /api/contests/{id}/exit` — đánh dấu `exited_at = NOW()` cho participant hiện tại; idempotent (gọi lại không lỗi)
- `GET /api/contests/{id}/workspace` (hoặc bất kỳ endpoint vào contest) — kiểm tra `exited_at`: nếu đã set → trả `403 Forbidden` với message rõ ràng
- Điểm tính bình thường từ các submission đã có trước khi exit

### Frontend

- Khi sinh viên thực hiện bất kỳ hành động nào rời trang contest:
  - Bấm nút "Thoát" trong UI
  - Đóng tab (`beforeunload` event)
  - Navigate ra ngoài (React Router `useBlocker` / `Prompt`)
- Hiện dialog cảnh báo:
  > **Kết thúc bài thi?**
  > Bạn sẽ không thể quay lại. Chỉ những bài đã nộp mới được tính điểm.
  > [Hủy] [Xác nhận thoát]
- Nếu xác nhận: gọi `POST /api/contests/{id}/exit` → redirect về trang danh sách contest
- Nếu hủy: ở lại trang, tiếp tục thi
- Khi sinh viên cố vào lại contest đã exit: hiện thông báo "Bạn đã kết thúc phiên thi này" thay vì trang workspace

### Lưu ý kỹ thuật

- `beforeunload` chỉ hiện được dialog mặc định của trình duyệt (không custom text) — chấp nhận được
- React Router blocker chặn điều hướng nội bộ (SPA navigation) — cần xử lý riêng với `beforeunload` cho đóng tab
- Gọi `POST /exit` trong `beforeunload` dùng `navigator.sendBeacon` để đảm bảo request được gửi dù tab đóng

## Confirmed

Đã xác nhận bởi người dùng — 2026-10-28.
