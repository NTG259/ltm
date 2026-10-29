# CodeJudge – Thiết kế hệ thống chấm bài C++ phân tán

Hệ thống chấm mã nguồn C++ tự động theo mô hình **Master – Multi-Worker**. Web client nộp bài
cho Master. Master xếp bài vào **hàng đợi Redis Streams** (3 mức ưu tiên) và giao cho các Judge
Worker qua giao thức TCP nhị phân tự thiết kế, rồi đẩy tiến trình chấm về trình duyệt theo thời
gian thực qua WebSocket.

Tài liệu chi tiết của từng thành phần:

- [`judgement/README.md`](judgement/README.md): Judge Worker, payload giao thức, quy đổi nhãn, sandbox.
- [`frontend/README.md`](frontend/README.md): Web client, hợp đồng REST API và bản tin WebSocket.
- [`backend/src/main/resources/db/migration`](backend/src/main/resources/db/migration): lược đồ cơ sở dữ liệu (Flyway V1–V12).
- [`ui/stitch_c/algorithmic_precision_ide/DESIGN.md`](ui/stitch_c/algorithmic_precision_ide/DESIGN.md): design token của giao diện.

---

## Khởi động nhanh (Docker Compose)

> Yêu cầu: **Docker Desktop** với WSL2 backend (Windows/macOS) hoặc Docker Engine (Linux).
> go-judge cần cgroup + namespace nên **phải chạy trên Linux kernel** (WSL2 đáp ứng yêu cầu này trên Windows).

### 1. Clone và khởi động

```powershell
git clone <repo-url>
cd ltm

# Khởi động toàn bộ stack (db + redis + backend + frontend + go-judge)
docker compose up -d --build
```

Nếu port bị conflict trên **Windows** (Hyper-V), dùng biến môi trường để đổi:

```powershell
$env:DB_PORT="25432"; $env:WEB_PORT="28080"; docker compose up -d --build
```

### 2. Kiểm tra trạng thái

```powershell
docker compose ps
# Chờ backend healthy (~30–40 giây sau khi Flyway chạy xong migration)
```

> **Lưu ý:** service `go-judge` hiện `unhealthy` trong `docker ps` vì healthcheck dùng `wget` không có sẵn trên Alpine — service thực tế hoạt động bình thường. Kiểm tra bằng:
> ```powershell
> docker exec codejudge-backend-1 curl -s http://go-judge:5050/version
> ```

### 3. Truy cập

| Dịch vụ | URL | Ghi chú |
|---------|-----|---------|
| Web (mặc định) | http://localhost:18080 | `WEB_PORT=28080` → http://localhost:28080 |
| Backend REST | http://localhost:18000/api | |
| Backend WebSocket | ws://localhost:18001 | |
| Redis | localhost:16379 | |
| PostgreSQL | localhost:15432 | `DB_PORT=25432` → 25432 |

### 4. Tài khoản demo

| Vai trò | Thông tin đăng nhập |
|---------|-------------------|
| Admin | Mật khẩu: `admin123` |
| Thí sinh | MSSV: `B20DCCN001` · Họ tên: `Nguyễn Văn A` |

### 5. Nạp dữ liệu demo (tùy chọn)

```powershell
# Nạp sẵn 10 đề bài, 3 kỳ thi, dữ liệu mẫu (xóa sạch dữ liệu cũ!)
docker compose --profile demo up seed
```

### 6. Cấu hình

Biến môi trường trong `compose.yaml` (không cần `.env` cho môi trường dev):

| Biến | Mặc định | Ý nghĩa |
|------|----------|---------|
| `DB_PORT` | `15432` | Port PostgreSQL trên host |
| `WEB_PORT` | `18080` | Port frontend trên host |
| `DB_NAME` | `codejudge` | Tên database |
| `DB_USERNAME` | `codejudge` | User PostgreSQL |
| `DB_PASSWORD` | `codejudge` | Mật khẩu PostgreSQL |
| `GO_JUDGE_TOKEN` | _(rỗng)_ | Token xác thực go-judge (bỏ trống = không cần) |
| `GO_JUDGE_PARALLELISM` | `4` | Số luồng chấm song song trong go-judge |
| `VITE_USE_MOCK` | `false` | Frontend kết nối backend thật; `true` chỉ dùng khi chủ động chạy chế độ giả lập cũ |

### 7. Tắt và xóa dữ liệu

```powershell
docker compose down          # tắt, giữ volume (dữ liệu DB + Redis)
docker compose down -v       # tắt và xóa sạch volume
```

---

## 1. Phạm vi

**Trong phạm vi**

- Chấm C++17 bằng `g++`, phân loại 7 nhãn: `AC`, `WA`, `TLE`, `MLE`, `RTE`, `CE`, `SEC`.
- Hàng đợi **Redis Streams** 3 mức ưu tiên, điều phối **min-latencyMs** tới nhiều Worker chạy song song.
- Phát hiện Worker chết qua Heartbeat hoặc đứt socket, rồi **Failover** at-least-once với `attempt_token`: thu hồi bài, re-enqueue, giao lại (tối đa 3 lần).
- Cập nhật tiến trình chấm từng test case theo thời gian thực qua WebSocket RFC 6455.
- Ba vai trò: **sinh viên** (làm bài, nộp bài, xem kết quả và xếp hạng lớp), **giảng viên** (xem xếp hạng lớp được phân công và thống kê bài tập), **quản trị viên** (đề bài, kỳ thi, giám sát Worker, lớp học, giảng viên và tra cứu bài nộp).
- Kỳ thi thể thức ICPC, có bảng xếp hạng trực tiếp.
- Lớp học / LMS: quản lý sinh viên, giao kỳ thi, theo dõi tiến độ.
- Phát hiện sao chép (Winnowing) và giám sát kỳ thi (proctoring).

**Ngoài phạm vi**

- Ngôn ngữ khác C++ (Java, Python, …).
- Chống gian lận trình duyệt / giám sát webcam.
- Cô lập bằng container, cgroup hay seccomp (xem [§14](#14-giới-hạn-của-thiết-kế)).

---

## 2. Kiến trúc

```text
┌──────────────────────────── CLIENT ─────────────────────────────┐
│  Web SPA (React 19 + Ant Design 6 + Monaco Editor)              │
│  Thí sinh: bài tập, IDE C++, kết quả realtime, kỳ thi, xếp hạng │
│  Admin:    giám sát Worker, ngân hàng đề, kỳ thi, lớp học       │
└───────────────┬──────────────────────────────┬──────────────────┘
                │ HTTP REST :18000             │ WebSocket :18001
                ▼                              ▼
┌──────────────────────────── MASTER (Spring Boot 4) ─────────────┐
│  REST API ─── xác thực Bearer token                             │
│  WebSocket server (tự hiện thực RFC 6455) ─── broadcast sự kiện │
│  Dispatcher: Redis Streams (3 ưu tiên) + min-latencyMs scheduler│
│  Heartbeat monitor (PING 5s / timeout 15s) + Failover           │
│  TCP Worker server :9000 ─── frame nhị phân >BBI                │
└──────┬──────────────────────┬──────────────┬────────────────────┘
       │ TCP :9000            │ JDBC         │ Redis
  ┌────┴────┐ ┌───────┐       ▼              ▼
  ▼         ▼ ▼       │  ┌──────────┐  ┌─────────────┐
┌──────┐ ┌──────┐     │  │PostgreSQL│  │Redis Streams│
│work-1│ │work-N│     │  │(Neon)    │  │ 3 queues    │
│ g++  │ │ g++  │     │  └──────────┘  └─────────────┘
└──────┘ └──────┘
```

| Thành phần | Công nghệ | Thư mục | Trách nhiệm |
| --- | --- | --- | --- |
| Web client | React 19, Vite, Ant Design 6, Monaco | `frontend/` | Giao diện thí sinh và admin, nhận sự kiện WebSocket |
| Master | Java 21, Spring Boot 4, Redis | `backend/` | REST API, WebSocket, hàng đợi Redis Streams, điều phối, Heartbeat, Failover, lưu trữ |
| Judge Worker | TCP client + `g++` (go-judge tham khảo) | `go-judge/` | Kết nối ngược về Master qua TCP :9000, biên dịch, chạy test, trả kết quả |
| Cơ sở dữ liệu | PostgreSQL (Neon cloud), Flyway V12 | `backend/.../db/migration` | Người dùng, đề, test, kỳ thi, bài nộp, sự kiện, Worker, lớp học, giảng viên, chống gian lận |
| Hàng đợi | Redis Streams (3 luồng ưu tiên) | — | `judge:contest` / `judge:practice` / `judge:custom` |

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
  │◀─ TASK_ASSIGN (0x03) ────────│  min-latencyMs chọn Worker             │
  │── TASK_STATUS COMPILING ────▶│── WS [COMPILING] ─────────────────────▶│
  │── TASK_STATUS TESTING 1/n ──▶│── WS [TESTING 1/n] ───────────────────▶│
  │── TASK_RESULT (0x05) ───────▶│── WS [FINISHED + verdict] ────────────▶│
```

1. **Nộp bài:** client gửi `POST /api/submissions` kèm Bearer token. Với kỳ thi, request có thêm `contestId`; với custom test, dùng luồng `judge:custom`.
2. **Xếp hàng:** Master lưu bài với trạng thái `IN_QUEUE`, thực hiện `XADD` vào Redis Stream tương ứng (`judge:contest` / `judge:practice` / `judge:custom`) và phát `SUBMISSION_UPDATE`.
3. **Giao bài:** scheduler chọn Worker có `latencyMs` thấp nhất, đọc bài tiếp theo qua `XREADGROUP`, tạo `attemptToken` mới (UUID) rồi gửi `TASK_ASSIGN` kèm mã nguồn, giới hạn TL/ML, bộ test và token.
4. **Tiến trình:** Worker gửi `TASK_STATUS` (`COMPILING`, rồi `TESTING x/y` trước và sau mỗi test). Master lưu sự kiện và chuyển tiếp qua WebSocket.
5. **Kết quả:** Worker gửi `TASK_RESULT` kèm `attemptToken`. Master kiểm tra token (bỏ qua kết quả cũ), gọi `XACK`, cập nhật bài nộp, phát `FINISHED` rồi lấy bài tiếp theo.

**Failover**

- Worker được coi là chết khi socket bị đóng (RST/FIN) hoặc quá **15 giây** không có PONG. Master đánh dấu Worker là `DEAD`.
- PEL entry cũ được `XACK`, bài đang chấm dở được re-enqueue vào Redis Stream với `attempt + 1`.
- Quá 3 lần giao mà vẫn không chấm xong thì bài chuyển sang trạng thái `FAILED`.
- Worker mất kết nối sẽ huỷ bài đang chấm, tự kết nối lại và gửi lại `REGISTER`.
- Khi Master khởi động lại, `claimStale()` (XCLAIM entries idle > 1050 s) kết hợp DB orphan scan re-enqueue toàn bộ bài `IN_QUEUE` / `COMPILING` / `TESTING`.

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
| `0x02` | WORKER_REGISTER | W → M | `workerId`, ngôn ngữ, trình biên dịch, kiểu sandbox; Master trả `{"accepted":true}` |
| `0x03` | TASK_ASSIGN | M → W | `submissionId`, `attemptToken`, `sourceCode`, `timeLimitMs`, `memoryLimitMb`, `language`, `checker`, `stopOnFirstFailure`, `tests[]` |
| `0x04` | TASK_STATUS | W → M | `COMPILING` / `TESTING` + `progress {current,total}` + kết quả từng test |
| `0x05` | TASK_RESULT | W → M | `verdict`, `score`, `timeMs`, `memoryKb`, `tests[]`, `compileLog?`, `securityMessage?`, `attemptToken` |

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

| Kênh | Cổng (Docker / local dev) | Mục đích |
| --- | --- | --- |
| HTTP/1.1 REST, JSON | `18000` / `8082` | Đăng nhập, đề bài, nộp bài, tra cứu, kỳ thi, quản trị; phục vụ file tĩnh của SPA |
| WebSocket RFC 6455, frame text JSON | `18001` / `8001` | Đẩy sự kiện realtime; client gửi `{"type":"AUTH","token"}` sau khi kết nối |

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

## 8. Lớp học và LMS (V7+)

Admin tạo `Classroom`, thêm sinh viên thủ công hoặc import hàng loạt qua file CSV (`ClassroomCsvImporter`). Mỗi lớp có thể gán nhiều kỳ thi (`ClassroomContest`). `MonitorController` (dưới `/api/classrooms`) cung cấp view tiến độ làm bài của từng sinh viên theo thời gian thực cho giáo viên.

### Bảng xếp hạng lớp (V12)

- Sinh viên chỉ xem lớp đang tham gia. Admin tạo tài khoản giảng viên và phân công ở tab **Giảng viên** trong chi tiết lớp; giảng viên chỉ xem lớp được phân công.
- Bảng sinh viên dùng bài luyện tập công khai đã chấm xong, không tính bài thi hoặc Chạy thử. Hạng theo số bài AC giảm dần, lượt nộp đến AC đầu tiên tăng dần, rồi thời điểm AC cuối cùng tăng dần. Sinh viên chưa nộp vẫn xuất hiện; bằng cả ba tiêu chí thì đồng hạng.
- Admin và giảng viên có tab **Xếp hạng bài tập**: nhiều lượt nộp, nhiều người AC và tỷ lệ AC thấp. Tỷ lệ AC tính theo số người đã thử; tiêu chí tỷ lệ thấp chỉ hiện bài có ít nhất 10 người thử. Có thể lọc lớp và mở rộng dòng để xem kết quả từng sinh viên.
- API: `GET /api/leaderboard/classrooms`, `/students`, `/problems`, `/problems/{id}/details`. Các bảng được lọc theo `classroomId` khi chọn lớp.

---

## 9. Phát hiện sao chép

`PlagiarismService` nhóm các bài nộp AC theo đề trong một kỳ thi, chạy thuật toán **Winnowing** (`WinnowingEngine` + `CppCodeTokenizer`) trên từng cặp. Kết quả lưu vào `plagiarism_reports` / `plagiarism_matches`. Kích hoạt qua `POST /contests/{id}/plagiarism/run` (chỉ admin).

---

## 10. Giám sát kỳ thi (Proctoring)

`ContestProctoring.jsx` kết hợp `useProctoring.js` theo dõi việc thí sinh chuyển tab hoặc mất focus trong quá trình thi. Vi phạm được gửi về `POST /contests/{id}/proctor/violation` và lưu vào `contest_violations`. Admin xem trực tiếp qua `AdminContestMonitorPage`.

---

## 11. Mô hình dữ liệu (PostgreSQL – Neon cloud, Flyway V12)

Không cần cài PostgreSQL cục bộ — chuỗi kết nối Neon đã có sẵn trong `backend/src/main/resources/application.yaml`.

| Bảng | Nội dung |
| --- | --- |
| `users` | Thí sinh (MSSV + họ tên) và admin (bcrypt) |
| `sessions` | Bearer token, chỉ lưu SHA-256 |
| `problems`, `test_cases` | Đề bài (xoá mềm) và bộ test; `is_sample` là ví dụ công khai |
| `contests`, `contest_problems`, `contest_participants` | Kỳ thi, bài trong kỳ thi (nhãn A, B, …), thí sinh đã đăng ký |
| `workers` | Trạng thái `IDLE` / `BUSY` / `DEAD`, Heartbeat gần nhất |
| `submissions` | Trạng thái `IN_QUEUE` → `COMPILING` → `TESTING` → `FINISHED` / `FAILED`, nhãn, điểm, `attempt`, `attempt_token` (UUID, V11) |
| `submission_test_results` | Kết quả từng test |
| `submission_events` | Dòng thời gian xử lý (giao bài, Failover, …) |
| `system_logs` | Nhật ký Master hiển thị cho admin |
| `classrooms`, `classroom_students`, `classroom_contests` | Lớp học, danh sách sinh viên (import CSV), kỳ thi được giao (V7+) |
| `plagiarism_reports`, `plagiarism_matches` | Báo cáo phát hiện sao chép (Winnowing fingerprinting) |
| `contest_violations` | Vi phạm giám sát kỳ thi (chuyển tab, mất focus) |

---

## 12. Giao diện Web

| Màn hình | Vai trò |
| --- | --- |
| Đăng nhập (MSSV + họ tên / mật khẩu admin) | Tất cả |
| Kho bài tập · Không gian làm bài (đề, Monaco editor, kết quả realtime) · Bài nộp · Chi tiết bài nộp | Thí sinh |
| Kỳ thi · Trang kỳ thi (đề, bảng xếp hạng ICPC, bài nộp, thể lệ) · Làm bài trong kỳ thi | Thí sinh |
| Giám sát kỳ thi (proctoring: phát hiện chuyển tab, mất focus) | Thí sinh (tự động), Admin (xem vi phạm) |
| Bảng xếp hạng chung | Tất cả |
| Giám sát Worker · Ngân hàng đề · Quản lý kỳ thi · Toàn bộ bài nộp | Admin |
| Quản lý lớp học · Import danh sách sinh viên CSV · Giao kỳ thi cho lớp · Tiến độ học viên realtime | Admin / Giáo viên |
| Phát hiện sao chép (Winnowing) · Báo cáo đạo văn theo từng kỳ thi | Admin |

Nguyên tắc trình bày:

- Mỗi thông tin chỉ hiển thị ở một chỗ. Trạng thái chấm gói gọn trong một khối kết quả, kèm câu giải thích bằng tiếng Việt.
- Thuật ngữ giao thức (`OP_TASK_*`, `IN_QUEUE`) chỉ hiện ở trang admin.
- Có giao diện sáng và tối, token màu theo `DESIGN.md`.

---

## 13. Cấu hình mặc định

| Tham số | Giá trị |
| --- | --- |
| Cổng HTTP REST / WebSocket / TCP Worker (Docker) | `18000` / `18001` / `9000` |
| Cổng HTTP REST / WebSocket (local dev) | `8082` / `8001` |
| Chu kỳ Heartbeat / timeout | 5 s / 15 s |
| Worker tự kết nối lại nếu không nhận gì từ Master | 20 s |
| Số lần giao bài tối đa (Failover) | 3 |
| XCLAIM stale threshold (recovery khi restart) | 1050 s |
| Payload tối đa mỗi frame | 10 MB |
| Phạt mỗi lần nộp sai trong kỳ thi | 20 phút |
| Trình biên dịch | `g++ -std=c++17 -O2 -static` |
| Hàng đợi ưu tiên | `judge:contest` > `judge:practice` > `judge:custom` |

---

## 14. Giới hạn của thiết kế

- Sandbox chỉ dựa trên `rlimit` và quét tĩnh. Chưa có namespace, cgroup hay seccomp, nên Worker phải chạy dưới một user riêng không có quyền.
- Muốn cô lập thật thì cần chạy Worker trong container, hoặc thay backend chấm bằng go-judge trực tiếp.
- Quét tĩnh cấm theo tên định danh. Biến hay hàm tự đặt trùng tên bị cấm (ví dụ `kill`) cũng bị báo `SEC`.
- Trên Windows, Worker chỉ giới hạn được thời gian thực, không đo được bộ nhớ. Chỉ dùng để demo.
- Mỗi Worker chấm một bài tại một thời điểm (`parallelism = 1`). Muốn tăng thông lượng thì thêm Worker.
- Hàng đợi Redis Streams đảm bảo at-least-once: `attempt_token` loại bỏ kết quả trùng lặp sau Failover.
- Plagiarism detection chỉ phát hiện sao chép mã nguồn dựa trên token, không bắt được kỹ thuật obfuscation phức tạp.

---

## 15. Cấu trúc repo

```text
.
├── backend/      # Master – Spring Boot 4 (Java 21); db/migration: Flyway V1–V12
├── judgement/    # Mã nguồn tham khảo go-judge; samples/ (7 nhãn), tests/
├── frontend/     # Web SPA – React 19 + Vite + Ant Design 6 + Monaco Editor
├── go-judge/     # Mã nguồn go-judge (nguồn mở), tham khảo thiết kế sandbox
├── tests/        # k6 load test scenarios (scenario_a, b, c, worker_utilization)
└── ui/           # Mockup giao diện và DESIGN.md (design token)
```

---

## Tham chiếu

- RFC 6455 – *The WebSocket Protocol*, IETF, 2011.
- W. R. Stevens et al., *UNIX Network Programming, Vol. 1: The Sockets Networking API*, 3rd ed.
- go-judge – https://github.com/criyle/go-judge
