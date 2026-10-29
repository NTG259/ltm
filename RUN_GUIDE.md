# CodeJudge – Run & Deployment Guide (Docker)

> **CodeJudge** là hệ thống chấm bài lập trình C++ phân tán thời gian thực theo mô hình **Master – Multi-Worker**, sử dụng hàng đợi Redis Streams, giao thức TCP nhị phân điều phối Worker và WebSocket RFC 6455 cập nhật tiến trình trực tiếp trên trình duyệt.
> 
> **Toàn bộ hệ thống đã được đóng gói hoàn chỉnh bằng Docker Compose.** Bạn chỉ cần cài đặt **Docker Desktop** là có thể khởi động ngay toàn bộ 6 dịch vụ (Database, Redis, Master Backend, Frontend Nginx, go-judge Sandbox, và đàn Worker) mà không cần cài đặt thêm Java, Node.js, Python hay MinGW trên máy chủ.

---

## 1. Yêu cầu môi trường (Prerequisites)

* **Docker Desktop** (Khuyên dùng WSL2 backend trên Windows hoặc Docker Engine trên Linux).
* Không cần cài đặt bất kỳ công cụ lập trình hay môi trường nào khác trên máy host.

---

## 2. Khởi chạy hệ thống (Quick Start)

### Bước 1: Khởi động toàn bộ dịch vụ (Kèm 4 Worker chấm song song)
Mở PowerShell hoặc Terminal tại thư mục gốc của dự án và chạy:

```powershell
docker compose up -d --build --scale worker=4
```

> **Giải thích lệnh:**
> * `up -d`: Khởi chạy ngầm toàn bộ dịch vụ cần thiết (PostgreSQL 18, Redis 7, Master Server, Web SPA, go-judge sandbox).
> * `--build`: Tự động biên dịch mã nguồn Backend và Frontend mới nhất.
> * `--scale worker=4`: Tự động khởi tạo và kết nối 4 Worker chấm song song vào Master Server.

### Bước 2: Kiểm tra trạng thái hoạt động
```powershell
docker compose ps
```
Chờ khoảng 20–30 giây để Master Server hoàn tất việc khởi tạo lược đồ cơ sở dữ liệu (Flyway migration) và chuyển sang trạng thái `healthy`.

### Bước 3: Nạp dữ liệu mẫu (Khuyên dùng khi demo / chấm bài)
Nạp sẵn 10 bài tập mẫu, bộ testcase, 3 kỳ thi và tài khoản sinh viên:
```powershell
docker compose --profile demo up seed
```

---

## 3. Truy cập hệ thống & Bảng ánh xạ cổng (Ports Mapping)

Sau khi khởi chạy thành công, mở trình duyệt web và truy cập:

| Dịch vụ | Địa chỉ truy cập | Ghi chú |
| :--- | :--- | :--- |
| **Giao diện Web (Frontend)** | **[http://localhost:18080](http://localhost:18080)** | Ứng dụng Web SPA React 19 + Monaco IDE |
| **Master REST API** | **[http://localhost:18000/api](http://localhost:18000/api)** | Spring Boot REST Endpoints |
| **WebSocket Realtime** | `ws://localhost:18001` (hoặc `8001`) | Broadcast tiến trình chấm từng testcase |
| **PostgreSQL Database** | `localhost:15432` | User/Pass: `codejudge`/`codejudge` |
| **Redis Cache & Streams** | `localhost:16379` | Hàng đợi tin cậy 3 mức ưu tiên |

---

## 4. Thông tin Đăng nhập (Credentials)

Mở trình duyệt truy cập: **[http://localhost:18080](http://localhost:18080)**

### 🔹 1. Tài khoản Quản trị viên (Admin)
* **Tên đăng nhập:** `admin`
* **Mật khẩu:** `admin123`
* **Quyền hạn chính:**
  * Giám sát Worker thời gian thực (Xem CPU, RAM, trạng thái `IDLE` / `BUSY` / `DEAD`, RTT latency của từng máy chấm).
  * Quản lý ngân hàng đề bài C++, cấu hình testcase mẫu và testcase ẩn.
  * Tổ chức kỳ thi lập trình (Contests), quản lý lớp học (Classrooms).
  * Chạy tính năng quét phát hiện sao chép mã nguồn (Winnowing Plagiarism).

### 🔹 2. Tài khoản Thí sinh / Sinh viên (Student)
Xác thực bảo mật bằng Mã sinh viên (MSSV) và Mật khẩu:
* **Mã sinh viên:** `B20DCCN001`
* **Mật khẩu:** `TestPass2026!`
* *(Hoặc tài khoản thứ 2: MSSV `B20DCCN002` / Mật khẩu `TestPass2026@`)*
* **Quyền hạn chính:**
  * Soạn thảo code C++ trên IDE Monaco trực tuyến với cú pháp highlight và phím tắt.
  * Nộp bài và theo dõi tiến trình chấm realtime (Compiling $\rightarrow$ Testing 1/4 ... $\rightarrow$ Verdict).
  * Tham gia kỳ thi ICPC, xem Bảng xếp hạng (Leaderboard) cập nhật trực tiếp.

---

## 5. Các thao tác Quản trị & Giám sát Docker thường dùng

### Xem nhật ký hoạt động (Logs)
```powershell
# Xem log Master Server (điều phối hàng đợi, WebSocket)
docker compose logs -f backend

# Xem log các Worker đang chấm bài
docker compose logs -f worker
```

### Scale thêm số lượng Worker khi tải tăng cao
Hệ thống hỗ trợ mở rộng ngang tức thì mà không cần khởi động lại:
```powershell
# Tăng lên 8 Worker chạy song song
docker compose up -d --scale worker=8
```

### Dừng hệ thống (Shutdown)
* **Dừng các container (giữ nguyên dữ liệu bài nộp và database):**
  ```powershell
  docker compose down
  ```
* **Dừng và dọn sạch toàn bộ dữ liệu (Reset sạch sẽ database và Redis volume):**

  ```powershell
  docker compose down -v
  ```
