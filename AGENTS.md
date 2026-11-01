# Repository Guidelines

## Project Structure & Module Organization

CodeJudge is a distributed online judge. `backend/` contains the Java 21/Spring Boot master, API, WebSocket server, and Flyway migrations; tests mirror production packages in `src/test/java/`. `frontend/` is the React/Vite SPA: pages are in `src/pages/`, shared UI in `src/components/`, and API/auth helpers in `src/api/` and `src/auth/`. `worker/worker.py` is the TCP judge worker. `go-judge-custom/` builds the sandbox image; `judgement/` is the Go judge source. Keep load scenarios in `tests/k6/` and design records in `docs/`.

## Build, Test, and Development Commands

- `docker compose up -d --build --scale worker=4` starts the full stack; `docker compose --profile demo up seed` loads demo data.
- `docker compose -f compose.infra.yaml up -d --scale worker=2` starts development dependencies.
- `cd backend; .\mvnw spring-boot:run -Dspring-boot.run.profiles=local` runs the API. Use `.\mvnw test` or `.\mvnw compile` for backend checks.
- `cd frontend; npm install; npm run dev` runs Vite. Run `npm run lint` and `npm run build` for UI changes.
- `k6 run -e K6_TOKEN=<bearer> tests/k6/scenario_a_throughput.js` runs a load scenario; use `go test ./...` from `judgement/` for sandbox changes.

## Coding Style & Naming Conventions

Follow nearby code. Java uses four spaces, `PascalCase` classes, and `camelCase` methods. React uses two spaces, ES modules, `PascalCase.jsx` components/pages, and camelCase helpers. ESLint governs `*.js` and `*.jsx`; do not suppress warnings. Python uses four spaces and `snake_case`. Name Flyway migrations `V<number>__short_description.sql`; never edit an applied migration.

## Testing Guidelines

Add a focused JUnit test named `<ClassUnderTest>Test`, then run the smallest relevant suite first (for example, `.\mvnw test -Dtest=SecurityServiceTest`). Test judge changes with `go test ./...`; use k6 only against a disposable stack. Exercise authentication, role checks, queue/failover behavior, and WebSocket updates when changed.

## Commit & Pull Request Guidelines

History uses Conventional Commit prefixes: `feat:`, `fix:`, `docs:`, and `chore:`. Keep commits small and single-purpose; avoid `update`. PRs should explain behavior, link tasks/issues, list checks run, and include UI screenshots. Flag migration, Docker, or security-sensitive changes. Do not commit `.env`, credentials, local database files, or build output.

## Configuration & Safety

Copy `.env.example` to `.env` for local overrides. The judge uses privileged Linux containers and executes untrusted submissions: preserve network isolation, resource limits, and the `go-judge` boundary. Do not weaken sandbox settings to make a local test pass.
