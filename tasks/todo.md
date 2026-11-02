# Tasks: Thiết kế lại luồng học bài

## T1 — Thêm `countByCourseId` vào `CourseUnitProblemRepository`
- Acceptance: `countByCourseId(courseId)` trả đúng số slot (problem × unit appearances)
- Verify: `.\mvnw compile` không lỗi
- Files: `CourseUnitProblemRepository.java`

## T2 — Thêm `countSolvedSlots` vào `UserUnitProgressRepository`
- Acceptance: query trả đúng số slot user đã AC; khớp với cách đếm T1
- Verify: `.\mvnw compile` không lỗi
- Files: `UserUnitProgressRepository.java`

## T3 — Cập nhật `CourseProgressService.getCourseProgress()`
- Acceptance: response chứa `totalProblems`, `solvedProblems`, `percent` tính theo problem; `completedUnitIds` vẫn có
- Verify: `.\mvnw compile`; gọi thủ công `GET /api/courses/{id}/progress` khi logged in
- Files: `CourseProgressService.java`

## T4 — Cập nhật `CourseLearnPage.jsx` dùng giá trị từ API
- Acceptance: thanh % và label `X/Y bài tập` hiển thị đúng theo `activeProgress`; không còn tính local từ unit count
- Verify: chạy `npm run dev`, vào khóa học, kiểm tra thanh tiến độ
- Files: `CourseLearnPage.jsx`
