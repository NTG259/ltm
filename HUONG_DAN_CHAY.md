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

### 🔹 Cửa sổ 3: Khởi chạy 3 Judge Workers (Chạy 1 phát cả 3 máy chấm)

Mở Terminal tại thư mục gốc dự án và **chọn 1 trong các cách sau**:

* **Cách 1 (Gõ 1 dòng lệnh PowerShell duy nhất):**
  ```powershell
  1..3 | ForEach-Object { Start-Process powershell -ArgumentList "-NoExit", "-Command", "`$env:PYTHONUTF8='1'; python -m judgement worker --id worker-`$_ --master-host 127.0.0.1 --master-port 9000" }
  ```
  *(Lệnh này sẽ tự động bật 3 cửa sổ riêng biệt tương ứng `worker-1`, `worker-2`, `worker-3` kết nối thẳng vào Master Server).*

* **Cách 2 (Dùng file script có sẵn):**
  - Trong PowerShell: `.\start_workers.ps1`
  - Hoặc nhấp đúp file: `start_workers.bat`

---

## 3. Tài khoản kiểm thử có sẵn

| Tên đăng nhập | Mật khẩu | Quyền hạn |
| :--- | :--- | :--- |
| `student1` | `password123` | Sinh viên (Nộp bài thật, xem bảng xếp hạng, thi contest) |
| `admin` | `admin123` | Quản trị viên (Giám sát danh sách Worker, quản lý bài toán) |
