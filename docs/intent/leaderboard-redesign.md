# Intent: Leaderboard — Phân chia theo lớp và contest

## Statement of Intent

| | |
|---|---|
| **Outcome** | Hai bảng xếp hạng riêng biệt: classroom leaderboard trong trang lớp, contest ranking trong trang contest |
| **User** | Sinh viên (xem), giảng viên (theo dõi tiến độ lớp) |
| **Why now** | Leaderboard hiện tại là một endpoint duy nhất, không có ngữ cảnh lớp hay contest |
| **Success** | Trang lớp: danh sách sinh viên + tiến độ, top 3 nổi bật theo số bài AC; Trang contest: sinh viên đang tham gia xem được standings, lọc theo lớp hoặc chung, xếp theo số câu AC |
| **Constraint** | Classroom leaderboard chỉ tính bài AC (không tính lesson); chỉ sinh viên đang tham gia contest mới xem được contest ranking |
| **Out of scope** | Leaderboard toàn hệ thống hiện tại (thay thế hoàn toàn), xếp hạng theo thời gian ICPC (penalty), xuất CSV |

## Scope chi tiết

### Phần 1: Classroom Leaderboard (trong trang lớp học)

#### Backend

- `GET /api/classrooms/{id}/leaderboard` — trả về danh sách sinh viên trong lớp, mỗi sinh viên có:
  - `studentId`, `fullName`
  - `acCount` — số bài tập thực hành (unit exercises) đã AC
  - `rank` — thứ hạng trong lớp
- Sắp xếp theo `acCount` giảm dần
- Top 3 được đánh dấu trong response (hoặc client tự lấy 3 đầu)

#### Frontend (trang lớp học)

- Section **"Bảng xếp hạng"** trong trang chi tiết lớp
- Top 3: hiển thị nổi bật (podium / card với huy hiệu vàng/bạc/đồng)
- Danh sách đầy đủ bên dưới: bảng sinh viên + số bài AC + thứ hạng
- Cột "Tiến độ": số bài AC / tổng số bài tập thực hành trong lớp

---

### Phần 2: Contest Ranking (trong trang contest)

#### Backend

- `GET /api/contests/{id}/standings?scope=global|classroom` — standings của contest
  - `scope=global` (default): tất cả participant
  - `scope=classroom`: chỉ participant cùng lớp với người đang xem
- Chỉ participant đang tham gia contest mới gọi được (403 nếu chưa đăng ký)
- Mỗi row: `rank`, `studentId`, `fullName`, `acCount`, `totalProblems`
- Sắp xếp theo `acCount` giảm dần (không tính penalty thời gian)

#### Frontend (trang contest)

- Tab hoặc dropdown **"Xếp hạng"** trong trang contest workspace
- Toggle **Lớp tôi / Tất cả** để chuyển scope
- Bảng: thứ hạng, tên sinh viên, số câu AC / tổng số câu
- Chỉ hiển thị khi sinh viên đã đăng ký và contest đang diễn ra hoặc đã kết thúc

## Confirmed

Đã xác nhận bởi người dùng — 2026-10-28.
