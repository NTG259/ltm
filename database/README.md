# Cơ sở dữ liệu demo CodeJudge

`codejudge-demo.db` là bản sao lưu **PostgreSQL custom archive**, nén bằng `pg_dump`, gồm cấu trúc, dữ liệu và lịch sử Flyway. Không phải SQLite. File nhỏ hơn 100 MB, có thể commit trực tiếp lên GitHub.

Dữ liệu hoàn toàn giả lập: 180 sinh viên theo 6 lớp, 3 học viên kiểm thử LMS, 4 tài khoản giảng viên, 7 lớp và 21 kỳ thi (gồm dữ liệu nền từ migrations). Mỗi lớp học phần có 30 sinh viên và ba kỳ thi giữa kỳ, luyện tập, cuối kỳ. Có bài nộp AC/WA, kết quả test và bảng xếp hạng; đây là lịch sử giả lập, không phải kết quả đo hiệu năng.

Tài khoản demo:

| Tài khoản | Mật khẩu | Vai trò |
| --- | --- | --- |
| `admin` | `admin123` | Quản trị viên |
| `gv.minh`, `gv.lan`, `gv.hung` | `admin123` | Giảng viên |
| `GV001` | `gv123456` | Giảng viên mẫu |
| `B24DCCN101` đến `B24DCCN280` | `admin123` | Sinh viên |
| `B26DCCN901` đến `B26DCCN903` | `admin123` | Học viên LMS mẫu |

Mỗi nhóm 30 MSSV liên tiếp thuộc một lớp (101–130, 131–160, …). Tám tài khoản sinh viên B20 có sẵn cũng dùng `admin123`. Đây là mật khẩu công khai dành riêng cho demo.

## Khôi phục vào database mới

Chạy từ thư mục gốc dự án, cần Docker Desktop và PostgreSQL container của dự án:

```powershell
docker compose up -d db
docker compose cp database/codejudge-demo.db db:/tmp/codejudge-demo.db
docker compose exec -T db createdb -U codejudge codejudge_demo
docker compose exec -T db pg_restore -U codejudge -d codejudge_demo --no-owner --no-privileges --exit-on-error /tmp/codejudge-demo.db
```

Để website sử dụng database vừa khôi phục, đặt `DB_NAME=codejudge_demo` trong `.env`, sau đó chạy `docker compose up -d --force-recreate backend`. Các lệnh trên tạo database mới, không thay thế database cũ. Nếu `codejudge_demo` đã tồn tại, chọn tên mới và đổi tương ứng trong lệnh cùng `.env`. Tài khoản DB trong ví dụ theo cấu hình mặc định của dự án.

Ngày thi trong archive cố định theo thời điểm xuất. Khi phục hồi lâu về sau, các kỳ thi đang diễn ra có thể đã kết thúc; chỉnh lịch thi trong trang quản trị để tiếp tục trình diễn.

## Tạo lại archive hoặc bổ sung dữ liệu vào website

```powershell
# Dựng database tạm từ migrations, xuất archive và khôi phục thử để kiểm tra.
powershell -ExecutionPolicy Bypass -File database/Export-Demo.ps1

# Đồng thời bổ sung dữ liệu giả lập vào database website hiện tại.
powershell -ExecutionPolicy Bypass -File database/Export-Demo.ps1 -ApplyToWebsite
```

Seed bổ sung ở `backend/src/main/resources/db/seed/realistic_data.sql`, có transaction và chống thêm trùng. Không xóa dữ liệu website. Bản archive dựng riêng từ migrations, không sao chép tài khoản cá nhân, phiên đăng nhập, nhật ký vận hành hoặc bài stress test từ database đang chạy; chỉ lấy lịch sử Flyway để bảo toàn checksum. Script yêu cầu database hiện tại đã chạy các migrations của repo, dùng cấu hình mặc định `codejudge` cho tên database và user.

Commit `database/`, seed SQL và script cùng source code; không cần commit Docker volumes. Khi schema thay đổi, tạo lại archive với script trên.

## Dữ liệu kiểm thử LMS

Từ thư mục gốc dự án, khi Docker Compose đã chạy:

```powershell
docker compose up -d --build --no-deps backend
node database/install-lms-demo.mjs
```

Script chỉ thêm dữ liệu còn thiếu, có thể chạy lại. Nó tạo đủ bài giảng cho 20 chủ đề của 4 khóa học mẫu, thêm 3 bài tập riêng cho DSA/OOP/nâng cao (mỗi bài có testcase mẫu và ẩn), gắn bài tập vào chủ đề, tạo lớp `LMS Demo - C++` và tải PDF mẫu lên chủ đề đầu của khóa C++ cơ bản qua API. Nếu mật khẩu admin demo đã đổi, đặt biến môi trường `LMS_DEMO_ADMIN_PASSWORD` trước khi chạy.

Tài khoản học viên để kiểm tra tiến độ (mật khẩu `admin123`): `B26DCCN901` chưa học, `B26DCCN902` hoàn thành 2/7 bài, `B26DCCN903` hoàn thành 7/7 bài của khóa C++ cơ bản. Đăng nhập admin để xem quản lý bài giảng, tài liệu, bài tập và lớp demo. Bài tập mới có thể nộp mã C++ để kiểm tra kết quả AC và tự cập nhật tiến độ.

File PDF được lưu trong Docker volume `course-files`; bản sao lưu PostgreSQL chỉ chứa metadata. Sau khi khôi phục archive trên máy khác, chạy lại `install-lms-demo.mjs` để tải file thật lên. Script này bổ sung dữ liệu, không dùng lệnh seed của profile `demo` vốn xóa dữ liệu cũ.
