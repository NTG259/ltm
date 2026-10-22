# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Backend (Master – Spring Boot)
```powershell
cd backend; .\mvnw spring-boot:run          # run
cd backend; .\mvnw test                     # all tests
cd backend; .\mvnw test -Dtest=ClassName    # single test class
cd backend; .\mvnw compile                  # compile only
```
Ports: REST `:8000`, WebSocket `:8001`, TCP Worker `:9000`.

### Frontend (React + Vite)
```powershell
cd frontend; npm install     # first time only (or pnpm install — pnpm-lock.yaml exists)
cd frontend; npm run dev     # dev server at http://localhost:5173
cd frontend; npm run build   # production build
cd frontend; npm run lint    # ESLint
```

By default the frontend runs in **mock mode** (no backend needed). Set `VITE_USE_MOCK=false` in `frontend/.env.local` to point at the real backend (`API_BASE=/api`, WebSocket `ws://localhost:8001`).

### Judge Worker (Python)
```powershell
# 3 workers in parallel (PowerShell)
1..3 | ForEach-Object { $id = "worker-$_"; Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD\judgement'; python -X utf8 -m judgement worker --id $id --master-host 127.0.0.1 --master-port 9000" }

# Single worker
cd judgement; python -X utf8 -m judgement worker --id worker-1 --master-host 127.0.0.1 --master-port 9000

# Judge a file locally (no Master needed)
cd judgement; python -m judgement judge samples/ac.cpp --problem samples/aplusb.json

# Static security scan only
cd judgement; python -m judgement scan samples/sec.cpp

# Run judgement tests
cd judgement; python -m pytest tests/
```

## Architecture

The system is a distributed C++ online judge with three separately-running components:

```
Browser (SPA)
  └─ HTTP :8000 → Master (Spring Boot)
  └─ WebSocket :8001 → Master

Master (Spring Boot, backend/)
  └─ TCP :9000 → Judge Worker × N (judgement/)
  └─ JDBC → PostgreSQL (Neon cloud, preconfigured)
```

**Backend (`backend/`)** — Spring Boot 4 / Java 21. No Spring Security; auth is a custom `AuthInterceptor` that validates a Bearer token (SHA-256 stored in `sessions` table). The WebSocket server at `:8001` is a hand-rolled RFC 6455 implementation (`MasterWebSocketServer`), not Spring's. The TCP server at `:9000` (`WorkerSession`) speaks a binary framing protocol: 6-byte header (`magic=0xAA | opcode | uint32 payload-length`) + JSON payload. `JudgeMasterService` owns the in-memory FIFO queue, Least-Busy dispatch, heartbeat monitoring, and failover logic. Database migrations are Flyway scripts in `backend/src/main/resources/db/migration/`. All entity→DTO conversions go through `DtoMapper`.

**Judgement (`judgement/`)** — Pure-stdlib Python package. A `Worker` connects outward to Master, receives `TASK_ASSIGN` frames, calls `Judge.judge()` which runs: static scan (`scanner.py`) → `g++ -std=c++17 -O2 -static` → per-test `sandbox.py` (uses `launcher.c` via `fork`+`setrlimit`+`execvp`, measuring CPU/RSS with `wait4`) → `checker.py` (lines/tokens/exact). Results are sent as `TASK_RESULT` frames. On Windows, `launcher.c` is skipped; only wall-clock time is enforced (no memory measurement).

**Frontend (`frontend/`)** — React 19 + Vite + Ant Design 6 + Monaco Editor. Source files are `.jsx`/`.js` (not TypeScript). No Redux; state lives in components and context. All API calls go through `frontend/src/api/index.js`, which exports either `mockApi` (in-browser simulation via `mock/engine.js` and `mock/data.js`) or `realApi` (actual HTTP/WS calls), selected by `VITE_USE_MOCK`. Two roles: contestant (problem list, IDE, submissions, contests, leaderboard) and admin (worker monitor, problem bank, contest management, all submissions, classrooms).

**Classroom / LMS feature** — Added in V7 migration. `Classroom` has many `ClassroomStudent`s and many `ClassroomContest`s (junction tables). `ClassroomController` handles CRUD and bulk CSV import (`ClassroomCsvImporter`). `MonitorController` (under `/api/classrooms`) provides teacher-facing live progress views: per-student presence and per-contest submission status within a classroom.

**Plagiarism detection** — `PlagiarismService` groups each contest's best AC submissions by problem, then runs `WinnowingEngine` (Winnowing fingerprinting algorithm) via `CppCodeTokenizer` on each pair. Results stored in `plagiarism_reports` / `plagiarism_matches` tables. Triggered via `POST /contests/{id}/plagiarism/run` (admin only).

**Proctoring** — `ContestProctoring.jsx` + `useProctoring.js` on the frontend detect tab-switching and focus loss during contests, reporting violations via `POST /contests/{id}/proctor/violation`. Stored in `contest_violations`. Admin monitors live via `AdminContestMonitorPage`.

**Worker judging pipeline** — when a submission arrives, `JudgeMasterService.submit()` saves it to DB with status `IN_QUEUE`, pushes its id onto the in-memory `ConcurrentLinkedQueue<Long>`, then calls `dispatchNext()`. `dispatchNext()` is `synchronized`; it picks the first non-busy `WorkerSession` from `ConcurrentHashMap<String, WorkerSession> activeWorkers` (first-found, not true least-busy), removes the id from the queue, flips the worker to `busy=true`, and sends `OP_TASK_ASSIGN` with full source + test cases embedded in the JSON payload (up to 10 MB limit). The worker receives `OP_TASK_ASSIGN`, spawns a daemon thread (`judge-<sid>`), and returns to reading the socket immediately so PING/PONG continues during judging.

Inside the worker thread: `Judge.judge()` runs in order — `scanner.py` (static ban-list scan → SEC) → `g++ -std=c++17 -O2` in a temp dir → per-test `sandbox.run()` (POSIX: `launcher.c` via `fork`+`setrlimit`+`execvp`+`wait4`; Windows: `subprocess` with wall-clock only) → `checker.py` (line/token/exact). After each phase the worker sends `OP_TASK_STATUS` (`COMPILING` / `TESTING`). When all tests finish, it sends a single `OP_TASK_RESULT` with verdict, score, per-test breakdown, and stdout/stderr previews (capped at 4 KB / 2 KB). A negative `submissionId` (< 0) signals a "run custom test" request — the result is routed to a `CompletableFuture` in `pendingRunTests` rather than saved to DB. `dispatchNext()` is called again after every result or disconnect to drain the queue.

**Failover** — `checkHeartbeats()` fires every 5 s; any worker silent for >15 s has its socket closed and `onWorkerDisconnected()` called. That method calls `sub.requeue()` (increments `attempt`; after 3 attempts → `FAILED`) and pushes the id to the front-ish of the queue via `submissionQueue.add()`. On Master restart, `findPendingIdsInQueueOrder()` reloads all `IN_QUEUE`/`COMPILING`/`TESTING` submissions.

**Protocol frame** (`MasterProtocol.java` / `protocol.py`): 6-byte header `[0xAA][opcode][uint32 big-endian length]` + UTF-8 JSON body, max 10 MB.

**Protocol opcodes**:
- `0x01` HEARTBEAT — Master sends `{"type":"PING","ts":<epoch_ms>}`; Worker replies `{"type":"PONG","ts":…,"busy":…,"currentTask":…,"completed":…}`
- `0x02` WORKER_REGISTER — Worker→Master on connect; Master replies with `{"accepted":true}`
- `0x03` TASK_ASSIGN — Master→Worker; contains `submissionId`, `sourceCode`, `timeLimitMs`, `memoryLimitMb`, `language`, `checker`, `stopOnFirstFailure`, `tests:[{index,input,output}]`
- `0x04` TASK_STATUS — Worker→Master; `{"status":"COMPILING"|"TESTING"}`
- `0x05` TASK_RESULT — Worker→Master; `{"verdict","score","timeMs","memoryKb","passed","total","tests":[…],"compileLog","securityMessage"}`

**Database schema** — PostgreSQL (Neon cloud). Connection string is already in `backend/src/main/resources/application.yaml`; no local DB setup needed. Key tables: `users`, `sessions`, `problems`, `test_cases`, `contests`, `contest_problems`, `contest_participants`, `submissions`, `submission_test_results`, `submission_events`, `workers`, `system_logs`, `classrooms`, `classroom_students`, `classroom_contests`, `plagiarism_reports`, `plagiarism_matches`, `contest_violations`.

**Verdicts**: `AC`, `WA`, `TLE`, `MLE`, `RTE`, `CE`, `SEC`. `SEC` is detected by static scan before compilation (banned identifiers: `windows.h`, `system`, `fork`, `exec*`, etc.). `CE`/`SEC` do not incur ICPC penalty.

**Failover**: when a worker's socket closes or PONG is missed for >15 s, the in-flight submission is re-enqueued at the front with `attempt+1`; after 3 failures the submission moves to `FAILED`. On Master restart the queue is rebuilt from DB rows with status `IN_QUEUE`/`COMPILING`/`TESTING`.

## Demo credentials
- Admin: password `admin123`
- Student: MSSV `B20DCCN001`, name `Nguyễn Văn A`
