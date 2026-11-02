# Spec: Thiết kế lại luồng học bài của sinh viên

## Objective

Thay thế cơ chế tiến độ dựa trên **unit** bằng tiến độ dựa trên **bài tập lập trình (problem)**.

- Sinh viên truy cập tự do bất kỳ bài học nào từ ngày đầu (đã hoạt động).
- Thanh tiến độ khóa học hiển thị: `% = (số bài tập AC) / (tổng bài tập trong khóa) × 100`.
- Đạt AC tất cả bài tập = 100%.
- Bài học lý thuyết (lesson content) không tính vào %.
- Không có ngưỡng pass/fail.

**User:** Sinh viên học qua `CourseLearnPage`. Giảng viên/admin xem tiến độ qua API.

## Tech Stack

- Backend: Spring Boot 4 / Java 21, Spring Data JPA, PostgreSQL (Flyway migrations)
- Frontend: React 19 + Vite + Ant Design 6 (`.jsx`, no TypeScript)

## Commands

```powershell
# Build & test backend
cd backend; .\mvnw compile
cd backend; .\mvnw test -Dtest=CourseProgressServiceTest

# Dev
$env:JAVA_TOOL_OPTIONS="-Duser.timezone=UTC"; cd backend; .\mvnw spring-boot:run -Dspring-boot.run.profiles=local
cd frontend; npm run dev
```

## Project Structure

```
backend/src/main/java/.../service/CourseProgressService.java   ← logic thay đổi chính
backend/src/main/java/.../repository/CourseUnitProblemRepository.java  ← thêm query
backend/src/main/java/.../repository/SubmissionRepository.java  ← thêm query (hoặc native)
backend/src/main/resources/db/migration/V12__*.sql              ← migration nếu cần index
frontend/src/pages/Courses/CourseLearnPage.jsx                  ← cập nhật hiển thị tiến độ
```

## Thay đổi cụ thể

### Backend — `CourseProgressService.getCourseProgress()`

**Hiện tại:**
```java
int total = units.size();                        // đếm unit
int completed = completedUnitIds.size();         // unit đã hoàn thành
int percent = total > 0 ? round(completed/total * 100) : 0;
```

**Sau khi thay đổi:**
```java
int totalProblems = unitProblemRepository.countByCourseId(courseId);  // đếm problem
int solvedProblems = submissionRepository.countSolvedProblemsByCourseAndUser(courseId, user.getId());
int percent = totalProblems > 0 ? round((double) solvedProblems / totalProblems * 100) : 0;
```

Response shape mới (giữ `completedUnitIds` để sidebar vẫn hiện checkmark theo unit):
```json
{
  "courseId": 1,
  "completedUnitIds": [2, 5],
  "totalProblems": 10,
  "solvedProblems": 7,
  "percent": 70
}
```

### Backend — `CourseUnitProblemRepository`

Thêm (đếm tất cả slot, không DISTINCT — 1 problem ở 2 unit tính 2):
```java
@Query("SELECT COUNT(cup) FROM CourseUnitProblem cup WHERE cup.unit.course.id = :courseId")
long countByCourseId(@Param("courseId") Long courseId);
```

### Backend — `SubmissionRepository` (hoặc native query trong Progress repo)

Thêm native query (đếm từng slot AC — khớp với cách đếm total):
```sql
SELECT COUNT(*)
FROM course_unit_problems cup
JOIN course_units cu ON cu.id = cup.unit_id
WHERE cu.course_id = :courseId
  AND EXISTS (
    SELECT 1 FROM submissions s
    WHERE s.problem_id = cup.problem_id
      AND s.user_id = :userId
      AND s.verdict = 'AC'
  )
```

### Frontend — `CourseLearnPage.jsx`

- Thanh tiến độ (`<Progress>`) đang dùng `activeProgress.percent` — **không đổi**, backend cập nhật giá trị.
- Sidebar hiển thị checkmark per-unit qua `completedSet` — **không đổi**.
- Thêm tooltip hoặc sub-label: `"7/10 bài tập"` bên cạnh thanh % (dùng `solvedProblems` / `totalProblems` từ response).

## Testing Strategy

- Unit test `CourseProgressService`: mock `unitProblemRepository.countByCourseId` và `submissionRepository.countSolvedProblemsByCourseAndUser`, kiểm tra `percent` đúng với các trường hợp: 0 bài, 1 bài AC / 5, tất cả AC.
- Manual smoke test: đăng nhập sinh viên, truy cập khóa học, kiểm tra % thay đổi sau khi có AC submission mới.

## Boundaries

- **Always:** Giữ nguyên `completedUnitIds` trong response (sidebar cần).
- **Ask first:** Xóa bảng `user_unit_progress` (hiện vẫn cần cho `completedUnitIds`); thêm DB index nếu query chậm.
- **Never:** Thêm ngưỡng pass/fail hoặc trọng số theo bài.

## Success Criteria

1. `GET /api/courses/{id}/progress` trả `percent = round(solved_problems / total_problems × 100)`.
2. Một sinh viên có 0 AC → `percent = 0`; AC hết → `percent = 100`.
3. Bài học lý thuyết (không có `CourseUnitProblem`) không ảnh hưởng đến `percent`.
4. Thanh tiến độ trên `CourseLearnPage` hiển thị đúng giá trị mới.
5. Sidebar checkmark per-unit không bị ảnh hưởng.
6. `isUnitLocked()` vẫn trả `false` (tự do truy cập).

## Decisions

- Problem xuất hiện ở nhiều unit trong cùng khóa → tính nhiều lần (1 slot = 1 đơn vị).
- Không thêm DB index mới (V12 migration không cần).
