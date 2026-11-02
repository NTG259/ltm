# Spec: finish-api — Kết thúc phần thi của sinh viên

## Objective

Cho phép sinh viên kết thúc phần thi của mình một cách chủ động và vĩnh viễn.
Sau khi finish, sinh viên không thể vào lại exam page của kỳ thi đó.

**User:** Sinh viên (gọi khi bấm "Kết thúc"); Backend gate (chặn re-entry).

## Tech Stack

- Spring Boot 4 / Java 21, Spring Data JPA, PostgreSQL, Flyway

## Commands

```powershell
cd backend; .\mvnw compile
cd backend; .\mvnw test -Dtest=ContestControllerTest
```

## Project Structure

```
backend/src/main/resources/db/migration/V20__contest_participant_finished.sql  ← migration mới
backend/src/main/java/.../domain/contest/ContestParticipant.java               ← thêm finishedAt
backend/src/main/java/.../controller/ContestController.java                    ← endpoint POST /finish
```

## Thay đổi cụ thể

### V20 migration

```sql
ALTER TABLE contest_participants ADD COLUMN finished_at TIMESTAMPTZ;
```

### `ContestParticipant` — thêm field

```java
@Column(name = "finished_at")
private Instant finishedAt;

public boolean isFinished() { return finishedAt != null; }
public void finish(Instant at) { this.finishedAt = at; }
public Instant getFinishedAt() { return finishedAt; }
```

### `ContestController` — endpoint mới

```
POST /api/contests/{id}/finish
Authorization: Bearer <token>
Response 200: { "finished": true, "finishedAt": "<ISO>" }
Response 409: { "error": "already_finished" }  — nếu gọi lại lần 2
Response 403: nếu không phải thí sinh đã đăng ký
```

Logic:
1. Lấy `ContestParticipant` của user trong contest (nếu không có → 403)
2. Nếu `isFinished()` → 409
3. `participant.finish(Instant.now())` → save → 200

### DTO response `ContestDTO` / `getContest()`

Thêm field `finished: boolean` cho sinh viên hiện tại:

```json
{
  "id": 1,
  "title": "...",
  "registered": true,
  "finished": false   // ← thêm
}
```

Dùng để exam-page gate: nếu `finished = true` khi load → redirect về `/contests/{id}`.

## Testing Strategy

- Manual: `POST /api/contests/{id}/finish` với Bearer token sinh viên → 200; gọi lần 2 → 409.
- Kiểm tra `finished_at IS NOT NULL` trong DB sau khi gọi.

## Boundaries

- **Always:** Chỉ sinh viên đã đăng ký mới gọi được finish; admin/lecturer không bị ảnh hưởng.
- **Ask first:** Cho phép admin reset `finished_at = NULL` để sinh viên vào lại.
- **Never:** Tự động finish khi contest kết thúc (contest end ≠ student finish).

## Success Criteria

1. `POST /api/contests/{id}/finish` trả 200 lần đầu, 409 lần thứ 2.
2. `GET /api/contests/{id}` trả `finished: true` cho sinh viên đã finish.
3. `finished_at` được lưu vào DB đúng timestamp.
