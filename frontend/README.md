# CodeJudge – Web SPA Client

Giao diện Web cho hệ thống chấm bài C++ phân tán (xem `../README.md`).
Stack: **React 19 + Vite + Ant Design 6 + React Router (HashRouter)**. Design token lấy từ
`../ui/stitch_c/algorithmic_precision_ide/DESIGN.md`, có hai chế độ sáng và tối.

## Chạy

```bash
npm install
npm run dev        # http://localhost:5173 – mặc định dùng Master giả lập (mock)
npm run build      # xuất ra dist/ để Master phục vụ ở cổng 8000
```

| Biến môi trường | Mặc định | Ý nghĩa |
| --- | --- | --- |
| `VITE_USE_MOCK` | `true` | `false` để gọi Master thật |
| `VITE_API_BASE` | `/api` | Base URL REST (khi dev, Vite proxy `/api` → `127.0.0.1:8000`) |
| `VITE_WS_URL` | `ws://<host>:8001` | Endpoint WebSocket RFC 6455 |

Chế độ **mock** (`src/api/mock/engine.js`) giả lập Master với 3 Worker ngay trong trình duyệt:
hàng đợi FIFO, Least-Busy, Heartbeat 5s, Failover (tối đa 3 lần), 7 nhãn kết quả.
Mật khẩu admin là `admin123`. Trong trang làm bài, menu **Mã mẫu** nạp sẵn `samples/{ac,wa,tle,mle,ce,rte,sec}.cpp`.

## Màn hình

| Route | Vai trò | Nội dung |
| --- | --- | --- |
| `#/login` | Tất cả | Đăng nhập thí sinh (MSSV + họ tên) hoặc admin (mật khẩu) |
| `#/problems` | Thí sinh | Kho bài tập, lọc theo độ khó/chủ đề, trạng thái đã giải |
| `#/problems/:id` | Thí sinh | Đề bài, editor C++ (Tab, Ctrl+Enter), tải tệp `.cpp`, tiến trình chấm realtime, test case + diff |
| `#/submissions` | Thí sinh | Lịch sử bài nộp (cập nhật realtime) |
| `#/submissions/:id` | Thí sinh/Admin | Chi tiết: kết quả, từng test, log CE, cảnh báo SEC, mã nguồn, dòng thời gian (cả Failover) |
| `#/leaderboard` | Tất cả | Bảng xếp hạng, tự làm mới khi có bài chấm xong |
| `#/contests` | Thí sinh | Danh sách kỳ thi (đang / sắp / đã diễn ra), đăng ký |
| `#/contests/:id` | Tất cả | Trang kỳ thi: đồng hồ, đề bài A/B/C…, bảng xếp hạng ICPC, bài nộp, thể lệ |
| `#/contests/:id/problems/:label` | Thí sinh | Làm bài trong kỳ thi (nộp kèm `contestId`) |
| `#/admin` | Admin | Giám sát Worker (Heartbeat, bận/rảnh, độ trễ), hàng đợi FIFO, nhật ký Master, giả lập sự cố |
| `#/admin/problems` | Admin | CRUD đề bài + ví dụ + bộ test chấm |
| `#/admin/submissions` | Admin | Tra cứu, lọc toàn bộ bài nộp |
| `#/admin/contests` | Admin | Tạo / sửa / xoá kỳ thi, chọn bộ đề và lịch thi |

## Hợp đồng API mà Master cần cài đặt (`src/api/index.js`)

Mọi request (trừ login) gửi header `Authorization: Bearer <token>`. Lỗi trả về `{ "message": "..." }`.

| Method | Path | Body / Query | Trả về |
| --- | --- | --- | --- |
| POST | `/api/auth/login` | `{role:"student", studentId, fullName}` hoặc `{role:"admin", password}` | `{token, user:{id,name,role}}` |
| GET | `/api/problems` | – | `Problem[]` (không kèm `tests`, có `testCount`, `totalSubmissions`, `acceptedSubmissions`) |
| GET | `/api/problems/:id` | – | `Problem` (admin nhận thêm `tests`) |
| POST | `/api/submissions` | `{problemId, language:"cpp17", sourceCode, contestId?}` | `Submission` (status `IN_QUEUE`) |
| GET | `/api/submissions` | `?userId=&problemId=&verdict=&contestId=` | `Submission[]` (không kèm `sourceCode/tests/history`) |
| GET | `/api/submissions/:id` | – | `Submission` đầy đủ |
| GET | `/api/leaderboard` | – | `{problems:[{id,title}], rows:[{rank,userId,userName,solved,score,attempts,cells:{[problemId]:{best,tries,solved}}}]}` |
| GET | `/api/contests` | – | `Contest[]` |
| GET | `/api/contests/:id` | – | `Contest` (`problems` rỗng với thí sinh khi chưa bắt đầu) |
| POST | `/api/contests/:id/register` | – | `Contest` |
| GET | `/api/contests/:id/standings` | – | `{labels, penaltyPerWrong, rows:[{rank,userId,userName,solved,penalty,cells:{[label]:{solved,wrong,pending,minute,first?}}}]}` |
| POST/PUT/DELETE | `/api/admin/contests[/:id]` | `{title, description, startAt, durationMin, problemIds[]}` | `Contest` |
| GET | `/api/admin/overview` | – | `{workers: Worker[], queue: number[], logs: Log[], submissions: number}` |
| POST/PUT/DELETE | `/api/admin/problems[/:id]` | `Problem` | `Problem` |
| POST | `/api/admin/workers/:id/disconnect` | – | `204` |

```ts
Problem    { id, title, difficulty:'easy'|'medium'|'hard', tags[], timeLimitMs, memoryLimitMb,
             statement, inputSpec, outputSpec, samples:[{input,output}], tests?:[{input,output}] }
Submission { id, contestId, problemId, problemTitle, userId, userName, language, sourceCode,
             status:'IN_QUEUE'|'COMPILING'|'TESTING'|'FINISHED',
             verdict:'AC'|'WA'|'TLE'|'MLE'|'RTE'|'CE'|'SEC'|null, score, timeMs, memoryKb,
             workerId, attempts, createdAt, progress:{current,total},
             tests:[{index,status,input,expected,output?,timeMs?,memoryKb?,stderr?}],
             compileLog?, securityMessage?, history:[{time,status,workerId?,note}] }
Contest    { id, title, description, startAt, endAt, durationMin, status:'UPCOMING'|'RUNNING'|'ENDED',
             participantCount, registered, problemIds? (admin),
             problems:[{label, problemId, title, timeLimitMs, memoryLimitMb, solvedCount, attemptCount}] }
Worker     { id, address, status:'IDLE'|'BUSY'|'DEAD', currentTask, completed, connectedAt, lastHeartbeat, latencyMs }
```

## Bản tin WebSocket (cổng 8001, frame text JSON)

Client gửi `{"type":"AUTH","token":"..."}` ngay khi kết nối. Master phát (broadcast):

```jsonc
{ "type": "SUBMISSION_UPDATE", "submission": { /* Submission, có thể chỉ gồm các trường thay đổi + id */ } }
{ "type": "WORKER_UPDATE", "workers": [ /* Worker[] */ ], "queue": [1045, 1046] }
{ "type": "CONTEST_UPDATE", "contestId": 2 }
{ "type": "LOG", "entry": { "id": "...", "time": 1730000000000, "level": "info|success|warning|error", "message": "..." } }
```

`SUBMISSION_UPDATE` nên được gửi ở mỗi bước `IN_QUEUE` → `COMPILING` → `TESTING x/y` → `FINISHED`,
tương ứng với các bản tin `OP_TASK_STATUS` và `OP_TASK_RESULT` từ Worker.
