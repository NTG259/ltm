# HƯỚNG DẪN KHỞI CHẠY HỆ THỐNG CODEJUDGE (LTM)

Hệ thống Chấm bài Trực tuyến theo kiến trúc phân tán gồm các thành phần:
1. **Master Server (Backend):** Spring Boot (Java) – Quản lý REST API (`:8000`), WebSocket (`:8001`) và TCP điều phối Worker (`:9000`).
2. **Judge Workers:** Python Daemon – Kết nối TCP vào Master, biên dịch và chạy test code C++ bằng MinGW `g++`.
3. **Web SPA (Frontend):** React + Vite – Giao diện người dùng thời gian thực (`:5173`).
4. **Database:** PostgreSQL Cloud (Neon Singapore) – Đã kết nối sẵn trong code, **không cần cài đặt PostgreSQL trên máy**.

---

## 1. Yêu cầu môi trường
* **Java:** JDK 21 trở lên (Đã tích hợp sẵn Maven Wrapper `mvnw`).
* **Node.js:** Phiên bản 18+ (kèm npm).
* **Python:** 3.10+ (Đã cài đặt MinGW `g++` trong PATH để Worker chấm code C++).

---

## 2. Các bước chạy hệ thống (Chạy 3 cửa sổ Terminal)

### 🔹 Cửa sổ 1: Khởi chạy Master Server (Backend)
```powershell
cd backend
.\mvnw spring-boot:run
```
* **HTTP REST API:** `http://127.0.0.1:8000`
* **WebSocket RFC 6455:** `ws://127.0.0.1:8001`
* **TCP Master-Worker:** `127.0.0.1:9000`

---

### 🔹 Cửa sổ 2: Khởi chạy Giao diện Web (Frontend)
```powershell
cd frontend
npm install
npm run dev
```
Truy cập trình duyệt tại: **`http://localhost:5173`**

---

### 🔹 Cửa sổ 3: Khởi chạy Judge Workers (Máy chấm thật)

Mở Terminal tại thư mục gốc dự án và chạy:

* **Chạy cùng lúc cả 3 Workers (Khuyên dùng):**
  ```powershell
  1..3 | ForEach-Object { Start-Process powershell -ArgumentList "-NoExit", "-Command", "`$env:PYTHONUTF8='1'; python -m judgement worker --id worker-`$_ --master-host 127.0.0.1 --master-port 9000" }
  ```
  *(Lệnh này tự động bật 3 cửa sổ tương ứng `worker-1`, `worker-2`, `worker-3` kết nối vào Master Server).*

* **Hoặc chỉ chạy 1 Worker duy nhất:**
  ```powershell
  $env:PYTHONUTF8="1"
  python -m judgement worker --id worker-1 --master-host 127.0.0.1 --master-port 9000
  ```

---

## 3. Cách đăng nhập trên Giao diện Web

Trên màn hình đăng nhập (`http://localhost:5173`), bạn chọn vai trò:

### 🔹 Vai trò: Quản trị viên (Admin)
* **Giao diện yêu cầu:** Chỉ có 1 ô nhập mật khẩu.
* **Mật khẩu quản trị:** **`admin123`**
* *(Vào trang quản trị để giám sát trạng thái 3 Worker, quản lý đề thi).*

### 🔹 Vai trò: Thí sinh (Sinh viên)
* **Giao diện yêu cầu:** Không cần mật khẩu, chỉ cần nhập thông tin sinh viên:
  - **Mã sinh viên:** `B20DCCN001` *(hoặc bất kỳ MSSV nào đúng chuẩn, ví dụ: `B21DCCN002`)*
  - **Họ và tên:** `Nguyễn Văn A` *(hoặc tên bạn)*
* Bấm **"Bắt đầu làm bài"** $\rightarrow$ Hệ thống tự động tạo/lưu phiên làm việc vào Database và chuyển thẳng vào làm bài!
