# CodeJudge – Thiết kế hệ thống chấm bài C++ phân tán

Hệ thống chấm mã nguồn C++ tự động theo mô hình **Master – Multi-Worker**. Web client nộp bài
cho Master. Master xếp bài vào hàng đợi và giao cho các Judge Worker qua một giao thức TCP nhị
phân tự thiết kế, rồi đẩy tiến trình chấm về trình duyệt theo thời gian thực qua WebSocket.

Tài liệu chi tiết của từng thành phần:

- [`judgement/README.md`](judgement/README.md): Judge Worker, payload giao thức, quy đổi nhãn, sandbox.
- [`frontend/README.md`](frontend/README.md): Web client, hợp đồng REST API và bản tin WebSocket.
- [`backend/src/main/resources/db/migration`](backend/src/main/resources/db/migration): lược đồ cơ sở dữ liệu.
- [`ui/stitch_c/algorithmic_precision_ide/DESIGN.md`](ui/stitch_c/algorithmic_precision_ide/DESIGN.md): design token của giao diện.

---

## 1. Phạm vi

**Trong phạm vi**

- Chấm C++17 bằng `g++`, phân loại 7 nhãn: `AC`, `WA`, `TLE`, `MLE`, `RTE`, `CE`, `SEC`.
- Hàng đợi FIFO, điều phối **Least-Busy** tới nhiều Worker chạy song song.
- Phát hiện Worker chết qua Heartbeat hoặc đứt socket, rồi **Failover**: thu hồi bài, đưa về đầu hàng đợi, giao lại (tối đa 3 lần).
- Cập nhật tiến trình chấm từng test case theo thời gian thực qua WebSocket RFC 6455.
- Hai vai trò: **thí sinh** (làm bài, nộp bài, xem kết quả, thi) và **quản trị viên** (đề bài, kỳ thi, giám sát Worker, tra cứu bài nộp).
- Kỳ thi thể thức ICPC, có bảng xếp hạng trực tiếp.

**Ngoài phạm vi**

- Ngôn ngữ khác C++ (Java, Python, …).
- Chống gian lận trình duyệt / giám sát webcam.
- Cô lập bằng container, cgroup hay seccomp (xem [§11](#11-giới-hạn-của-thiết-kế)).

---

## 2. Kiến trúc

```text
┌──────────────────────────── CLIENT ─────────────────────────────┐
│  Web SPA (React + Ant Design)                                   │
│  Thí sinh: bài tập, IDE C++, kết quả realtime, kỳ thi, xếp hạng │
│  Admin:    giám sát Worker, ngân hàng đề, kỳ thi, bài nộp       │
└───────────────┬──────────────────────────────┬──────────────────┘
                │ HTTP REST :8000              │ WebSocket :8001
                ▼                              ▼
┌──────────────────────────── MASTER (Spring Boot) ───────────────┐
│  REST API ─── xác thực Bearer token                             │
│  WebSocket server (tự hiện thực RFC 6455) ─── broadcast sự kiện │
│  Dispatcher: hàng đợi FIFO + Least-Busy scheduler               │
│  Heartbeat monitor (PING 5s / timeout 15s) + Failover           │
│  TCP Worker server :9000 ─── frame nhị phân >BBI                │
└───────────────┬──────────────────────────────┬──────────────────┘
                │ TCP :9000                    │ JDBC
      ┌─────────┴─────────┐                    ▼
      ▼                   ▼              ┌────────────┐
┌─────────────┐     ┌─────────────┐      │ PostgreSQL │
│ worker-1    │ ... │ worker-N    │      └────────────┘
│ (judgement) │     │ (judgement) │
│ scan → g++ → sandbox → checker  │
└─────────────┘     └─────────────┘
```

| Thành phần | Công nghệ | Thư mục | Trách nhiệm |
| --- | --- | --- | --- |
| Web client | React 19, Vite, Ant Design 6 | `frontend/` | Giao diện thí sinh và admin, nhận sự kiện WebSocket |
| Master | Java 21, Spring Boot | `backend/` | REST API, WebSocket, hàng đợi, điều phối, Heartbeat, Failover, lưu trữ |
| Judge Worker | Python ≥ 3.10 (thư viện chuẩn) + `g++` | `judgement/` | Kết nối ngược về Master, quét tĩnh, biên dịch, chạy test trong sandbox, trả kết quả |
| Cơ sở dữ liệu | PostgreSQL ≥ 14 | `backend/.../db/migration` | Người dùng, đề, test, kỳ thi, bài nộp, sự kiện, Worker |
| Tham khảo sandbox | go-judge | `go-judge/` | Mã nguồn tham khảo cho thiết kế `sandbox.py` / `launcher.c` |

---

## 3. Luồng xử lý một bài nộp

```text
Worker                          Master                                Browser
  │── TCP CONNECT :9000 ────────▶│                                        │
  │── REGISTER (0x02) ──────────▶│                                        │
  │◀─ HEARTBEAT PING (0x01) ─────│  mỗi 5 giây                            │
  │── HEARTBEAT PONG (0x01) ────▶│                                        │
  │                              │◀── POST /api/submissions ──────────────│
  │                              │── WS SUBMISSION_UPDATE [IN_QUEUE] ────▶│
  │◀─ TASK_ASSIGN (0x03) ────────│  Least-Busy chọn Worker rảnh           │
  │── TASK_STATUS COMPILING ────▶│── WS [COMPILING] ─────────────────────▶│
  │── TASK_STATUS TESTING 1/n ──▶│── WS [TESTING 1/n] ───────────────────▶│
  │── TASK_RESULT (0x05) ───────▶│── WS [FINISHED + verdict] ────────────▶│
```

1. **Nộp bài:** client gửi `POST /api/submissions` kèm Bearer token. Với kỳ thi, request có thêm `contestId`.
2. **Xếp hàng:** Master lưu bài với trạng thái `IN_QUEUE`, đưa vào cuối hàng đợi FIFO trong RAM và phát `SUBMISSION_UPDATE`.
3. **Giao bài:** scheduler chọn Worker `IDLE` đã chấm ít bài nhất (Least-Busy) và gửi `TASK_ASSIGN` kèm mã nguồn, giới hạn TL/ML, bộ test và số lần giao `attempt`.
4. **Tiến trình:** Worker gửi `TASK_STATUS` (`COMPILING`, rồi `TESTING x/y` trước và sau mỗi test). Master lưu sự kiện và chuyển tiếp qua WebSocket.
5. **Kết quả:** Worker gửi `TASK_RESULT`. Master cập nhật bài nộp, đặt Worker về `IDLE`, phát `FINISHED` rồi lấy bài tiếp theo trong hàng đợi.

**Failover**

- Worker được coi là chết khi socket bị đóng (RST/FIN) hoặc quá **15 giây** không có PONG. Master đánh dấu Worker là `DEAD`.
- Bài đang chấm dở được đưa về **đầu** hàng đợi với `attempt + 1`, rồi giao ngay cho Worker rảnh khác.
- Quá 3 lần giao mà vẫn không chấm xong thì bài chuyển sang trạng thái `FAILED`.
- Worker mất kết nối sẽ huỷ bài đang chấm, không gửi kết quả, tự kết nối lại và gửi lại `REGISTER`.
- Hàng đợi chỉ nằm trong RAM. Khi Master khởi động lại, nó dựng lại hàng đợi từ các bài có trạng thái `IN_QUEUE`, `COMPILING` hoặc `TESTING` trong DB.

---

## 4. Giao thức Master ↔ Worker (TCP :9000)

Mỗi frame gồm **header cố định 6 byte** (big-endian, `struct` format `>BBI`) và payload JSON UTF-8.

```text
 0               1               2                               6
├───────────────┼───────────────┼───────────────────────────────┤
│ Magic (0xAA)  │ Opcode        │ Payload length (uint32)       │
├───────────────┴───────────────┴───────────────────────────────┤
│ Payload: JSON UTF-8, tối đa 10 MB                              │
└───────────────────────────────────────────────────────────────┘
```

| Opcode | Tên | Chiều | Nội dung chính |
| --- | --- | --- | --- |
| `0x01` | HEARTBEAT | M ↔ W | `PING {ts}` / `PONG {ts, busy, currentTask, completed}` |
| `0x02` | WORKER_REGISTER | W → M | `workerId`, ngôn ngữ, trình biên dịch, kiểu sandbox |
| `0x03` | TASK_ASSIGN | M → W | `submissionId`, `attempt`, `sourceCode`, `timeLimitMs`, `memoryLimitMb`, `tests[]`, `checker` |
| `0x04` | TASK_STATUS | W → M | `COMPILING` / `TESTING` + `progress {current,total}` + kết quả từng test |
| `0x05` | TASK_RESULT | W → M | `verdict`, `score`, `timeMs`, `memoryKb`, `tests[]`, `compileLog?`, `securityMessage?` |

Payload đầy đủ của từng opcode nằm ở [`judgement/README.md`](judgement/README.md#giao-thức-với-master).

**Xử lý lỗi ở tầng giao thức**

- **Dính gói / phân mảnh:** bên nhận đọc lặp cho tới khi đủ 6 byte header, rồi đọc tiếp cho tới khi đủ `length` byte payload (`recv_exact` / `DataInputStream.readFully`).
- **Sai magic byte, opcode lạ hoặc JSON hỏng:** đóng kết nối ngay, không làm sập tiến trình.
- **Payload vượt 10 MB:** từ chối và đóng kết nối, để chống làm cạn bộ nhớ.
- **Worker bận** nhưng vẫn nhận được bài: trả `status: "REJECTED"`, Master đưa bài về hàng đợi.
- **Lỗi phía máy chấm** (thiếu `g++`, payload sai): trả `status: "ERROR"`, Master giao bài cho Worker khác.
- PING luôn được trả lời kể cả khi đang chấm, vì luồng đọc socket tách khỏi luồng chấm.

---

## 5. Giao tiếp Web ↔ Master

| Kênh | Cổng | Mục đích |
| --- | --- | --- |
| HTTP/1.1 REST, JSON | 8000 | Đăng nhập, đề bài, nộp bài, tra cứu, kỳ thi, quản trị; phục vụ file tĩnh của SPA |
| WebSocket RFC 6455, frame text JSON | 8001 | Đẩy sự kiện realtime; client gửi `{"type":"AUTH","token"}` sau khi kết nối |

Các sự kiện WebSocket:

| `type` | Khi nào | Người nhận |
| --- | --- | --- |
| `SUBMISSION_UPDATE` | Mỗi lần trạng thái bài nộp thay đổi | Chủ bài nộp và admin |
| `WORKER_UPDATE` | Worker đăng ký, đổi trạng thái, Heartbeat, hàng đợi thay đổi | Admin |
| `LOG` | Nhật ký điều phối của Master | Admin |
| `CONTEST_UPDATE` | Kỳ thi được tạo/sửa/xoá, có người đăng ký | Tất cả |

Danh sách endpoint REST và kiểu dữ liệu (`Problem`, `Submission`, `Worker`, …) nằm ở
[`frontend/README.md`](frontend/README.md).

---

## 6. Chấm bài và sandbox

Quy trình trên mỗi Worker: **quét tĩnh → biên dịch → chạy từng test → so output → tổng hợp nhãn**.

| Nhãn | Ý nghĩa | Phát hiện |
| --- | --- | --- |
| `SEC` | Dùng thư viện hoặc lời gọi bị cấm | Quét tĩnh theo định danh (`windows.h`, `system`, `fork`, `exec*`, …), chặn **trước** khi biên dịch |
| `CE` | Lỗi biên dịch | `g++ -std=c++17 -O2 -static` trả mã lỗi hoặc chạy quá 20 giây |
| `TLE` | Quá thời gian | CPU > TL, hoặc thời gian thực > 3·TL + 1 s |
| `MLE` | Quá bộ nhớ | RSS đỉnh > ML, `bad_alloc` khi vượt `RLIMIT_AS`, hoặc mảng tĩnh lớn hơn ML |
| `RTE` | Lỗi khi chạy | Bị tín hiệu (SIGSEGV, SIGFPE, …) hoặc mã thoát ≠ 0 |
| `WA` | Sai kết quả | Checker `lines` (mặc định), `tokens` hoặc `exact` |
| `AC` | Đúng | Qua toàn bộ test |

- Điểm của bài = `round(100 · số test qua / tổng số test)`.
- Mặc định dừng ở test sai đầu tiên, các test sau đánh dấu `SKIPPED`.
- Mỗi test chạy qua `launcher.c`: `fork` → `setrlimit` (CPU, AS, FSIZE, NOFILE = 3) → `execvp`, rồi đo CPU/RSS bằng `wait4`.

---

## 7. Kỳ thi (ICPC)

- Admin tạo kỳ thi từ ngân hàng đề: tiêu đề, thời gian bắt đầu, thời lượng, danh sách bài. Thứ tự chọn bài quyết định nhãn A, B, C, …
- Thí sinh phải **đăng ký** mới được xem đề và nộp bài. Đăng ký được trước hoặc trong khi thi.
- Đề bài bị ẩn với thí sinh cho tới giờ bắt đầu. Sau khi kết thúc, đề mở để luyện tập và bài nộp lúc đó không được tính.
- **Xếp hạng:** số bài AC giảm dần, sau đó tổng phạt tăng dần.
- **Phạt một bài** = số phút từ lúc bắt đầu tới khi AC + 20 phút × số lần nộp sai trước đó.
- `CE` và `SEC` không bị tính phạt. Bài chưa AC không cộng phạt. Người AC đầu tiên mỗi bài được đánh dấu.
- Bảng xếp hạng cập nhật realtime mỗi khi có bài trong kỳ thi chấm xong.

---

## 8. Mô hình dữ liệu (PostgreSQL)

| Bảng | Nội dung |
| --- | --- |
| `users` | Thí sinh (MSSV + họ tên) và admin (bcrypt) |
| `sessions` | Bearer token, chỉ lưu SHA-256 |
| `problems`, `test_cases` | Đề bài (xoá mềm) và bộ test; `is_sample` là ví dụ công khai |
| `contests`, `contest_problems`, `contest_participants` | Kỳ thi, bài trong kỳ thi (nhãn A, B, …), thí sinh đã đăng ký |
| `workers` | Trạng thái `IDLE` / `BUSY` / `DEAD`, Heartbeat gần nhất |
| `submissions` | Trạng thái `IN_QUEUE` → `COMPILING` → `TESTING` → `FINISHED` / `FAILED`, nhãn, điểm, `attempt` |
| `submission_test_results` | Kết quả từng test |
| `submission_events` | Dòng thời gian xử lý (giao bài, Failover, …) |
| `system_logs` | Nhật ký Master hiển thị cho admin |

---

## 9. Giao diện Web

| Màn hình | Vai trò |
| --- | --- |
| Đăng nhập (MSSV + họ tên / mật khẩu admin) | Tất cả |
| Kho bài tập · Không gian làm bài (đề, editor, kết quả realtime) · Bài nộp · Chi tiết bài nộp | Thí sinh |
| Kỳ thi · Trang kỳ thi (đề, bảng xếp hạng ICPC, bài nộp, thể lệ) · Làm bài trong kỳ thi | Thí sinh |
| Bảng xếp hạng chung | Tất cả |
| Giám sát Worker · Ngân hàng đề · Quản lý kỳ thi · Toàn bộ bài nộp | Admin |

Nguyên tắc trình bày:

- Mỗi thông tin chỉ hiển thị ở một chỗ. Trạng thái chấm gói gọn trong một khối kết quả, kèm câu giải thích bằng tiếng Việt.
- Thuật ngữ giao thức (`OP_TASK_*`, `IN_QUEUE`) chỉ hiện ở trang admin.
- Có giao diện sáng và tối, token màu theo `DESIGN.md`.

---

## 10. Cấu hình mặc định

| Tham số | Giá trị |
| --- | --- |
| Cổng HTTP REST / WebSocket / TCP Worker | `8000` / `8001` / `9000` |
| Chu kỳ Heartbeat / timeout | 5 s / 15 s |
| Worker tự kết nối lại nếu không nhận gì từ Master | 20 s |
| Số lần giao bài tối đa (Failover) | 3 |
| Payload tối đa mỗi frame | 10 MB |
| Phạt mỗi lần nộp sai trong kỳ thi | 20 phút |
| Trình biên dịch | `g++ -std=c++17 -O2 -static` |

---

## 11. Giới hạn của thiết kế

- Sandbox chỉ dựa trên `rlimit` và quét tĩnh. Chưa có namespace, cgroup hay seccomp, nên Worker phải chạy dưới một user riêng không có quyền.
- Muốn cô lập thật thì cần chạy Worker trong container, hoặc thay backend chấm bằng go-judge.
- Quét tĩnh cấm theo tên định danh. Biến hay hàm tự đặt trùng tên bị cấm (ví dụ `kill`) cũng bị báo `SEC`.
- Trên Windows, Worker chỉ giới hạn được thời gian thực, không đo được bộ nhớ. Chỉ dùng để demo.
- Mỗi Worker chấm một bài tại một thời điểm (`parallelism = 1`). Muốn tăng thông lượng thì thêm Worker.

---

## 12. Cấu trúc repo

```text
.
├── backend/      # Master – Spring Boot (Java 21); db/migration: lược đồ PostgreSQL
├── judgement/    # Judge Worker – Python; samples/ (7 file mẫu cho 7 nhãn), tests/
├── frontend/     # Web SPA – React + Vite + Ant Design
├── go-judge/     # Mã nguồn go-judge, tham khảo thiết kế sandbox
└── ui/           # Mockup giao diện và DESIGN.md (design token)
```

---

## Tham chiếu

- RFC 6455 – *The WebSocket Protocol*, IETF, 2011.
- W. R. Stevens et al., *UNIX Network Programming, Vol. 1: The Sockets Networking API*, 3rd ed.
- go-judge – https://github.com/criyle/go-judge
