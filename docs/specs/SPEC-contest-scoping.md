# Spec: contest-scoping

## Objective

Trang Contests của sinh viên chỉ hiển thị các kỳ thi thuộc lớp học của mình.
Hiện tại `GET /api/contests` trả về tất cả contest; `canViewContest` dùng logic đăng ký thủ công.
Sau khi thay đổi: sinh viên thấy đúng contest được gán vào lớp của họ, không cần bước "Đăng ký" riêng.

**User:** Sinh viên đã được thêm vào ít nhất 1 classroom.

**Success criteria:**
- Sinh viên A (lớp X) không thấy contest chỉ gán cho lớp Y.
- Sinh viên chưa có lớp nào thấy danh sách rỗng.
- Admin và lecturer vẫn thấy toàn bộ contest như cũ.
- Sinh viên click "Vào thi" kỳ thi RUNNING → vào workspace mà không cần bước đăng ký riêng; participant record tự tạo lúc đó.

## Tech Stack

- Backend: Spring Boot 4 / Java 21, Spring Data JPA, PostgreSQL
- Frontend: React 19 + Vite + Ant Design 6 (JSX)
- Auth: Bearer token, `AuthInterceptor.CURRENT_USER_ATTR`
- DB migration: Flyway, hiện V20 → thêm V21 nếu cần query mới (không cần schema mới)

## Commands

```powershell
# Backend
cd backend; .\mvnw compile          # compile
cd backend; .\mvnw test             # all tests

# Frontend
cd frontend; npm run dev            # dev server :5173
cd frontend; npm run build          # production build
cd frontend; npm run lint           # ESLint
```

## Project Structure

```
backend/src/main/java/com/cplusplus/backend/
  repository/
    ContestRepository.java          ← thêm query findByStudentUserId
    ClassroomStudentRepository.java ← thêm findAllClassroomIdsByUserId
  controller/
    ContestController.java          ← sửa listContests, canViewContest, registerContest
  
frontend/src/
  pages/ContestsPage.jsx            ← bỏ nút Đăng ký, đổi filter tabs
  lib/contest.js                    ← không đổi
  api/index.js                      ← xoá api.registerContest nếu không còn dùng
```

## Code Style

```java
// Query mới trong ContestRepository — native SQL vì join 2 bảng trung gian
@Query(value = """
    select distinct c.* from contests c
    join classroom_contests cc on cc.contest_id = c.id
    join classroom_students cs on cs.classroom_id = cc.classroom_id
    where cs.user_id = :userId
    order by c.start_at desc
    """, nativeQuery = true)
List<Contest> findByStudentUserId(@Param("userId") Long userId);
```

```jsx
// ContestsPage — không còn nút Đăng ký, chỉ Xem / Vào thi
const action =
  status === 'RUNNING' ? <Button type="primary" onClick={open}>Vào thi</Button>
  : status === 'UPCOMING' ? <Button onClick={open}>Xem thể lệ</Button>
  : <Button onClick={open}>Xem kết quả</Button>
```

## Testing Strategy

- Unit test (JUnit 5 / Mockito): `ContestController.listContests` — mock repo, kiểm tra student chỉ nhận về contest của lớp mình.
- Manual smoke test:
  - Đăng nhập sinh viên → vào `/contests` → chỉ thấy contest của lớp.
  - Đăng nhập admin → vào `/contests` → thấy tất cả.
  - Sinh viên click "Vào thi" contest RUNNING → vào workspace thành công (participant tự tạo).

## Boundaries

- **Always:** Giữ nguyên `contest_participants` table — vẫn cần cho scoring / proctoring; chỉ tự tạo record khi sinh viên vào thi lần đầu.
- **Ask first:** Nếu muốn xoá hẳn endpoint `POST /contests/{id}/register` (hiện còn dùng bởi `DELETE /register` unregister flow).
- **Never:** Thay đổi logic admin/lecturer xem contest; xoá bảng `contest_participants`.

## Assumptions

1. Sinh viên có thể thuộc nhiều lớp (V19 migration đã cho phép) — truy vấn dùng `DISTINCT`.
2. Contest không gán vào lớp nào → không hiện với sinh viên (chỉ admin thấy).
3. Lecturer tạo contest thông qua admin/teacher UI → flow tạo không thay đổi ở spec này.
4. Khi sinh viên click "Vào thi" (RUNNING), `POST /contests/{id}/register` vẫn được gọi để tạo participant record — không cần endpoint mới.

## Open Questions

- Nếu sinh viên đang ở giữa kỳ thi thì bị xoá khỏi lớp → có bị kick không? (Giữ nguyên hành vi cũ: vẫn thi được vì đã có participant record.)
