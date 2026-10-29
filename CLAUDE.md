# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Phát triển local (khuyến nghị)

Backend và frontend chạy ngoài Docker; db/redis/go-judge/worker chạy trong Docker.

```powershell
# 1. Khởi động hạ tầng (db, redis, go-judge, worker)
docker compose -f compose.infra.yaml up -d --scale worker=2
# Lần đầu hoặc sau khi dùng full-stack: thêm --remove-orphans để dọn container cũ
# docker compose -f compose.infra.yaml up -d --scale worker=2 --remove-orphans

# 2. Chạy backend (profile local kết nối tới Docker db/redis)
$env:JAVA_TOOL_OPTIONS="-Duser.timezone=UTC"; cd backend; .\mvnw spring-boot:run -Dspring-boot.run.profiles=local   # :8082

# 3. Chạy frontend
cd frontend; npm run dev   # :5173 → proxy /api → localhost:8082
```

Worker trong Docker kết nối ngược vào backend local qua `host.docker.internal:9000`. Cổng host Docker: PostgreSQL `127.0.0.1:15432`, Redis `127.0.0.1:16379`.

### Backend (Master – Spring Boot)
```powershell
$env:JAVA_TOOL_OPTIONS="-Duser.timezone=UTC"; cd backend; .\mvnw spring-boot:run -Dspring-boot.run.profiles=local   # local dev
cd backend; .\mvnw spring-boot:run          # Neon cloud DB + Redis localhost:6379
cd backend; .\mvnw test                     # all tests
cd backend; .\mvnw test -Dtest=ClassName    # single test class
cd backend; .\mvnw compile                  # compile only
```

**Port note:** `server.port` defaults to `8082` locally. In Docker Compose it is overridden to `8000` via `SERVER_PORT=8000`. Profile `local` (file `application-local.yaml`) points to Docker db/redis.

### Frontend (React + Vite)
```powershell
cd frontend; npm install     # first time only (pnpm-lock.yaml exists — pnpm also works)
cd frontend; npm run dev     # dev server at http://localhost:5173
cd frontend; npm run build   # production build
cd frontend; npm run lint    # ESLint
```

Frontend luôn dùng real API. Vite dev proxy mặc định `http://127.0.0.1:8082` (local Spring Boot). Đặt trong `frontend/.env.local` nếu muốn trỏ vào Docker Compose full stack:
```
VITE_BACKEND_URL=http://127.0.0.1:18000
VITE_WS_URL=ws://localhost:18001
```
**Quan trọng:** Thiếu `VITE_WS_URL` sẽ khiến WebSocket kết nối sai cổng (`:8001` thay vì `:18001`), làm kết quả chấm bài không cập nhật realtime.

### Docker Compose (full stack)
```powershell
docker compose up -d --build --scale worker=4   # 4 judge workers; default replicas=10
docker compose --profile demo up seed           # load demo data (10 problems, 3 contests)
# Port conflict override:
$env:DB_PORT="25432"; $env:WEB_PORT="28080"; docker compose up -d --build --scale worker=4
```
Services: `db` (PostgreSQL :15432↔5432), `redis` (:16379), `backend` (:18000/:18001), `frontend` (:18080→:80), `go-judge` (:5050, internal only — `judge` network), `worker` (scale with `--scale worker=N`).

The `go-judge` healthcheck uses `wget` which is absent from the Alpine image — the service shows `unhealthy` in `docker ps` but is actually functional. Verify with:
```powershell
docker exec codejudge-backend-1 curl -s http://go-judge:5050/version
```

### k6 Load Tests
```powershell
# Requires a running backend and at least 1 judge worker
k6 run -e K6_TOKEN=<bearer> tests/k6/scenario_a_throughput.js
k6 run -e K6_TOKEN=<bearer> tests/k6/scenario_b_wait_time.js
k6 run -e K6_TOKEN=<bearer> -e PAUSE_SECONDS=30 tests/k6/scenario_c_durability.js
k6 run -e K6_TOKEN=<bearer> tests/k6/worker_utilization.js   # monitor alongside Scenario A
```

## Architecture

Distributed C++ online judge: Browser → Master (Spring Boot) → Judge Worker × N.

```
Browser (SPA)
  └─ HTTP :8000 → Master (Spring Boot)
  └─ WebSocket :8001 → Master

Master (Spring Boot, backend/)
  └─ TCP :9000 → Judge Worker × N
  └─ Redis Streams (3 priority queues)
  └─ JDBC → PostgreSQL
```

**Backend (`backend/`)** — Spring Boot 4 / Java 21. No Spring Security; auth is a custom `AuthInterceptor` that validates a Bearer token (SHA-256 stored in `sessions` table). The WebSocket server at `:8001` is a hand-rolled RFC 6455 implementation (`MasterWebSocketServer`). The TCP server at `:9000` uses `WorkerSession` with a binary framing protocol: 6-byte header (`magic=0xAA | opcode | uint32 payload-length`) + JSON payload. All entity→DTO conversions go through `DtoMapper`. Database migrations are Flyway scripts in `backend/src/main/resources/db/migration/` (currently V1–V11).

**`worker/` directory** — The Python TCP judge worker (`worker/worker.py`). Connects to Master on `:9000`, receives `OP_TASK_ASSIGN` frames, compiles via `g++`/`gcc` locally, then delegates execution to go-judge REST (`GO_JUDGE_URL`). Deployed as the `worker` service in Docker Compose. Runs entirely in Docker — no local Python setup needed for development. Environment vars: `MASTER_HOST`, `MASTER_PORT`, `GO_JUDGE_URL`, `WORKER_ID` (defaults to container hostname).

**`go-judge-custom/` directory** — Dockerfile that builds the go-judge sandbox container used by workers in Docker Compose. Requires Linux kernel (cgroups + namespaces) and runs with `--privileged`.

**`judgement/` directory** — The upstream [go-judge](https://github.com/criyle/go-judge) Go source code kept as a reference. Not built or used directly; `go-judge-custom/` is the live container.

**Frontend (`frontend/`)** — React 19 + Vite + Ant Design 6 + Monaco Editor. Source files are `.jsx`/`.js` (not TypeScript). No Redux; state in components and context. All API calls go through `frontend/src/api/index.js`, which exports either `mockApi` (via `mock/engine.js` and `mock/data.js`) or `realApi`, selected by `VITE_USE_MOCK`. Two roles: contestant and admin.

### Queue and Dispatch (V11+)

`JudgeMasterService` no longer uses `ConcurrentLinkedQueue`. The queue is **Redis Streams** with 3 priority levels, managed by `RedisStreamQueueService` (`backend/.../master/queue/`):

| Stream | Priority | When |
|--------|----------|------|
| `judge:contest` | Highest | Submission has a contestId |
| `judge:practice` | Normal | All other submissions |
| `judge:custom` | Lowest | Custom test runs |

**Submit flow:** `submit()` → `redisQueue.enqueue(sub, priority)` → Redis `XADD`. **Dispatch:** `dispatchNext()` selects the worker with the lowest `latencyMs` (not first-idle), calls `redisQueue.readNext(workerId)` (`XREADGROUP`), sets `worker.pendingStream`/`worker.pendingMessageId`, then sends `OP_TASK_ASSIGN`. **XACK is called only after `submissionRepository.save(sub)` succeeds** in `onWorkerTaskResult()` — at-least-once delivery. On disconnect, the pending PEL entry is XACK'd and the submission re-enqueued.

**Recovery on restart:** `claimStale()` (XCLAIM entries idle > 1050 s) + DB orphan scan re-enqueues all `IN_QUEUE`/`COMPILING`/`TESTING` submissions.

### attempt_token (V11)

Each dispatch in `dispatchNext()` generates a fresh `UUID attemptToken`, saves it to the `submissions.attempt_token` column, and embeds it in `OP_TASK_ASSIGN`. `onWorkerTaskResult()` rejects any result whose token doesn't match (stale result after failover). The token is `null` until first dispatch.

### Failover

`checkHeartbeats()` fires every 5 s. Any worker silent for >15 s is closed; `onWorkerDisconnected()` XACK's the old PEL entry, calls `sub.requeue()` (increments `attempt`; after 3 → `FAILED`), then re-enqueues via `redisQueue.enqueue()`. `finish()` on `Submission` is a no-op if the submission is already in a terminal state (idempotent).

### Protocol opcodes
- `0x01` HEARTBEAT — Master sends `{"type":"PING","ts":<ms>}`; Worker replies `{"type":"PONG","ts":…,"busy":…}`
- `0x02` WORKER_REGISTER — Worker→Master; Master replies `{"accepted":true}`
- `0x03` TASK_ASSIGN — Master→Worker; includes `submissionId`, `sourceCode`, `timeLimitMs`, `memoryLimitMb`, `language`, `checker`, `stopOnFirstFailure`, `attemptToken`, `tests:[{index,input,output}]`
- `0x04` TASK_STATUS — Worker→Master; `{"status":"COMPILING"|"TESTING"}`
- `0x05` TASK_RESULT — Worker→Master; `{"verdict","score","timeMs","memoryKb","passed","total","tests":[…],"compileLog","securityMessage","attemptToken"}`

### Courses / Curriculum (V7+)

`Course` → `CourseUnit` → `CourseLesson` + `CourseUnitProblem`. `CourseProgressService` tracks `UserUnitProgress`. `CourseController` handles student and admin CRUD. Frontend: `CourseListPage`, `CourseDetailPage`, `CourseLearnPage` under `frontend/src/pages/Courses/`.

### Classroom / LMS (V7+)

`Classroom` → many `ClassroomStudent`s and `ClassroomContest`s. `ClassroomController` handles CRUD and bulk CSV import (`ClassroomCsvImporter`). `MonitorController` (under `/api/classrooms`) provides teacher-facing live progress views.

### Plagiarism detection

`PlagiarismService` groups AC submissions by problem in a contest, runs `WinnowingEngine` (Winnowing fingerprinting) via `CppCodeTokenizer` on each pair. Triggered via `POST /contests/{id}/plagiarism/run` (admin only). Stored in `plagiarism_reports` / `plagiarism_matches`.

### Proctoring

`ContestProctoring.jsx` + `useProctoring.js` detect tab-switching/focus loss, report violations via `POST /contests/{id}/proctor/violation` → `contest_violations`. Admin monitors live via `AdminContestMonitorPage`.

## Auth

Login request format (note: uses `role`, not `username`):
```json
// Admin
{"role": "admin", "password": "admin123"}

// Student
{"role": "student", "studentId": "B20DCCN001", "fullName": "Nguyen Van A"}
```
Tokens are Bearer tokens; pass as `Authorization: Bearer <token>`.

Admin overview endpoint is `/api/admin/overview` (not `/api/admin/workers` or `/api/admin/queue`).

## Database

PostgreSQL (Neon cloud). Connection string already in `backend/src/main/resources/application.yaml` — no local DB setup needed for development. Flyway manages schema; current version: **V11** (adds `submissions.attempt_token UUID`).

Key tables: `users`, `sessions`, `problems`, `test_cases`, `contests`, `contest_problems`, `contest_participants`, `submissions`, `submission_test_results`, `submission_events`, `workers`, `system_logs`, `classrooms`, `classroom_students`, `classroom_contests`, `plagiarism_reports`, `plagiarism_matches`, `contest_violations`.

**Verdicts**: `AC`, `WA`, `TLE`, `MLE`, `RTE`, `CE`, `SEC`. `CE`/`SEC` do not incur ICPC penalty. Score = `round(100 × tests_passed / tests_total)`.

## Demo credentials
- Admin: password `admin123`
- Student: MSSV `B20DCCN001`, name `Nguyễn Văn A`

## Other directories

- **`sql-typ-server/`** — Separate Node.js SQL lab server (RabbitMQ + Sequelize). Has its own `docker-compose.yml`. Not part of the main CodeJudge compose stack.
- **`tests/k6/`** — k6 load test scripts (see k6 commands above).
- **`docs/`** — Project documentation assets.
