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

## 2. Các bước chạy hệ thống (Bấm nút Copy ở góc phải mỗi ô)

### 🔹 Cửa sổ 1: Khởi chạy Master Server (Backend)
Copy và dán vào Terminal 1:
```powershell
cd backend; .\mvnw spring-boot:run
```
* **HTTP REST API:** `http://127.0.0.1:8000`
* **WebSocket RFC 6455:** `ws://127.0.0.1:8001`
* **TCP Master-Worker:** `127.0.0.1:9000`

---

### 🔹 Cửa sổ 2: Khởi chạy Giao diện Web (Frontend)
Copy và dán vào Terminal 2:
```powershell
cd frontend; npm run dev
```
*(Nếu lần đầu clone về chưa tải thư viện thì chạy: `cd frontend; npm install; npm run dev`)*

👉 Mở trình duyệt truy cập: **`http://localhost:5173`**

---

### 🔹 Cửa sổ 3: Khởi chạy Judge Workers (Máy chấm thật)

Mở Terminal 3 tại thư mục gốc dự án và chọn 1 trong 2 ô copy bên dưới:

* **Chạy cùng lúc cả 3 Workers (Khuyên dùng - bấm 1 phát bật 3 máy chấm):**
```powershell
1..3 | ForEach-Object { $id = "worker-$_"; Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD\judgement'; python -X utf8 -m judgement worker --id $id --master-host 127.0.0.1 --master-port 9000" }
```

* **Hoặc chỉ chạy 1 Worker đơn lẻ:**
```powershell
cd judgement; python -X utf8 -m judgement worker --id worker-1 --master-host 127.0.0.1 --master-port 9000
```

---

## 3. Thông tin Đăng nhập trên Web (Copy & Paste vào ô)

Truy cập: **`http://localhost:5173`**

### 🔹 Đăng nhập Quản trị viên (Admin)
Chọn vai trò **Quản trị viên** $\rightarrow$ Copy mật khẩu dán vào ô:
```text
admin123
```
*(Dùng để vào trang quản trị giám sát trạng thái 3 Worker, xem log TCP, quản lý đề bài).*

---

### 🔹 Đăng nhập Thí sinh (Sinh viên)
Chọn vai trò **Thí sinh** $\rightarrow$ Copy thông tin dán vào 2 ô tương ứng:

* **Mã sinh viên (MSSV):**
```text
B20DCCN001
```

* **Họ và tên:**
```text
Nguyễn Văn A
```

Bấm nút **"Bắt đầu làm bài"** để vào làm bài thi trực tiếp!
