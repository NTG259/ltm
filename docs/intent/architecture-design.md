# Intent: Thiết kế kiến trúc CodeJudge nâng cao

## Statement of Intent

- **Outcome:** Design doc hoàn chỉnh (3 ngày nghiên cứu), đủ để AI agent build từng cụm lên codebase hiện tại
- **Người thực hiện:** 1 người thiết kế + 2 người implement bằng AI agent
- **Điểm xuất phát:** Codebase CodeJudge hiện có là prototype — agent đọc code hiện tại rồi upgrade theo doc
- **Novelty framing:** Đo hệ thống đạt gần đến non-functional requirements như thế nào (latency, throughput, availability, isolation)
- **Success:** 7 cụm đủ cho báo cáo + implement xong chạy được + có số liệu thực so với NFR
- **Constraint:** 3 ngày nghiên cứu, 3 người, scope phải build được thật trên Linux
- **Out of scope:** LMS (curriculum/lesson/tryit), UI/frontend, so sánh với code cũ

## 7 Cụm thiết kế (theo thứ tự dependency)

| Thứ tự | Cụm | File |
|--------|-----|------|
| 1 | System Architecture | `tasks/task-01-system-architecture.md` |
| 2 | Database & State Machine | `tasks/task-02-database-state-machine.md` |
| 3 | Network & Protocol Design | `tasks/task-03-network-protocol.md` — trọng tâm điểm môn học (25% network) |
| 4 | Queue & Concurrency | `tasks/task-04-queue-concurrency.md` — phức tạp nhất về distributed systems |
| 5 | Error Handling & Failover | `tasks/task-05-failover.md` — khó nhất về correctness |
| 6 | Sandbox & Security | `tasks/task-06-sandbox-security.md` — sâu nhất về OS/systems programming |
| 7 | Experimental Setup | `tasks/task-07-experimental.md` |

## Non-functional requirements (NFR) — thước đo thành công

| NFR | Target |
|-----|--------|
| Concurrent submissions | ≥ 50 bài cùng lúc không drop |
| Queue wait time (p95) | < 2 s khi có 3 workers |
| Worker throughput | ≥ 10 submissions/phút/worker |
| Worker utilization | ≥ 80% khi queue đầy |
| Queue durability | 0 bài mất khi Master restart |
| Memory isolation | Không có submission nào vượt MLE mà không bị kill |

## Mapping sang báo cáo môn học

| Phần báo cáo | Cụm phụ trách |
|--------------|---------------|
| System Architecture | Cụm 1 |
| Network Communication Design | Cụm 3 |
| Protocol / Message Format | Cụm 3 |
| Concurrency | Cụm 4 |
| Error Handling | Cụm 5 |
| Novelty & Contributions | Cụm 3 (TCP), 4 (Redis), 5 (attempt_token), 6 (cgroups) |
| Experimental Results | Cụm 7 |
| Database | Cụm 2 |
