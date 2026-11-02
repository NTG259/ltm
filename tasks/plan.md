# Plan: Thiết kế lại luồng học bài — tiến độ theo bài tập

Spec: `tasks/SPEC-student-learning-flow.md`

## Phân tích dependency

```
T1 (repo query: count total)  ──┐
                                ├──→ T3 (service logic) ──→ T4 (frontend)
T2 (repo query: count solved) ──┘
```

T1 và T2 độc lập, có thể làm song song. T3 phụ thuộc T1+T2. T4 phụ thuộc T3.

## Các thành phần thay đổi

### T1 — `CourseUnitProblemRepository`: thêm `countByCourseId`
File: `backend/src/main/java/com/cplusplus/backend/repository/CourseUnitProblemRepository.java`

Thêm JPQL đếm tất cả slot (không DISTINCT) trong khóa:
```java
@Query("SELECT COUNT(cup) FROM CourseUnitProblem cup WHERE cup.unit.course.id = :courseId")
long countByCourseId(@Param("courseId") Long courseId);
```

### T2 — `UserUnitProgressRepository`: thêm `countSolvedSlots`
File: `backend/src/main/java/com/cplusplus/backend/repository/UserUnitProgressRepository.java`

Native query đếm số slot mà user đã có AC:
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

### T3 — `CourseProgressService.getCourseProgress()`: đổi logic tính %
File: `backend/src/main/java/com/cplusplus/backend/service/CourseProgressService.java`

- Thay `total = units.size()` → `totalProblems = unitProblemRepository.countByCourseId(courseId)`
- Thay `completed = completedUnitIds.size()` → `solvedProblems = progressRepository.countSolvedSlots(userId, courseId)`
- Giữ nguyên `completedUnitIds` (sidebar cần)
- Thêm `totalProblems`, `solvedProblems` vào response map

### T4 — `CourseLearnPage.jsx`: dùng giá trị từ API thay vì tính local
File: `frontend/src/pages/Courses/CourseLearnPage.jsx`

- Xóa `progressPercent` local (line 307, tính từ `completedSet.size / units.length`)
- Dùng `activeProgress?.percent ?? 0` cho `<Progress percent=...>`
- Đổi label từ `{completedCount}/{units.length} bài` → `{activeProgress?.solvedProblems ?? 0}/{activeProgress?.totalProblems ?? 0} bài tập`

## Rủi ro

- Nếu `totalProblems = 0` (khóa chưa có bài tập), `percent = 0` — đã handle trong service.
- Progress cache localStorage giữ shape cũ — shape mới thêm key, không xóa key cũ, nên không breaking.
