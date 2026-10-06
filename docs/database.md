# Thiết kế cơ sở dữ liệu – CodeJudge (PostgreSQL)

| File | Nội dung |
| --- | --- |
| `backend/src/main/resources/db/migration/V1__init_schema.sql` | Bảng, ràng buộc, trigger, view (đặt đúng thư mục Flyway mặc định) |
| `backend/src/main/resources/db/seed/demo_data.sql` | Dữ liệu demo sinh từ `frontend/src/api/mock/data.js`: admin, 8 thí sinh, 10 đề + 35 test, 3 kỳ thi |
| `compose.yaml` | PostgreSQL 18 cho phát triển |

```bash
docker compose up -d db          # PostgreSQL ở cổng 5433 của máy
export DATABASE_URL=postgresql://codejudge:codejudge@127.0.0.1:5433/codejudge
psql "$DATABASE_URL" -f backend/src/main/resources/db/migration/V1__init_schema.sql
psql "$DATABASE_URL" -f backend/src/main/resources/db/seed/demo_data.sql   # chạy lại được, xóa sạch rồi nạp lại
```

Tài khoản demo: `admin` / `admin123` (bcrypt), thí sinh `B20DCCN001` … `B20DCCN075`.

## Sơ đồ quan hệ

```mermaid
erDiagram
    users ||--o{ sessions : "đăng nhập"
    users ||--o{ submissions : "nộp"
    users ||--o{ contest_participants : "đăng ký"
    problems ||--o{ test_cases : "bộ test"
    problems ||--o{ contest_problems : "thuộc"
    problems ||--o{ submissions : ""
    contests ||--o{ contest_problems : "gồm bài A, B, C…"
    contests ||--o{ contest_participants : ""
    contest_problems ||--o{ submissions : "(contest_id, problem_id)"
    submissions ||--o{ submission_test_results : "kết quả từng test"
    submissions ||--o{ submission_events : "dòng thời gian"
    test_cases |o--o{ submission_test_results : ""
    workers |o--o{ submissions : "chấm"
    workers |o--o{ submission_events : ""
    workers |o--o{ system_logs : ""

    users { bigint id PK
            varchar username UK "MSSV hoặc admin"
            varchar role "STUDENT | ADMIN"
            varchar password_hash "chỉ admin" }
    problems { bigint id PK
               text_array tags
               int time_limit_ms
               int memory_limit_mb
               varchar checker "lines|tokens|exact"
               timestamptz deleted_at "xóa mềm" }
    test_cases { bigint id PK
                 bigint problem_id FK
                 smallint position
                 bool is_sample }
    contests { bigint id PK
               timestamptz start_at
               timestamptz end_at
               smallint penalty_minutes }
    submissions { bigint id PK "bắt đầu 1001"
                  bigint contest_id FK "NULL = luyện tập"
                  varchar status
                  varchar verdict "7 nhãn"
                  smallint attempts "≤ 3 (Failover)"
                  varchar worker_id FK }
    workers { varchar id PK "worker-1"
              varchar status "IDLE|BUSY|DEAD"
              jsonb register_payload }
```

## Các bảng

| Bảng | Vai trò | Ghi chú thiết kế |
| --- | --- | --- |
| `users` | Thí sinh và admin | `username` là MSSV (CHECK đúng định dạng `B20DCCN001`), unique không phân biệt hoa thường. Chỉ admin có `password_hash`. |
| `sessions` | Bearer token | Chỉ lưu SHA-256 của token, kèm hạn dùng và thời điểm thu hồi. |
| `problems` | Đề bài | `tags TEXT[]` + chỉ mục GIN để lọc theo chủ đề. **Xóa mềm** (`deleted_at`) vì bài nộp cũ còn tham chiếu, frontend hiển thị "(đã xoá)". |
| `test_cases` | Ví dụ + test chấm | `is_sample` = hiển thị trong đề, và vẫn được chấm. `position` là `index` trong kết quả chấm, có thể đổi thứ tự trong một transaction (`DEFERRABLE`). |
| `contests` | Kỳ thi ICPC | Lưu `start_at`/`end_at`; trạng thái UPCOMING/RUNNING/ENDED tính theo `now()`. |
| `contest_problems` | Bài trong kỳ thi | Nhãn `A, B, C…` unique trong một kỳ thi. |
| `contest_participants` | Đăng ký dự thi | |
| `workers` | Danh bạ máy chấm | Chỉ ghi khi Worker REGISTER, mất kết nối hoặc chấm xong một bài. Heartbeat 5s nằm trong RAM của Master. |
| `submissions` | Bài nộp | Xem phần dưới. |
| `submission_test_results` | Kết quả từng test | Khớp mảng `tests` trong `OP_TASK_RESULT` (`judgement/README.md`). Output đã được Worker cắt còn ≤ 4 KB. |
| `submission_events` | Dòng thời gian bài nộp | `IN_QUEUE → ASSIGNED → COMPILING → … → FINISHED`, gồm cả `REQUEUED` khi Failover và `REJECTED` khi Worker bận. |
| `system_logs` | Nhật ký trên trang Admin | Nên định kỳ xóa log cũ. |

### `submissions`

- **Vòng đời:** `IN_QUEUE → COMPILING → TESTING → FINISHED`. Bổ sung `FAILED` khi Failover quá 3 lần
  (`attempts`) hoặc Worker báo `ERROR`. Hai CHECK đảm bảo `FINISHED ⇔ có verdict` và
  `FINISHED/FAILED ⇔ có finished_at`.
- **Chụp lại giới hạn đề** (`time_limit_ms`, `memory_limit_mb`) lúc nộp, để admin sửa đề sau đó
  không làm sai lệch kết quả cũ hay lần chấm lại.
- **Khóa ngoại kép** `(contest_id, problem_id) → contest_problems`: bài nộp trong kỳ thi chắc chắn
  thuộc kỳ thi đó. Khi `contest_id` là NULL (luyện tập), PostgreSQL bỏ qua ràng buộc này.
- **Trigger `trg_submissions_contest`:** chỉ nhận bài nộp trong kỳ thi khi thí sinh đã đăng ký
  và nộp trong `[start_at, end_at)`.
- **Khôi phục hàng đợi:** hàng đợi FIFO nằm trong RAM. Khi Master khởi động lại, chạy
  `SELECT id FROM submissions WHERE status IN ('IN_QUEUE','COMPILING','TESTING') ORDER BY id`
  (dùng partial index `ix_submissions_pending`) để nạp lại hàng đợi.

## View cho API

| View | API |
| --- | --- |
| `v_problem_stats` | `GET /api/problems`: `testCount`, `totalSubmissions`, `acceptedSubmissions` |
| `v_user_problem_best` | Ô `cells[problemId] = {best, tries, solved}` của bảng xếp hạng chung |
| `v_leaderboard` | `GET /api/leaderboard`: tổng điểm cao nhất mỗi bài, số bài AC, `rank` |
| `v_contest_cells` | Ô ICPC: `solved`, `wrong` (trước AC, không tính CE/SEC), `pending`, `solve_minute`, `first_solve` |
| `v_contest_standings` | `GET /api/contests/:id/standings`: xếp theo số bài AC ↓, tổng phút phạt ↑ (`phút AC + wrong × penalty_minutes`). Thí sinh đã đăng ký nhưng chưa nộp vẫn có dòng. |

## Các quyết định

- **VARCHAR + CHECK thay vì ENUM của PostgreSQL:** map được với enum Java mà không cần kiểu
  riêng của Hibernate, và thêm trạng thái mới chỉ cần sửa CHECK chứ không phải `ALTER TYPE`.
- **`TIMESTAMPTZ` cho mọi mốc thời gian.** API đổi sang epoch ms vì frontend dùng `Date.now()`.
- **Bộ test lưu trong DB (`TEXT`)**, phù hợp với cỡ dữ liệu của đồ án. Nếu test lên tới vài MB,
  nên chuyển sang lưu file, DB chỉ giữ đường dẫn và checksum.
- **Mã nguồn tối đa 64 KB** (CHECK). Payload gửi tới Worker vẫn nằm dưới trần 10 MB của giao thức.

## Spring Boot / JPA

- **Flyway quản lý schema; Hibernate chỉ `validate`.** Nếu entity lệch với bảng, ứng dụng không
  khởi động được. Kết nối mặc định trỏ tới `compose.yaml`; ghi đè bằng `DB_URL`, `DB_USERNAME`,
  `DB_PASSWORD`.
- **Entity** nằm trong `com.cplusplus.backend.domain`, mỗi bảng một entity, chia theo nghiệp vụ:

  | Package | Entity / enum |
  | --- | --- |
  | `domain.user` | `User`, `UserSession`, `Role` |
  | `domain.problem` | `Problem`, `TestCase`, `Difficulty`, `CheckerType` |
  | `domain.contest` | `Contest`, `ContestProblem`, `ContestParticipant`, `ContestPhase` |
  | `domain.submission` | `Submission`, `SubmissionTestResult`, `SubmissionEvent`, `SubmissionStatus`, `SubmissionEventType`, `Verdict`, `TestStatus`, `Language` |
  | `domain.worker` | `JudgeWorker`, `SystemLog`, `WorkerStatus`, `LogLevel` |
  | `domain.common` | `CodedEnum`, `CodedEnumConverter` |
- **Enum:** giá trị chữ hoa dùng `@Enumerated(STRING)`. Giá trị chữ thường (`easy`, `lines`,
  `cpp17`, `info`) dùng `CodedEnum` + converter `autoApply`.
- **Vòng đời bài nộp nằm trong `Submission`:** `assignTo` → `updateStatus` → `finish` /
  `requeue` / `fail` / `rejudge`. Mỗi bước tự thêm một `SubmissionEvent`. Mỗi lần Failover tính
  một lượt (tối đa 3); `REJECTED` (Worker bận) không tính lượt.
- **View** được đọc bằng native query trả về interface projection trong repository:
  `ProblemRepository.findAllStats`, `SubmissionRepository.findLeaderboard` / `findBestCells`,
  `ContestRepository.findStandings` / `findStandingCells`.
- **Lỗi từ trigger kỳ thi** (`check_violation`) được Spring chuyển thành
  `DataIntegrityViolationException`. Vì khóa là IDENTITY, lỗi xuất hiện ngay ở `save()`.
- **Test** (`./mvnw test`) chạy trên PostgreSQL 18 thật qua Testcontainers, nên cần Docker.

Không đưa `demo_data.sql` vào thư mục migration: nó xóa sạch dữ liệu, chỉ nạp tay khi phát triển.
