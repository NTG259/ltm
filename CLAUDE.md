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
cd frontend; npm install     # first time only
cd frontend; npm run dev     # dev server at http://localhost:5173
cd frontend; npm run build   # production build
cd frontend; npm run lint    # ESLint
```

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

**Backend (`backend/`)** — Spring Boot 4 / Java 21. No Spring Security; auth is a custom `AuthInterceptor` that validates a Bearer token (SHA-256 stored in `sessions` table). The WebSocket server at `:8001` is a hand-rolled RFC 6455 implementation (`MasterWebSocketServer`), not Spring's. The TCP server at `:9000` (`WorkerSession`) speaks a binary framing protocol: 6-byte header (`magic=0xAA | opcode | uint32 payload-length`) + JSON payload. `JudgeMasterService` owns the in-memory FIFO queue, Least-Busy dispatch, heartbeat monitoring, and failover logic. Database migrations are Flyway scripts in `backend/src/main/resources/db/migration/`.

**Judgement (`judgement/`)** — Pure-stdlib Python package. A `Worker` connects outward to Master, receives `TASK_ASSIGN` frames, calls `Judge.judge()` which runs: static scan (`scanner.py`) → `g++ -std=c++17 -O2 -static` → per-test `sandbox.py` (uses `launcher.c` via `fork`+`setrlimit`+`execvp`, measuring CPU/RSS with `wait4`) → `checker.py` (lines/tokens/exact). Results are sent as `TASK_RESULT` frames. On Windows, `launcher.c` is skipped; only wall-clock time is enforced (no memory measurement).

**Frontend (`frontend/`)** — React 19 + Vite + Ant Design 6 + Monaco Editor. No Redux; state lives in components and context. Two roles: contestant (problem list, IDE, submissions, contests, leaderboard) and admin (worker monitor, problem bank, contest management, all submissions).

**Protocol opcodes** (`backend/.../master/protocol/MasterProtocol.java` and `judgement/judgement/protocol.py`):
- `0x01` HEARTBEAT (PING M→W / PONG W→M, every 5 s, timeout 15 s)
- `0x02` WORKER_REGISTER (W→M on connect)
- `0x03` TASK_ASSIGN (M→W)
- `0x04` TASK_STATUS (W→M, COMPILING / TESTING progress)
- `0x05` TASK_RESULT (W→M, final verdict)

**Database schema** — PostgreSQL (Neon cloud). Connection string is already in `backend/src/main/resources/application.yaml`; no local DB setup needed. Key tables: `users`, `sessions`, `problems`, `test_cases`, `contests`, `contest_problems`, `contest_participants`, `submissions`, `submission_test_results`, `submission_events`, `workers`, `system_logs`.

**Verdicts**: `AC`, `WA`, `TLE`, `MLE`, `RTE`, `CE`, `SEC`. `SEC` is detected by static scan before compilation (banned identifiers: `windows.h`, `system`, `fork`, `exec*`, etc.). `CE`/`SEC` do not incur ICPC penalty.

**Failover**: when a worker's socket closes or PONG is missed for >15 s, the in-flight submission is re-enqueued at the front with `attempt+1`; after 3 failures the submission moves to `FAILED`. On Master restart the queue is rebuilt from DB rows with status `IN_QUEUE`/`COMPILING`/`TESTING`.

## Demo credentials
- Admin: password `admin123`
- Student: MSSV `B20DCCN001`, name `Nguyễn Văn A`
