# Tasks: classroom

- [ ] Task 1: DB migration V7 — tạo 3 bảng classrooms, classroom_students, classroom_contests
  - Acceptance: `.\mvnw spring-boot:run` khởi động không có Flyway error; 3 bảng tồn tại trong DB
  - Verify: `.\mvnw spring-boot:run` + kiểm tra log "Successfully applied 1 migration"
  - Files: `backend/src/main/resources/db/migration/V7__classrooms.sql`

- [ ] Task 2: Domain entities — Classroom, ClassroomStudent, ClassroomContest
  - Acceptance: 3 entity compile được, JPA relationship đúng (Classroom @OneToMany students/contests)
  - Verify: `cd backend; .\mvnw compile`
  - Files: `domain/classroom/Classroom.java`, `ClassroomStudent.java`, `ClassroomContest.java`

- [ ] Task 3: Repositories + DtoMapper extension
  - Acceptance: 3 repository interface có đủ query cần thiết; DtoMapper có toClassroomDto + toClassroomStudentDto
  - Verify: `cd backend; .\mvnw compile`
  - Files: `repository/ClassroomRepository.java`, `ClassroomStudentRepository.java`, `ClassroomContestRepository.java`, `dto/DtoMapper.java`

- [ ] Task 4: ClassroomController — CRUD lớp + danh sách sinh viên
  - Acceptance: GET/POST/PUT/DELETE `/api/classrooms` hoạt động; student 403 khi POST; admin thấy tất cả, student thấy lớp mình
  - Verify: `.\mvnw test -Dtest=ClassroomControllerTest` (viết test cho 5 endpoint này)
  - Files: `controller/ClassroomController.java`

- [ ] Task 5: ClassroomCsvImporter + endpoint import CSV
  - Acceptance: upload CSV 3 dòng (1 SV đã tồn tại, 2 mới) → response `{imported:3, created:2, alreadyEnrolled:0, skippedInOtherClass:0}`; SV đã ở lớp khác → skippedInOtherClass tăng, không rollback
  - Verify: `.\mvnw test -Dtest=ClassroomControllerTest` (test import)
  - Files: `service/ClassroomCsvImporter.java`, `controller/ClassroomController.java`

- [ ] Task 6: Contest assignment endpoints
  - Acceptance: POST gán contest → row trong classroom_contests; GET trả danh sách đúng; DELETE bỏ gán
  - Verify: `.\mvnw test -Dtest=ClassroomControllerTest` (test 3 endpoint contest)
  - Files: `controller/ClassroomController.java`

- [ ] Task 7: Frontend — AdminClassroomsPage
  - Acceptance: admin thấy danh sách lớp, tạo lớp mới qua Modal, lớp mới xuất hiện trong table
  - Verify: manual test http://localhost:5173 với tài khoản admin
  - Files: `frontend/src/pages/Admin/AdminClassroomsPage.jsx`, cập nhật router

- [ ] Task 8: Frontend — AdminClassroomDetailPage
  - Acceptance: tab Sinh viên — xem danh sách, upload CSV, xóa SV; tab Kỳ thi — gán/bỏ gán contest
  - Verify: manual test: upload CSV 2 dòng → 2 SV xuất hiện; gán 1 contest → hiện trong tab Kỳ thi
  - Files: `frontend/src/pages/Admin/AdminClassroomDetailPage.jsx`

- [ ] Task 9: Frontend — MyClassroomsPage (student view)
  - Acceptance: đăng nhập sinh viên → thấy tên lớp và kỳ học; sinh viên chưa có lớp → hiện trạng thái "Chưa được xếp lớp"
  - Verify: manual test với tài khoản sinh viên B20DCCN001
  - Files: `frontend/src/pages/Student/MyClassroomsPage.jsx`, cập nhật router
