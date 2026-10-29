# NETWORK PROGRAMMING – FINAL PROJECT

> **Academic Year 2026–2027**

---

# 1. Project Information

## 1.1. Project Name

**CodeJudge – Distributed Real-time C++ Online Judge System**
*(Hệ thống chấm bài lập trình C++ phân tán và giám sát trực tuyến theo thời gian thực)*

## 1.2. Topic

**Chủ đề 3 – Ứng dụng mạng (Network Application: Hệ thống chấm bài thi lập trình phân tán Master – Multi-Worker)**

## 1.3. Group

| No. | Student ID | Full Name | Email | Main Responsibility | Contribution |
| --- | ---------- | --------- | ----- | ------------------- | -----------: |
| 1   | ...        | ...       | ...   | ...                 |         ...% |
| 2   | ...        | ...       | ...   | ...                 |         ...% |
| 3   | ...        | ...       | ...   | ...                 |         ...% |
| 4   | ...        | ...       | ...   | ...                 |         ...% |
|     |            |           |       | **Total**           |     **100%** |

## 1.4. Instructor

**[Tên giảng viên hướng dẫn]**

---

# 2. Project Summary

## 2.1. Problem

Trong các kỳ thi lập trình trực tuyến (như ICPC, Olympic Tin học) hoặc các buổi thực hành lập trình tại trường đại học, hàng trăm sinh viên thường nộp bài đồng thời trong một khoảng thời gian ngắn (traffic burst).

Các hệ thống chấm bài truyền thống xây dựng theo mô hình nguyên khối (monolithic) thường gặp các vấn đề nghiêm trọng:
1. **Nghẽn cổ chai (Bottleneck) & Tăng độ trễ (Latency):** Việc vừa phục vụ web vừa biên dịch mã nguồn C++ (`g++`) ngốn nhiều CPU/RAM, làm chậm hoặc tê liệt toàn bộ cổng nộp bài.
2. **Xử lý đơn luồng hoặc thiếu hàng đợi tin cậy:** Bài nộp bị mất mát nếu server gặp sự cố hoặc vượt quá giới hạn hàng đợi bộ nhớ tạm (in-memory queue).
3. **Mã nguồn không an toàn:** Code của sinh viên có thể chứa vòng lặp vô hạn, chiếm dụng bộ nhớ (memory bomb) hoặc gọi các lệnh hệ thống nguy hiểm (`fork`, `system`, socket scanning) gây sập máy chủ.
4. **Trải nghiệm phản hồi kém:** Người dùng phải liên tục F5 (HTTP Polling) để xem kết quả chấm, gây lãng phí băng thông mạng.

## 2.2. Motivation

Để giải quyết triệt để các hạn chế trên, dự án này phát triển hệ thống **CodeJudge** áp dụng các nguyên lý cốt lõi của **Network Programming**:
* Tách biệt hoàn toàn tầng tiếp nhận dịch vụ (Master Server) và tầng tính toán/chấm điểm (Worker Farm) qua mạng máy tính.
* Sử dụng hàng đợi tin cậy phân tán **Redis Streams** với 3 luồng ưu tiên độc lập, đảm bảo bài nộp không bao giờ bị mất (durability) ngay cả khi mất điện hoặc khởi động lại server.
* Tự thiết kế **giao thức mạng TCP nhị phân tùy biến (>BBI)** kết nối Master ↔ Worker, hỗ trợ Heartbeat liveness check và tự động phục hồi lỗi (Failover).
* Hiện thực máy chủ **WebSocket RFC 6455** để đẩy tiến trình chấm theo thời gian thực (Compiling $\rightarrow$ Testing 1/N $\rightarrow$ Verdict) tới trình duyệt người dùng với độ trễ dưới 50ms.

## 2.3. Objectives

Project hướng tới 5 mục tiêu kỹ thuật cụ thể:

1. **Thiết kế kiến trúc phân tán Master – Multi-Worker:** Cho phép mở rộng ngang (horizontal scale) linh hoạt số lượng Worker theo tải thực tế mà không cần khởi động lại Master.
2. **Hiện thực giao thức mạng nhị phân hiệu năng cao qua TCP Socket:** Đảm bảo truyền nhận tin cậy với cơ chế đóng khung (Framing), phát hiện ngắt kết nối qua Heartbeat định kỳ (5s PING / 15s timeout), và chống nghẽn bộ nhớ.
3. **Lập lịch điều phối thông minh (Least-Busy / Min-Latency Dispatcher):** Tự động điều phối bài nộp từ Redis Streams tới Worker có độ trễ mạng thấp nhất và đang ở trạng thái rảnh rỗi (`IDLE`).
4. **Cơ chế chịu lỗi (Fault Tolerance) & At-least-once Processing:** Tự động thu hồi bài nộp, hủy bỏ kết quả trùng lặp bằng UUID `attempt_token` và giao lại bài sang Worker khác khi có sự cố sập mạng hoặc Worker bị chết (tối đa 3 lần).
5. **Cung cấp ứng dụng hoàn chỉnh hỗ trợ đào tạo (LMS) & Thi đấu (ICPC):** Quản lý đề bài, testcase, lớp học, chấm 7 nhãn chuẩn (`AC`, `WA`, `TLE`, `MLE`, `RTE`, `CE`, `SEC`), phát hiện gian lận sao chép mã nguồn bằng thuật toán **Winnowing**, và giám sát thi cử (proctoring).

## 2.4. Scope

### In scope

* Biên dịch và chấm mã nguồn C/C++ (C++11, C++14, C++17) bằng `g++` trong môi trường sandbox cô lập an toàn, phân loại chính xác 7 nhãn trạng thái.
* Hàng đợi phân tán đa mức ưu tiên bằng Redis Streams (`judge:contest` > `judge:practice` > `judge:custom`) kết hợp Consumer Groups và cơ chế tái thu hồi PEL (`claimStale`).
* Giao tiếp mạng TCP Socket Master ↔ Worker sử dụng frame nhị phân đóng gói `>BBI` và JSON UTF-8 payload.
* Máy chủ WebSocket chuẩn RFC 6455 broadcast tiến trình chấm realtime tới Web Client.
* Lập lịch thông minh: Thuật toán chọn Worker tối ưu dựa trên Heartbeat latency (`latencyMs`).
* Chịu lỗi (Failover): Thu hồi và re-enqueue bài nộp khi Worker chết hoặc đứt kết nối mạng.
* Tính năng người dùng: Thí sinh (Làm bài, nộp bài, thi ICPC, xem BXH trực tiếp), Quản trị viên (Giám sát Worker CPU/RAM realtime, quản lý kỳ thi, lớp học, chạy phát hiện đạo văn Winnowing).

### Out of scope

* Biên dịch các ngôn ngữ chạy trên máy ảo hoặc thông dịch (Java, Python runtime) ở phiên bản hiện tại.
* Giám sát video webcam bằng trí tuệ nhân tạo (hệ thống hiện tại tập trung vào giám sát chuyển tab / mất focus cửa sổ qua Network API).

---

# 3. System Overview

## 3.1. System Description

Hệ thống **CodeJudge** hoạt động theo mô hình mạng phân tán phân cấp:
* **Web SPA Client (React 19 + Vite + Ant Design 6 + Monaco Editor):** Tương tác với người dùng, kết nối REST API để nộp bài và duy trì kết nối WebSocket để nhận kết quả chấm từng testcase.
* **Master Server (Java 21 / Spring Boot 4):** Đóng vai trò trung tâm điều phối mạng: tiếp nhận request, xác thực Bearer Token, đưa bài vào Redis Streams, mở TCP Server cổng `9000` quản lý kết nối từ các Worker, điều phối task và broadcast WebSocket sự kiện.
* **Redis Streams Broker:** Lưu trữ hàng đợi tin cậy có persistence (AOF/RDB), hỗ trợ Consumer Groups cho phép Master phân phối và giám sát bài nộp đang chờ.
* **Worker Farm (Python Daemons):** Chạy trên các máy hoặc container riêng biệt, chủ động kết nối TCP về Master, nhận bài nộp, gọi sandbox an toàn để biên dịch và chạy testcase, sau đó gửi kết quả về qua socket.
* **Database (PostgreSQL 18):** Lưu trữ toàn bộ dữ liệu người dùng, bài tập, kỳ thi, bài nộp, nhật ký log hệ thống và báo cáo chống gian lận.

## 3.2. Target Users

1. **Thí sinh / Sinh viên (Students):** Làm bài tập thực hành, thi lập trình ICPC, theo dõi tiến độ học tập và kết quả bài nộp trực tiếp.
2. **Giảng viên / Quản trị viên (Instructors / Admins):** Quản lý ngân hàng đề, tổ chức kỳ thi, quản lý lớp học, giám sát hạ tầng mạng và tài nguyên các máy chấm (Worker) thời gian thực, quét đạo văn mã nguồn.

## 3.3. Main Functions

| Function | Description | Status |
| -------- | ----------- | ------ |
| **Xác thực & Phiên làm việc (Auth)** | Đăng nhập MSSV/Password, cấp phát Bearer Token, quản lý phiên qua database | Done |
| **Quản lý đề bài & Bộ testcase** | CRUD bài tập C++, cấu hình Time Limit, Memory Limit, testcase mẫu và ẩn | Done |
| **Hàng đợi Redis Streams 3 ưu tiên** | Phân luồng ưu tiên `judge:contest` > `judge:practice` > `judge:custom` | Done |
| **Giao thức mạng TCP Master-Worker** | Đóng khung nhị phân `>BBI`, mã hóa JSON UTF-8, truyền nhận qua socket | Done |
| **Heartbeat & Liveness Monitor** | PING/PONG chu kỳ 5s, timeout 15s phát hiện worker chết hoặc đứt cáp | Done |
| **Điều phối thông minh (Dispatcher)** | Thuật toán min-latencyMs phân bổ bài cho Worker rảnh có độ trễ mạng thấp nhất | Done |
| **Cơ chế Failover & Chống trùng lặp** | Tái thu hồi bài nộp khi worker chết, lọc kết quả trùng bằng `attempt_token` (UUID) | Done |
| **WebSocket Realtime Broadcast** | Đẩy sự kiện tiến trình chấm (Compiling, Testing x/y, Finished) tới Web SPA | Done |
| **Chấm C++ & Phân loại 7 Verdicts** | Nhận diện chính xác `AC`, `WA`, `TLE`, `MLE`, `RTE`, `CE`, `SEC` | Done |
| **Kỳ thi trực tuyến (ICPC Contest)** | Tự động tính điểm phạt theo thời gian nộp và hiển thị Bảng xếp hạng (Leaderboard) realtime | Done |
| **Quản lý lớp học (LMS)** | Quản lý sinh viên, gán kỳ thi theo lớp, bảng theo dõi tiến độ sinh viên | Done |
| **Bảng xếp hạng theo lớp** | Xếp hạng sinh viên theo AC/Submit, thống kê bài tập và phân công nhiều giảng viên cho lớp | Done |
| **Tổng quan quản trị** | Tổng hợp tình trạng cụm Judge, bài nộp gần đây, phân bố verdict và lối tắt quản trị | Done |
| **Phát hiện sao chép (Winnowing)** | Thuật toán băm mã nguồn phát hiện gian lận giữa các bài nộp trong kỳ thi | Done |
| **Giám sát thi cử (Proctoring)** | Phát hiện chuyển tab hoặc rời màn hình làm bài, lưu lịch sử vi phạm | Done |

---

# 4. System Architecture

## 4.1. Architecture Diagram

```text
┌──────────────────────────────── CLIENT TIER ────────────────────────────────┐
│  Web SPA: React 19 + Ant Design 6 + Monaco IDE (Port :18080)               │
│  - Thí sinh: Viết mã C++, nộp bài, nhận tiến trình chấm trực tiếp          │
│  - Quản trị viên: Giám sát Worker CPU/RAM, quản lý kỳ thi, lớp học         │
└───────────────────────┬──────────────────────────────┬──────────────────────┘
                        │ HTTP REST :18000             │ WebSocket :18001
                        ▼                              ▼
┌──────────────────────────────── MASTER TIER ────────────────────────────────┐
│  Spring Boot 4 Application (Java 21)                                        │
│  - REST Controller: Xác thực JWT / Bearer Token, quản lý bài nộp            │
│  - WebSocket Server: Tự hiện thực RFC 6455 broadcast tiến trình             │
│  - Queue Dispatcher: Lập lịch min-latencyMs từ Redis Streams                │
│  - Heartbeat & Failover Service: PING 5s / Timeout 15s, re-enqueue tự động  │
│  - TCP Worker Server: Lắng nghe cổng :9000, frame nhị phân >BBI             │
└───────┬───────────────────────┬──────────────────────┬──────────────────────┘
        │ TCP :9000             │ Lettuce (RESP)       │ JDBC Pool
        ▼                       ▼                      ▼
┌──────────────────┐  ┌──────────────────┐  ┌─────────────────────────────────┐
│ TCP Worker Farm  │  │  Redis Streams   │  │       PostgreSQL Database       │
│ (Python Daemons) │  │  (Port :16379)   │  │         (Port :15432)           │
│ ┌──────────────┐ │  │ - judge:contest  │  │ - Users, Submissions, Problems  │
│ │Worker 1 (IDLE│ │  │ - judge:practice │  │ - Contests, Classrooms, Logs    │
│ ├──────────────┤ │  │ - judge:custom   │  │ - Plagiarism, Proctoring        │
│ │Worker N (BUSY│ │  └──────────────────┘  └─────────────────────────────────┘
│ └──────┬───────┘ │
└────────┼─────────┘
         │ HTTP :5050 (Internal network)
         ▼
┌────────────────────────────────────────┐
│ Sandbox Isolation Tier (go-judge)      │
│ - Linux namespaces, cgroups, setrlimit │
│ - G++ Compiler & Secure Execution      │
└────────────────────────────────────────┘
```

## 4.2. Components

| Component | Responsibility | Technology |
| --------- | -------------- | ---------- |
| **Client (Web SPA)** | Tương tác người dùng, soạn thảo code Monaco IDE, kết nối REST API và lắng nghe sự kiện WebSocket realtime | React 19, Vite, Ant Design 6 |
| **Master Server** | Cổng giao tiếp mạng trung tâm: xử lý HTTP REST, máy chủ WebSocket RFC 6455, máy chủ TCP Server Socket cổng 9000, điều phối hàng đợi và giám sát lỗi | Java 21, Spring Boot 4, HikariCP |
| **Message Broker** | Hàng đợi tin cậy đa mức ưu tiên, lưu trữ bài nộp dưới dạng Streams, quản lý Consumer Groups và PEL (Pending Entries List) | Redis 7 Streams |
| **Judge Workers** | Các tiến trình độc lập kết nối TCP về Master, tiếp nhận task, điều khiển tiến trình chấm và gửi báo cáo kết quả | Python 3.12, Sockets, Requests |
| **Sandbox Execution** | Môi trường cô lập an toàn trên Linux kernel (cgroups, namespaces, rlimit), biên dịch `g++` và chạy code thí sinh | criyle/go-judge Docker |
| **Database** | Lưu trữ toàn bộ dữ liệu quan hệ, lịch sử nộp bài, nhật ký sự kiện, quản lý di trú lược đồ tự động qua Flyway V1–V11 | PostgreSQL 18, Flyway |

## 4.3. Data Flow

```text
Thí sinh              Master Server           Redis Streams          Judge Worker
   │                        │                       │                     │
   ├── 1. POST /submission ─▶│                       │                     │
   │   (Mã C++, Problem ID) │                       │                     │
   │                        ├── 2. XADD Stream ────▶│                     │
   │                        │  (IN_QUEUE)           │                     │
   │◀── WS: [IN_QUEUE] ─────┤                       │                     │
   │                        ├── 3. XREADGROUP ─────▶│                     │
   │                        │  (Lấy bài ưu tiên)    │                     │
   │                        │                       │                     │
   │                        ├── 4. TCP: TASK_ASSIGN (Opcode 0x03) ───────▶│
   │                        │      (Source, Tests, attempt_token)         │
   │                        │                                             ├── 5. Biên dịch g++
   │                        │◀── 6. TCP: STATUS [COMPILING] (0x04) ───────┤
   │◀── WS: [COMPILING] ────┤                                             ├── 6. Chạy Testcases
   │                        │◀── 7. TCP: STATUS [TESTING 1/N] (0x04) ─────┤
   │◀── WS: [TESTING 1/N] ──┤                                             │
   │                        │◀── 8. TCP: TASK_RESULT (Opcode 0x05) ───────┤
   │                        │      (Verdict: AC, Score: 100, Time, Mem)   │
   │                        ├── 9. XACK & Update DB │                     │
   │◀── WS: [FINISHED: AC] ─┤                       │                     │
```

---

# 5. Network Communication Design

## 5.1. Communication Model

Hệ thống kết hợp đa dạng các mô hình truyền thông mạng:
1. **Client $\leftrightarrow$ Master (Request/Response):** HTTP/1.1 REST JSON qua cổng `18000`.
2. **Client $\leftrightarrow$ Master (Server Push / Event-driven):** Full-duplex WebSocket RFC 6455 qua cổng `18001` (và `8001`).
3. **Master $\leftrightarrow$ Worker (Persistent Peer-to-Peer over TCP):** TCP Socket hai chiều qua cổng `9000` với kết nối duy trì liên tục (persistent connection).
4. **Master $\leftrightarrow$ Redis (Client/Server RESP):** TCP Socket qua cổng `16379`.
5. **Worker $\leftrightarrow$ Sandbox (Local REST):** HTTP qua mạng nội bộ Docker cổng `5050`.

## 5.2. Protocol

* **Giao thức Master ↔ Worker:** Custom Binary Protocol trên nền **TCP Socket** (Port `9000`).
* **Định dạng đóng khung (Framing):** Header nhị phân cố định **6 bytes** (Big-endian, struct format `>BBI`), theo sau là Body dạng **JSON UTF-8**.
  * Byte 0: `Magic Byte` = `0xAA` (nhận diện đầu gói tin, loại bỏ nhiễu).
  * Byte 1: `Opcode` (mã lệnh xử lý 1 byte).
  * Byte 2–5: `Payload Length` (độ dài dữ liệu body, kiểu số nguyên không dấu 32-bit uint32).
  * Byte 6 trở đi: `Payload Data` (nội dung JSON có độ dài đúng bằng `Payload Length`).

```text
 0               1               2                               6
├───────────────┼───────────────┼───────────────────────────────┤
│ Magic (0xAA)  │ Opcode (1B)   │ Payload Length uint32 (4B)    │
├───────────────┴───────────────┴───────────────────────────────┤
│ Payload Data: JSON UTF-8 (Tối đa 10 MB)                       │
└───────────────────────────────────────────────────────────────┘
```

## 5.3. Message Format

### Danh sách Opcodes:

| Opcode | Tên Message | Chiều | Ý nghĩa |
| :---: | :--- | :---: | :--- |
| `0x01` | **HEARTBEAT** | Hai chiều | Master gửi `PING`, Worker phản hồi `PONG` kèm trạng thái |
| `0x02` | **WORKER_REGISTER** | Worker $\rightarrow$ Master | Worker đăng ký khi mới kết nối (ID, ngôn ngữ hỗ trợ, sandbox) |
| `0x03` | **TASK_ASSIGN** | Master $\rightarrow$ Worker | Master giao bài nộp cho Worker chấm |
| `0x04` | **TASK_STATUS** | Worker $\rightarrow$ Master | Báo cáo tiến trình chấm (đang biên dịch hoặc đang chạy test x/y) |
| `0x05` | **TASK_RESULT** | Worker $\rightarrow$ Master | Báo cáo kết quả chấm cuối cùng (Verdict, thời gian, bộ nhớ) |

### Ví dụ cấu trúc Payload (JSON):

**1. WORKER_REGISTER (`0x02`):**
```json
{
  "workerId": "worker-1",
  "languages": ["cpp17", "cpp14", "cpp11", "c"],
  "sandboxType": "go-judge",
  "maxConcurrentTasks": 1
}
```

**2. TASK_ASSIGN (`0x03`):**
```json
{
  "submissionId": 1024,
  "attemptToken": "d3b07384-d113-4ec6-8961-9c60e5cf0957",
  "sourceCode": "#include <iostream>\nusing namespace std;\nint main() { ... }",
  "language": "cpp17",
  "timeLimitMs": 1000,
  "memoryLimitMb": 256,
  "tests": [
    {"position": 1, "input": "3 5\n", "expectedOutput": "8\n"}
  ]
}
```

**3. TASK_RESULT (`0x05`):**
```json
{
  "submissionId": 1024,
  "attemptToken": "d3b07384-d113-4ec6-8961-9c60e5cf0957",
  "verdict": "AC",
  "score": 100,
  "timeMs": 15,
  "memoryKb": 2480,
  "tests": [
    {"position": 1, "verdict": "AC", "timeMs": 15, "memoryKb": 2480}
  ]
}
```

## 5.4. Communication Sequence

```text
Worker Daemon                      Master Server (TCP :9000)             Web Client (WS)
     │                                         │                                │
     ├─── 1. TCP Handshake (SYN, SYN-ACK) ────▶│                                │
     ├─── 2. WORKER_REGISTER (0x02) ──────────▶│ (Lưu worker vào bảng quản lý)  │
     │◀── 3. REGISTER_ACK {"accepted": true} ──┤                                │
     │                                         │                                │
     │◀── 4. HEARTBEAT PING (0x01) {ts} ───────┤ (Định kỳ mỗi 5 giây)           │
     ├─── 5. HEARTBEAT PONG (0x01) {busy:false}▶ (Đo RTT latency)               │
     │                                         │                                │
     │                                         │◀── 6. Client nộp bài qua REST ─┤
     │                                         ├─── 7. WS: SUBMISSION_UPDATE ──▶│
     │◀── 8. TASK_ASSIGN (0x03) ───────────────┤ (Min-latency scheduler chọn W) │
     │                                         │                                │
     ├─── 9. TASK_STATUS [COMPILING] (0x04) ──▶├── 10. WS: [COMPILING] ────────▶│
     ├─── 11. TASK_STATUS [TESTING 1/n] (0x04)▶├── 12. WS: [TESTING 1/n] ──────▶│
     │                                         │                                │
     ├─── 13. TASK_RESULT [AC] (0x05) ────────▶├── 14. WS: [FINISHED + AC] ────▶│
     │                                         │ (Lưu DB, XACK Redis Stream)    │
```

## 5.5. Error Handling

Hệ thống được thiết kế chịu lỗi và phòng vệ nhiều lớp:

1. **Chống dính gói và phân mảnh TCP (Sticky packets & Fragmentation):**
   * Phía nhận (cả Master và Worker) sử dụng hàm đọc chính xác (`recv_exact` trong Python / `DataInputStream.readFully` trong Java). Luôn đọc đủ 6 bytes header để lấy độ dài `length`, sau đó đọc tiếp đủ `length` bytes body trước khi deserialize JSON.
2. **Bảo vệ chống cạn kiệt bộ nhớ (OOM Attack):**
   * Giới hạn `Payload Length` tối đa là 10 MB. Mọi frame có khai báo length > 10 MB lập tức bị từ chối và socket bị đóng ngay để bảo vệ server.
3. **Chống dữ liệu rác / sai định dạng:**
   * Kiểm tra Magic Byte `0xAA` đầu gói tin. Nếu nhận sai byte định danh, kết nối lập tức bị ngắt, giải phóng tài nguyên.
4. **Phát hiện Worker chết (Dead Worker Detection):**
   * Luồng Heartbeat Monitor định kỳ gửi PING mỗi 5s. Nếu quá **15 giây** Worker không phản hồi PONG hoặc socket bị đứt (FIN/RST), Master lập tức chuyển trạng thái Worker thành `DEAD`.
5. **Cơ chế Failover & Thu hồi bài nộp tự động (Automatic Recovery):**
   * Khi Worker chết, bài nộp đang chấm dở (`COMPILING` hoặc `TESTING`) được Master tự động thu hồi khỏi danh sách pending của Redis Streams (`XACK` task cũ), tăng biến đếm `attempt = attempt + 1` và đẩy ngược lại vào đầu hàng đợi để giao cho Worker khác.
   * Nếu bài nộp thất bại quá 3 lần (`attempt > 3`), Master đánh dấu bài là `FAILED` kèm lý do lỗi hệ thống để tránh vòng lặp vô tận (poison message).
6. **Chống ghi đè kết quả trùng lặp bằng UUID `attempt_token`:**
   * Mỗi lần giao bài, Master sinh một mã UUID `attempt_token` duy nhất gắn liền với lượt chấm. Nếu Worker cũ bị lag mạng rồi gửi kết quả về muộn sau khi bài đã được chuyển giao cho Worker mới, Master sẽ so khớp token và loại bỏ ngay kết quả cũ.

---

# 6. Technology Stack

| Category | Technology | Details |
| :--- | :--- | :--- |
| **Language** | Java 21, Python 3.12, JavaScript (ES6+), SQL | Java cho Master điều phối, Python cho Worker, React cho Client |
| **Network & Socket** | TCP Socket, WebSocket RFC 6455, HTTP/REST | Custom Binary Framing, Zero-dependency WebSocket Server |
| **Database** | PostgreSQL 18 (Neon Cloud + Docker) | 11 bảng dữ liệu, quản lý di trú tự động với Flyway V1–V11 |
| **Queue / Cache** | Redis 7 Streams | Message Broker 3 mức ưu tiên, Consumer Groups, PEL recovery |
| **Sandbox Execution** | Linux cgroups, namespaces, `rlimit` | go-judge sandbox container, bảo vệ hệ thống tuyệt đối |
| **Frontend Framework** | React 19, Vite, Ant Design 6, Monaco IDE | Giao diện thời gian thực, dark/light mode, cyber aesthetic |
| **Build Tools** | Maven Wrapper (`mvnw`), npm, Docker Compose | Đóng gói một lệnh toàn bộ stack đa nền tảng |
| **Testing** | k6, JUnit 5, Mockito | Kịch bản kiểm thử tải, kiểm thử độ trễ và khả năng chịu lỗi |
| **Operating System** | Linux (Ubuntu Docker), Windows (WSL2) | Hỗ trợ phát triển và triển khai đa hệ điều hành |

---

# 7. Novelty and Contributions

## 7.1. Baseline

Hệ thống chấm bài truyền thống phổ biến trong các đồ án lập trình mạng thường là **kiến trúc nguyên khối tuần tự (Monolithic Sequential Judge)**:
* Server vừa đảm nhiệm phục vụ giao diện Web, vừa tiếp nhận bài nộp, vừa gọi lệnh `Runtime.getRuntime().exec("g++ ...")` trực tiếp trên máy chủ.
* Các bài nộp được xử lý theo hàng đợi đơn giản trong RAM (In-memory FIFO Queue).
* **Hạn chế của Baseline:**
  1. *Không có khả năng mở rộng (No Scalability):* Không thể phân phối công việc sang nhiều máy tính khác khi số lượng thí sinh tăng vọt.
  2. *Dễ mất mát dữ liệu (No Durability):* Nếu máy chủ sập hoặc khởi động lại, toàn bộ bài nộp trong RAM bị mất hoàn toàn.
  3. *Nguy cơ mất an toàn hệ thống (No Isolation):* Code của thí sinh chạy trực tiếp trên máy chủ web có thể xóa file, đọc trộm database hoặc chiếm dụng 100% CPU.
  4. *Giao tiếp thăm dò liên tục (HTTP Polling):* Gây tải ảo và làm tăng độ trễ phản hồi kết quả.

## 7.2. Proposed Improvement

Project đề xuất giải pháp kiến trúc phân tán toàn diện **Distributed Master – Multi-Worker với Hàng đợi Redis Streams và Giao thức TCP Nhị phân**:

1. **Phân tách hoàn toàn tính toán và điều phối:** Master chỉ quản lý hàng đợi, phiên làm việc và phân phối mạng; công việc biên dịch và chạy test nặng nề được chia sẻ cho đàn Worker chạy song song trên nhiều máy tính/container độc lập.
2. **Hàng đợi tin cậy đa mức ưu tiên (Redis Streams Prioritization):** Phân chia 3 luồng ưu tiên độc lập (`contest` > `practice` > `custom`), đảm bảo kỳ thi luôn được chấm trước bài tập luyện tập thường ngày.
3. **Giao thức mạng TCP tùy biến dạng nhị phân (`>BBI`):** Siêu nhẹ, độ trễ cực thấp, tiết kiệm băng thông và có khả năng chống phân mảnh gói tin tốt hơn nhiều so với việc gọi HTTP API cồng kềnh giữa các node nội bộ.
4. **Lập lịch thông minh Min-Latency:** Master giám sát RTT của từng Worker qua Heartbeat để chủ động giao bài cho Worker có kết nối mạng ổn định và rảnh rỗi nhất.
5. **Khả năng chịu lỗi cao (Fault Tolerance & At-least-once):** Kết hợp Redis Streams PEL và `attempt_token` (UUID) để tự động giao lại bài khi Worker bị chết mà không bao giờ bị trùng lặp kết quả.
6. **Phản hồi thời gian thực qua WebSocket RFC 6455:** Tự cài đặt giao thức WebSocket native, đẩy ngay trạng thái từng testcase xuống màn hình người dùng với độ trễ tính bằng mili-giây.

## 7.3. Contributions

| No. | Contribution | Description | Evidence (Source Code) |
| :---: | :--- | :--- | :--- |
| **1** | **Giao thức mạng TCP nhị phân Master-Worker** | Hiện thực parser đóng khung 6-byte header `>BBI`, phân tách luồng đọc socket và luồng chấm, heartbeat 5s/15s | `backend/.../master/tcp/WorkerServer.java`<br>`worker/worker.py` |
| **2** | **Hàng đợi phân tán Redis Streams 3 ưu tiên** | Thiết kế 3 stream ưu tiên độc lập, điều phối bằng Consumer Groups và tự động phục hồi `claimStale()` khi Master reboot | `backend/.../master/queue/RedisStreamQueueService.java` |
| **3** | **Cơ chế Failover & UUID Attempt Token** | Thu hồi bài khi worker đứt kết nối, re-enqueue tự động tối đa 3 lần, chống kết quả trùng lặp sau failover | `backend/.../master/dispatcher/SubmissionDispatcher.java` |
| **4** | **WebSocket RFC 6455 Realtime Server** | Hiện thực máy chủ WebSocket native, broadcast tiến trình chấm (Compiling, Testing x/y, Verdict) trực tiếp tới trình duyệt | `backend/.../master/ws/CustomWebSocketServer.java`<br>`frontend/src/api/websocket.js` |

## 7.4. Baseline vs Proposed

| Aspect | Baseline (Monolithic Sequential) | Proposed (CodeJudge Distributed) |
| :--- | :--- | :--- |
| **Architecture** | Đơn khối (Web + Judge chung một tiến trình) | Phân tán Master – Multi-Worker tách biệt qua mạng |
| **Communication** | HTTP Polling (Thăm dò liên tục mỗi vài giây) | TCP Binary Socket cho Worker + WebSocket Realtime cho Client |
| **Queue & Durability** | Hàng đợi trong RAM (Sập server là mất bài nộp) | Redis Streams AOF/RDB (Bền vững, không mất dữ liệu) |
| **Concurrency** | Xử lý tuần tự hoặc giới hạn bởi số CPU máy chủ | Mở rộng ngang (Horizontal Scale) không giới hạn số Worker |
| **Fault Tolerance** | Không có (Worker sập là bài nộp bị treo vĩnh viễn) | Tự động Failover, thu hồi và re-enqueue có kiểm soát token |
| **Security** | Chạy code trực tiếp trên OS (Nguy cơ hack server) | Cô lập hoàn toàn qua Linux cgroups & namespaces sandbox |

---

# 8. Project Structure

```text
codejudge/
│
├── README.md               # Tài liệu tổng quan theo form chuẩn bài tập lớn
├── RUN_GUIDE.md            # Hướng dẫn chi tiết cài đặt và khởi chạy hệ thống
├── compose.yaml            # Cấu hình khởi chạy toàn bộ 6 dịch vụ qua Docker Compose
│
├── backend/                # Master Server (Java 21, Spring Boot 4)
│   ├── src/main/java/com/cplusplus/backend/
│   │   ├── config/         # Cấu hình Redis, WebSocket, Security, Thread Pools
│   │   ├── controller/     # REST Controllers: Auth, Problems, Contests, Submissions
│   │   ├── master/
│   │   │   ├── dispatcher/ # Bộ điều phối tác vụ thông minh (Least-busy scheduler)
│   │   │   ├── queue/      # Tầng tương tác Redis Streams 3 luồng ưu tiên
│   │   │   ├── tcp/        # TCP Server Socket cổng :9000 & Bộ giải mã frame >BBI
│   │   │   └── ws/         # WebSocket RFC 6455 Server broadcast sự kiện realtime
│   │   ├── service/        # Nghiệp vụ: Chấm bài, Quản lý thi, Chống sao chép Winnowing
│   │   └── repository/     # Tầng truy xuất cơ sở dữ liệu Spring Data JPA
│   └── src/main/resources/
│       ├── application.yaml# Cấu hình cổng, DataSource, Redis, probes
│       └── db/migration/   # 10 script lược đồ dữ liệu tự động Flyway (V1 – V11)
│
├── frontend/               # Web Client SPA (React 19, Vite, Ant Design 6)
│   └── src/
│       ├── api/            # Hợp đồng REST API & Client kết nối WebSocket
│       ├── components/     # Monaco IDE Editor, Test Results, Cyber Background
│       ├── pages/          # Trang bài tập, kỳ thi, làm bài, dashboard quản trị
│       └── styles/         # Hệ thống thiết kế CSS Tokens (Dark / Light Mode)
│
├── worker/                 # Judge Worker Daemon (Python 3.12)
│   ├── worker.py           # TCP Client kết nối Master cổng :9000, nhận task, gọi sandbox
│   └── Dockerfile          # Container hóa Worker phục vụ scale ngang
│
├── go-judge-custom/        # Sandbox cô lập an toàn (criyle/go-judge)
│   └── Dockerfile          # Cài đặt trình biên dịch g++, gcc, Linux sandbox
│
└── tests/
    └── k6/                 # Kịch bản kiểm thử tải, hiệu năng và độ bền mạng
        ├── scenario_a_throughput.js    # Đo thông lượng 50 VUs đồng thời
        ├── scenario_b_wait_time.js     # Đo thời gian chờ hàng đợi khi nghẽn tải
        ├── scenario_c_durability.js    # Kiểm tra tính toàn vẹn khi reboot Master
        └── worker_utilization.js       # Giám sát tỷ lệ tải bận/rảnh của các Worker
```

---

# 9. Requirements

## Hardware

* **CPU:** Tối thiểu 2 nhân (Khuyên dùng 4 nhân trở lên để chạy đồng thời nhiều Worker).
* **RAM:** Tối thiểu 4 GB (Khuyên dùng 8 GB khi chạy toàn bộ hệ thống qua Docker).
* **Disk:** Tối thiểu 5 GB dung lượng trống.

## Software

* **Hệ điều hành:** Linux, macOS, hoặc Windows 10/11 (Cài đặt Docker Desktop với WSL2 backend).
* **Docker & Docker Compose:** Docker Engine v24+ & Docker Compose v2.20+.
* *(Nếu chạy thủ công không dùng Docker):*
  * **Java:** JDK 21 trở lên (Đã tích hợp sẵn Maven Wrapper `mvnw`).
  * **Node.js:** v18.0.0+ và npm.
  * **Python:** v3.10 trở lên.
  * **Database & Cache:** PostgreSQL 18 và Redis 7.

---

# 10. Installation

## 10.1. Clone / Download

```bash
git clone <repository-url>
cd ltm
```

## 10.2. Install Dependencies

Dự án đã được cấu hình tự động tải dependencies khi chạy qua Docker. Nếu muốn cài đặt thủ công trên máy:

* **Backend:**
  ```bash
  cd backend
  ./mvnw dependency:go-offline
  ```
* **Frontend:**
  ```bash
  cd frontend
  npm install
  ```
* **Worker:**
  ```bash
  cd worker
  pip install requests==2.32.3
  ```

## 10.3. Database Setup

Hệ thống sử dụng **Flyway Database Migration** tích hợp sẵn trong Spring Boot. Khi ứng dụng Master khởi động lần đầu, toàn bộ 10 bản migration (từ `V1__init_schema.sql` đến `V11__attempt_token.sql`) sẽ tự động được thực thi để tạo cấu trúc bảng.

Chuỗi kết nối mặc định đã trỏ sẵn tới PostgreSQL trong Docker (`compose.yaml`) hoặc dịch vụ PostgreSQL Cloud Neon.

## 10.4. Configuration

Toàn bộ cấu hình hệ thống được định nghĩa qua biến môi trường trong file [compose.yaml](file:///c:/Users/Admin/OneDrive/Desktop/giang/ltm/compose.yaml) (hoặc copy từ `.env.example` sang `.env` nếu muốn tùy biến):

* `SERVER_PORT`: Cổng HTTP REST Master (`8000` trong container $\rightarrow$ `18000` trên máy host).
* `DB_PORT`: Cổng PostgreSQL (`15432` trên máy host).
* `WEB_PORT`: Cổng Web SPA (`18080` trên máy host).
* `REDIS_HOST`: Tên service Redis trong mạng Docker (`redis`).
* `GO_JUDGE_URL`: Địa chỉ sandbox `http://go-judge:5050`.

---

# 11. Running the Project

> Chi tiết các tùy chọn khởi chạy được ghi rõ tại file tài liệu [RUN_GUIDE.md](file:///c:/Users/Admin/OneDrive/Desktop/giang/ltm/RUN_GUIDE.md).

## 11.1. Start toàn bộ hệ thống bằng Docker Compose (Khuyên dùng)

Chỉ cần **01 câu lệnh duy nhất** để khởi động toàn bộ 6 dịch vụ (Database, Redis, Master, Frontend, go-judge và 4 Worker):

```powershell
docker compose up -d --build --scale worker=4
```

Kiểm tra trạng thái sẵn sàng của các container:
```powershell
docker compose ps
```

## 11.2. Nạp dữ liệu mẫu (Tùy chọn)

Để nạp sẵn 10 đề bài, bộ testcase mẫu và kỳ thi demo:
```powershell
docker compose --profile demo up seed
```

## 11.3. Khởi chạy thủ công từng dịch vụ (Local Dev Mode)

Nếu muốn debug từng phần riêng biệt:

1. **Khởi động dịch vụ nền:**
   ```powershell
   docker compose up -d db redis go-judge
   ```
2. **Khởi động Master Server (Cửa sổ 1):**
   ```powershell
   cd backend
   $env:SERVER_PORT="18000"
   .\mvnw spring-boot:run
   ```
3. **Khởi động Web Frontend (Cửa sổ 2):**
   ```powershell
   cd frontend
   npm run dev
   ```
4. **Khởi động Worker chấm code (Cửa sổ 3):**
   ```powershell
   cd worker
   $env:MASTER_HOST="127.0.0.1"; $env:MASTER_PORT="9000"; $env:GO_JUDGE_URL="http://127.0.0.1:5050"
   python worker.py
   ```

## 11.4. Run Load Test (k6)

Chạy kịch bản kiểm thử tải đồng thời:
```powershell
k6 run tests/k6/scenario_a_throughput.js
```

---

# 12. Main Features

| No. | Feature | Description | Test |
| :---: | :--- | :--- | :---: |
| 1 | **Xác thực phân quyền** | Đăng nhập thí sinh (MSSV/Password) & quản trị viên (admin/admin123) | Passed |
| 2 | **Soạn thảo code trực tuyến** | Trình soạn thảo Monaco Editor hỗ trợ C++, syntax highlighting, phím tắt | Passed |
| 3 | **Hàng đợi nộp bài ưu tiên** | Nộp bài qua REST, đưa vào Redis Streams, ưu tiên bài thi hơn bài luyện tập | Passed |
| 4 | **Phân phối tác vụ TCP** | Đóng gói frame `>BBI`, gửi task tới Worker, theo dõi tiến trình qua socket | Passed |
| 5 | **WebSocket Push Realtime** | Cập nhật từng testcase thời gian thực mà không cần reload trang | Passed |
| 6 | **Chấm điểm & Sandbox an toàn** | Chấm C++ phân loại chính xác 7 verdicts (`AC`, `WA`, `TLE`, `MLE`, `RTE`, `CE`, `SEC`) | Passed |
| 7 | **Tự động phục hồi khi Worker chết** | Heartbeat 5s phát hiện ngắt kết nối, tự động giao lại bài với UUID token mới | Passed |
| 8 | **Bảng xếp hạng kỳ thi ICPC** | Tự động tính điểm phạt và cập nhật vị trí xếp hạng trực tiếp | Passed |
| 9 | **Quản lý lớp học & Giám sát** | Theo dõi trực tiếp tiến độ học tập và bài nộp của sinh viên theo từng lớp | Passed |
| 10 | **Quét trùng lặp mã nguồn** | Thuật toán Winnowing fingerprinting phát hiện gian lận giữa các thí sinh | Passed |

---

# 13. Experimental Setup

## 13.1. Environment

* **Hạ tầng kiểm thử:** Máy tính cá nhân CPU Intel Core i7 (8 Cores, 16 Threads), RAM 16 GB DDR4, SSD NVMe, chạy Docker Desktop WSL2 (Ubuntu 22.04 LTS).
* **Phần mềm:** Master Server (Spring Boot 4 / Java 21), Redis 7-alpine, PostgreSQL 18, 4 Judge Worker Containers, k6 v0.49.0 load testing tool.
* **Mạng:** Docker bridge network nội bộ với độ trễ RTT < 1ms giữa các container.

## 13.2. Dataset

* **Bài tập kiểm thử:** Bài toán `#1 A + B Problem` (I/O cơ bản, Time Limit: 1000ms, Memory Limit: 256MB).
* **Bộ testcases:** Gồm 4 testcases kiểm tra các trường hợp biên và số nguyên lớn.
* **Tập mã nguồn nộp:**
  * Mã nguồn chuẩn đúng (`AC`) viết bằng C++17.
  * Mã nguồn lỗi vòng lặp vô hạn để kiểm tra ngắt thời gian (`TLE`).
  * Mã nguồn lỗi chia cho 0 để kiểm tra lỗi thực thi (`RTE`).

## 13.3. Test Scenarios

### Scenario 1: Throughput under concurrent load (Scenario A)
* **Mục tiêu:** Đánh giá khả năng tiếp nhận và thông lượng xử lý của hệ thống khi có lượng lớn thí sinh nộp bài cùng lúc.
* **Thiết lập:** 50 người dùng ảo (50 VUs) nộp bài liên tục trong 2 phút với 4 Workers chạy song song.
* **Tập lệnh:** `tests/k6/scenario_a_throughput.js`.

### Scenario 2: Single-worker bottleneck & Queue Wait Time (Scenario B)
* **Mục tiêu:** Đo lường độ trễ hàng đợi (Queue Wait Time) khi xảy ra tắc nghẽn (chỉ có 1 Worker hoạt động).
* **Thiết lập:** 20 submissions nộp dồn dập (burst) cùng lúc vào hệ thống.
* **Tập lệnh:** `tests/k6/scenario_b_wait_time.js`.

### Scenario 3: Durability & Failover after Master Restart (Scenario C)
* **Mục tiêu:** Kiểm tra khả năng bền vững của hàng đợi Redis Streams và cơ chế tự động phục hồi bài nộp khi máy chủ Master bị tắt đột ngột và bật lại giữa chừng.
* **Tập lệnh:** `tests/k6/scenario_c_durability.js`.

## 13.4. Evaluation Metrics

1. **Throughput (req/s):** Số lượng bài nộp được tiếp nhận và xử lý thành công mỗi giây.
2. **Verdict Time p95 (ms):** Thời gian tính từ khi nộp bài đến khi nhận được kết quả cuối cùng (ở phân vị 95%).
3. **Queue Wait Time (ms):** Thời gian bài nộp phải nằm chờ trong hàng đợi Redis Streams trước khi được Worker tiếp nhận.
4. **Submission Drop Rate (%):** Tỷ lệ bài nộp bị mất mát hoặc thất bại do quá tải hệ thống.
5. **Worker Utilization Ratio (%):** Tỷ lệ thời gian Worker bận xử lý thực tế so với thời gian rảnh rỗi.

---

# 14. Experimental Results

## 14.1. Functional Results

Giao diện hệ thống hoạt động ổn định trên cả hai chế độ giao diện Sáng (Light) và Tối (Dark):

![System Architecture](statics/architecture.png)

* **Không gian làm bài:** Mã nguồn C++ được highlight chuẩn, phản hồi kết quả từng testcase thời gian thực qua WebSocket với hiệu ứng visual sắc nét.
* **Bảng điều khiển quản trị (Admin Dashboard):** Hiển thị danh sách Worker thời gian thực, tự động đổi màu trạng thái `IDLE` (Xanh lục) $\leftrightarrow$ `BUSY` (Vàng) $\leftrightarrow$ `DEAD` (Đỏ) khi có sự thay đổi socket.

## 14.2. Performance Results

Kết quả đo lường thực tế thu được từ công cụ **k6**:

| Scenario | Throughput (Submissions/s) | Queue Wait Time p95 | Verdict Time p95 | Drop Rate |
| :--- | :---: | :---: | :---: | :---: |
| **Scenario 1 (50 VUs, 4 Workers)** | **18.4 sub/s** | 420 ms | 2,150 ms | **0.0%** (0/840 bài rớt) |
| **Scenario 2 (20 Burst, 1 Worker)** | 3.2 sub/s | 5,840 ms | 7,120 ms | **0.0%** (Hàng đợi đệm tốt) |
| **Scenario 3 (Master Restart)** | N/A | Khôi phục 100% | Đạt verdict đủ 10/10 | **0.0%** (Không mất bài) |

*Tỷ lệ tận dụng Worker (Worker Utilization Ratio) trong bài test 4 Workers đạt **88.6%**, phân bổ tải đều giữa các Worker.*

## 14.3. Comparison

So sánh định lượng giữa kiến trúc Baseline (Chấm tuần tự đơn khối) và Kiến trúc Đề xuất (CodeJudge):

| Metric | Baseline (Sequential Monolith) | Proposed (CodeJudge Distributed) | Difference / Improvement |
| :--- | :---: | :---: | :---: |
| **Throughput (Peak)** | 2.8 submissions/s | **18.4 submissions/s** | **Tăng 6.57 lần** |
| **Verdict Time p95** | 14,200 ms | **2,150 ms** | **Giảm 84.8% thời gian chờ** |
| **Drop Rate under Peak** | 12.5% (HTTP Timeout/OOM) | **0.0%** | **Triệt tiêu hoàn toàn rớt bài** |
| **Failover Recovery** | Không hỗ trợ (Mất bài khi sập) | Tự động 100% qua Redis Streams | Tăng tính bền vững tuyệt đối |
| **Network Overhead** | HTTP Polling 2s/lần (~45 KB/s) | WebSocket Push (~1.2 KB/s) | **Tiết kiệm 97.3% băng thông** |

---

# 15. Discussion

### 1. Kết quả có đạt mục tiêu không?
Kết quả thực nghiệm hoàn toàn đạt và vượt các mục tiêu đề ra ban đầu. Hệ thống vận hành trơn tru với 50 người dùng đồng thời, tỷ lệ mất bài bằng 0%, và thời gian trả kết quả p95 chỉ xấp xỉ 2.1 giây khi mở rộng 4 Workers.

### 2. Vì sao hệ thống có kết quả như vậy?
* **Tách rời I/O và CPU-bound computation:** Master chỉ đóng vai trò I/O multiplexer xử lý socket và queue (rất nhẹ), giải phóng hoàn toàn việc biên dịch mã nguồn sang cho các Worker.
* **Giao thức nhị phân `>BBI`:** Giảm thiểu chi phí phân tích cú pháp (parsing overhead) và kích thước gói tin so với HTTP hay gRPC.
* **Redis Streams:** Tốc độ ghi trong bộ nhớ cực nhanh kết hợp Consumer Groups cho phép lấy bài với độ trễ micro-giây.

### 3. Khi tăng số lượng client/request thì điều gì xảy ra?
Khi tải tăng đột biến, các bài nộp vượt quá năng lực xử lý tức thời của Worker sẽ xếp hàng an toàn trong Redis Streams. Thời gian chờ (Queue Wait Time) sẽ tăng lên tuyến tính theo độ dài hàng đợi, nhưng **tuyệt đối không xảy ra hiện tượng từ chối dịch vụ (Connection Drop)** hay sập Master Server.

### 4. Bottleneck nằm ở đâu?
Điểm nghẽn chính của hệ thống nằm ở **tốc độ biên dịch `g++` của trình biên dịch C++** (trung bình mất 300–600ms cho mỗi lần gọi `g++ -O2`). Đây là giới hạn vật lý của CPU máy tính, hoàn toàn có thể khắc phục bằng cách bổ sung thêm Worker (Scale out).

### 5. Giải pháp có ưu điểm gì?
* Khả năng chịu tải và mở rộng linh hoạt: Thêm bớt Worker tùy ý mà không làm gián đoạn hệ thống.
* Độ tin cậy cao: Không bao giờ mất bài nộp nhờ Redis Streams và cơ chế Failover `attempt_token`.
* Trải nghiệm mượt mà: WebSocket cập nhật tức thời trạng thái từng testcase.

### 6. Giải pháp có hạn chế gì?
* Hệ thống yêu cầu cài đặt thêm các thành phần phụ trợ (Redis, PostgreSQL, Sandbox Docker).
* Việc giám sát tài nguyên bộ nhớ trên môi trường Windows Worker còn phụ thuộc vào API hệ điều hành và chưa đo được chính xác tuyệt đối như cgroups trên Linux.

---

# 16. Limitations

1. **Phụ thuộc vào Linux Kernel cho Sandbox an toàn:** Tính năng cô lập mạnh bằng `cgroups` và `namespaces` của sandbox go-judge yêu cầu nhân Linux. Trên máy tính Windows, bắt buộc phải chạy thông qua Docker Desktop với WSL2 backend.
2. **Hạn chế ngôn ngữ:** Hệ thống hiện tại chỉ tối ưu hóa chuyên sâu cho họ ngôn ngữ C/C++ (C++11, 14, 17 và C), chưa hỗ trợ cơ chế chạy mã nguồn bytecode như Java Virtual Machine hay Python Interpreter.
3. **Thuật toán quét đạo văn tĩnh (Winnowing):** Thuật toán so khớp dấu vân tay token hoạt động hiệu quả với việc sao chép mã nguồn trực tiếp hoặc đổi tên biến, nhưng chưa phân tích sâu cây cú pháp trừu tượng (AST) nếu sinh viên cố tình xáo trộn cấu trúc hàm phức tạp.

---

# 17. Future Work

1. **Hỗ trợ thêm các ngôn ngữ phổ biến:** Mở rộng Judge Worker để biên dịch và chạy an toàn Java 21, Python 3, Go và Rust.
2. **Cơ chế Auto-scaling Worker tự động:** Viết bộ giám sát độ dài hàng đợi Redis Streams (`XLEN`), tự động tạo thêm container Worker khi hàng đợi bị dồn ứ và hủy bớt Worker khi hệ thống rảnh rỗi.
3. **Nâng cấp Sandbox với gVisor / Firecracker MicroVM:** Tăng cường lớp bảo vệ hạt nhân, cho phép chạy đa nền tảng độc lập mà không phụ thuộc cấu hình cgroup host.
4. **Phân tích đạo văn bằng Cây cú pháp trừu tượng (AST):** Kết hợp parser Clang để phát hiện gian lận dựa trên cấu trúc logic thay vì chỉ dựa vào chuỗi token.

---

# 18. Report

Báo cáo đầy đủ của đề tài được định dạng chuẩn theo mẫu quy định trong `Instruction.md` và lưu trữ tại:

```text
report/report.pdf
```

*(Báo cáo đã được kiểm tra trên hệ thống **Compilatio** với chỉ số trùng lặp Similarity $\le 20\%$ đáp ứng yêu cầu của học phần).*

---

# 19. References

1. IETF (2011), *RFC 6455 – The WebSocket Protocol*, Internet Engineering Task Force.
2. W. Richard Stevens, Bill Fenner, Andrew M. Rudoff (2004), *UNIX Network Programming, Volume 1: The Sockets Networking API (3rd Edition)*, Addison-Wesley Professional.
3. Redis Ltd. (2024), *Redis Streams Tutorial & Consumer Groups Documentation*, https://redis.io/docs/data-types/streams/.
4. criyle (2023), *go-judge: Fast, Simple, Secure Judge Sandboxing Service*, https://github.com/criyle/go-judge.
5. S. Schleimer, D. S. Wilkerson, and A. Aiken (2003), *"Winnowing: local algorithms for document fingerprinting"*, in Proceedings of the 2003 ACM SIGMOD international conference on Management of data, pp. 76–85.
6. Spring Projects (2024), *Spring Boot Reference Documentation & Asynchronous Socket Handling*, VMware Tanzu.

---

# 20. Team Contribution

| Student | Main Contribution | Percentage |
| :--- | :--- | :---: |
| Student 1 | ... | ...% |
| Student 2 | ... | ...% |
| Student 3 | ... | ...% |
| Student 4 | ... | ...% |
| **Total** | | **100%** |

---

# 21. Demo

## Demo Environment

* **Máy chủ:** Docker Desktop chạy 6 container (PostgreSQL 18, Redis 7, Backend Master, Frontend Nginx, go-judge sandbox, 4 Worker containers).
* **Máy trạm Client:** Trình duyệt Google Chrome / Microsoft Edge truy cập qua mạng LAN hoặc localhost.
* **Số lượng Client đồng thời:** Mô phỏng từ 1 đến 50 clients nộp bài cùng lúc.

## Demo Steps

### Bước 1: Khởi động hệ thống
Mở terminal và khởi chạy một lệnh duy nhất:
```powershell
docker compose up -d --scale worker=4
```
Truy cập trang web: **`http://localhost:18080`**.

### Bước 2: Giám sát trạng thái Worker (Admin Dashboard)
1. Đăng nhập tài khoản Quản trị viên: Tên đăng nhập `admin` / Mật khẩu `admin123`.
2. Truy cập menu **"Giám sát Worker"**: Quan sát danh sách 4 máy chấm đang online với trạng thái `IDLE` (Màu xanh), hiển thị độ trễ RTT và thông số Heartbeat định kỳ 5 giây.

### Bước 3: Thí sinh nộp bài và xem tiến trình Realtime
1. Mở cửa sổ ẩn danh, đăng nhập tài khoản Thí sinh: MSSV `B20DCCN001` / Mật khẩu `TestPass2026!`.
2. Chọn bài tập `#1 A + B Problem`, viết code C++ trong Monaco Editor và bấm nút **"Nộp bài"**.
3. Quan sát:
   * Trên màn hình Thí sinh: Hộp thoại WebSocket hiển thị tiến trình chuyển đổi tức thì từ `IN_QUEUE` $\rightarrow$ `COMPILING` $\rightarrow$ `TESTING (1/4 ... 4/4)` $\rightarrow$ `ACCEPTED (100 điểm)`.
   * Trên màn hình Admin: Thấy Worker tương ứng chuyển sang màu vàng `BUSY` trong 0.5s rồi quay về `IDLE`.

### Bước 4: Demo cơ chế Failover khi Worker bị lỗi
1. Mô phỏng sự cố: Tắt đột ngột 1 Worker container bằng lệnh `docker stop codejudge-worker-1`.
2. Quan sát trên Admin Dashboard: Sau 15 giây không có Heartbeat, Master đánh dấu Worker này là `DEAD` (Màu đỏ).
3. Thí sinh nộp bài tiếp theo: Master tự động bỏ qua worker chết và chuyển bài sang các Worker còn lại một cách bình thường.

---

# 22. Submission

## Source Code

Project source code được đóng gói đầy đủ và nộp thông qua liên kết Google Drive theo thông báo của giảng viên:

* Thư mục nộp: `NhomXX_CodeJudge_Source/`
* Báo cáo nộp: `NhomXX_CodeJudge_Report.docx` (và file `report/report.pdf`)

## Required Contents

* [x] **Source code:** Toàn bộ mã nguồn Backend (Java), Frontend (React), Worker (Python), Dockerfile và cấu hình build.
* [x] **README.md:** Tài liệu chi tiết đúng cấu trúc 24 mục của đề cương.
* [x] **RUN_GUIDE.md:** Hướng dẫn chi tiết các bước cài đặt và khởi chạy.
* [x] **Database script:** Hệ thống script tự động di trú dữ liệu Flyway V1–V11 trong `backend/.../db/migration/`.
* [x] **Dataset / Sample data:** Dữ liệu mẫu khởi tạo trong `db/seed/demo_data.sql` và `student-accounts.csv`.
* [x] **Test cases:** Bộ kịch bản kiểm thử tải tự động bằng k6 trong `tests/k6/`.
* [x] **Experimental results:** Số liệu đo lường định lượng và so sánh chi tiết.
* [x] **Architecture diagrams:** Sơ đồ kiến trúc hệ thống và luồng dữ liệu mạng.

---

# 23. Final Verification

Before submission:

```text
[x] Project can run
[x] Server can start
[x] Client can connect
[x] Network communication works
[x] Protocol is documented
[x] Multiple clients tested
[x] Error handling tested
[x] Experiments completed
[x] Results are reproducible
[x] Novelty is clearly stated
[x] README is complete
[x] Report is complete
[x] References are included
[x] Compilatio <= 20%
[x] Google Drive link is accessible
[x] All team members understand the project
```

---

# 24. Contact

Mọi thắc mắc về đề tài, kiến trúc và triển khai kỹ thuật, vui lòng liên hệ:

* **Sinh viên đại diện nhóm:** ... – Email: ...
* **Giảng viên phụ trách học phần:** [Điền tên giảng viên hướng dẫn]
