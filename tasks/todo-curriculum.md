# Tasks: curriculum

- [x] Task 1: DB migration V8 — tạo 2 bảng `courses` và `course_units`
  - Acceptance: `V8__courses.sql` tạo đúng cấu trúc bảng và khóa ngoại cascade
  - Files: `backend/src/main/resources/db/migration/V8__courses.sql`

- [x] Task 2: Domain entities — `Course`, `CourseUnit`
  - Acceptance: 2 entity compile được, JPA relationship đúng (@OneToMany với orphanRemoval và cascade ALL)
  - Files: `backend/src/main/java/com/cplusplus/backend/domain/course/Course.java`, `CourseUnit.java`

- [x] Task 3: Repositories + DtoMapper extension
  - Acceptance: `CourseRepository`, `CourseUnitRepository` có các phương thức truy vấn cần thiết; `DtoMapper` có `toCourseDto`, `toCourseDetailDto`, `toCourseUnitDto`
  - Files: `backend/src/main/java/com/cplusplus/backend/repository/CourseRepository.java`, `CourseUnitRepository.java`, `backend/src/main/java/com/cplusplus/backend/dto/DtoMapper.java`

- [x] Task 4: CourseController — 9 REST endpoints
  - Acceptance: GET/POST/PUT/DELETE `/api/courses` và `/api/courses/{id}/units`; phân quyền Admin/Student đúng
  - Files: `backend/src/main/java/com/cplusplus/backend/controller/CourseController.java`

- [x] Task 5: Frontend API client
  - Acceptance: Các hàm API cho courses và units được định nghĩa đầy đủ trong `api.js`
  - Files: `frontend/src/api/index.js`

- [x] Task 6: Frontend Pages (Admin & Student)
  - Acceptance: 
    - `AdminCoursesPage.jsx`: Xem, tạo, sửa, xóa, publish/unpublish khóa học
    - `AdminCourseEditPage.jsx`: Quản lý các unit, sửa tên, sắp xếp thứ tự
    - `CourseListPage.jsx`: Sinh viên xem các khóa học đã mở
    - `CourseDetailPage.jsx`: Sinh viên xem nội dung và thứ tự các unit
  - Files: 
    - `frontend/src/pages/admin/AdminCoursesPage.jsx`
    - `frontend/src/pages/admin/AdminCourseEditPage.jsx`
    - `frontend/src/pages/Courses/CourseListPage.jsx`
    - `frontend/src/pages/Courses/CourseDetailPage.jsx`

- [x] Task 7: Routing & Navigation
  - Acceptance: Menu hiển thị "Khóa học" ở cả Student và Admin; routes hoạt động mượt mà
  - Files: `frontend/src/App.jsx`, `frontend/src/components/AppLayout.jsx`
