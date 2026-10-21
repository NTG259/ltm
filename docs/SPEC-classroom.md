# Spec: classroom

## Objective

Admin (giảng viên) tạo và quản lý lớp học theo kỳ học thực tế. Import danh sách sinh viên từ file CSV. Gán kỳ thi cho lớp để theo dõi và giám sát.

**User stories:**
- Admin: Tôi tạo lớp "Lập trình C++ - K65 - HK1/2025", import CSV 30 sinh viên, rồi gán kỳ thi đang diễn ra vào lớp.
- Student: Tôi thấy mình đang ở lớp nào (read-only).

**Out of scope:** Điểm danh vật lý, sinh viên tự đăng ký lớp, theo dõi tiến độ per-student (→ `progress` v2).

## Tech Stack

- Backend: Java 21, Spring Boot 4, Spring Data JPA, Flyway, PostgreSQL
- Frontend: React 19, Vite, Ant Design 6 (Table, Form, Modal, Upload cho CSV)

## Commands

```powershell
cd backend; .\mvnw spring-boot:run
cd backend; .\mvnw test -Dtest=ClassroomControllerTest
cd frontend; npm run dev
```

## Project Structure

```
backend/src/main/java/com/cplusplus/backend/
  domain/classroom/
    Classroom.java
    ClassroomStudent.java       ← join table entity
    ClassroomContest.java       ← join table entity
  repository/
    ClassroomRepository.java
    ClassroomStudentRepository.java
    ClassroomContestRepository.java
  controller/
    ClassroomController.java
  service/
    ClassroomCsvImporter.java   ← parse CSV, upsert students, enroll
  dto/
    DtoMapper.java              ← extend: toClassroomDto, toClassroomStudentDto

backend/src/main/resources/db/migration/
  V7__classrooms.sql

frontend/src/
  pages/Admin/
    AdminClassroomsPage.jsx     ← danh sách + tạo lớp
    AdminClassroomDetailPage.jsx ← quản lý SV + contest của 1 lớp
  pages/Student/
    MyClassroomsPage.jsx        ← student xem lớp của mình (read-only)
```

## Data Model

```sql
-- V7__classrooms.sql
CREATE TABLE classrooms (
    id          BIGSERIAL PRIMARY KEY,
    name        VARCHAR(255) NOT NULL,
    semester    VARCHAR(50),                        -- "HK1/2025", "HK2/2025"
    created_by  BIGINT REFERENCES users(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE classroom_students (
    classroom_id BIGINT NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
    user_id      BIGINT NOT NULL REFERENCES users(id)      ON DELETE CASCADE,
    joined_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (classroom_id, user_id),
    UNIQUE (user_id)   -- mỗi sinh viên chỉ ở 1 lớp
);

CREATE TABLE classroom_contests (
    classroom_id BIGINT NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
    contest_id   BIGINT NOT NULL REFERENCES contests(id)   ON DELETE CASCADE,
    assigned_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (classroom_id, contest_id)
);
```

## API

| Method | Path | Role | Mô tả |
|--------|------|------|-------|
| GET | `/api/classrooms` | Admin, Student | Admin: tất cả; Student: lớp của mình |
| POST | `/api/classrooms` | Admin | Tạo lớp |
| PUT | `/api/classrooms/{id}` | Admin | Sửa name/semester |
| DELETE | `/api/classrooms/{id}` | Admin | Xóa lớp (cascade) |
| GET | `/api/classrooms/{id}/students` | Admin | Danh sách sinh viên trong lớp |
| POST | `/api/classrooms/{id}/students/import` | Admin | Upload CSV (`multipart/form-data`, field `file`) |
| DELETE | `/api/classrooms/{id}/students/{userId}` | Admin | Xóa sinh viên khỏi lớp |
| GET | `/api/classrooms/{id}/contests` | Admin | Danh sách kỳ thi được gán |
| POST | `/api/classrooms/{id}/contests` | Admin | Gán kỳ thi (body: `{contestId}`) |
| DELETE | `/api/classrooms/{id}/contests/{contestId}` | Admin | Bỏ gán kỳ thi |

**CSV import logic (`ClassroomCsvImporter`):**
1. Đọc từng dòng: cột 1 = MSSV (trim + toUpperCase), cột 2 = Họ tên (optional).
2. Nếu `users.username = MSSV` đã tồn tại → dùng user đó.
3. Nếu chưa tồn tại → tạo `User.student(mssv, fullName)` mới.
4. Upsert vào `classroom_students` (ignore if already enrolled).
5. Trả về: `{imported: N, alreadyEnrolled: M, created: K}`.

## Code Style

Theo pattern hiện tại:
```java
// controller/ClassroomController.java
@RestController
@RequestMapping("/api/classrooms")
public class ClassroomController {

    @PostMapping("/{id}/students/import")
    public ResponseEntity<?> importCsv(
            @PathVariable Long id,
            @RequestParam("file") MultipartFile file,
            HttpServletRequest req) {
        var admin = securityService.requireAdmin(req);
        var result = csvImporter.importTo(id, file);
        return ResponseEntity.ok(result);
    }
}
```

- Reuse `securityService.requireAdmin(req)` / `securityService.requireAuth(req)` hiện có
- Không thêm Spring Security hay annotation-based auth

## Testing Strategy

- `ClassroomControllerTest.java` (MockMvc):
  - Tạo lớp, import CSV (mock MultipartFile), gán contest
  - Student không tạo được lớp (403)
  - Import CSV: sinh viên mới được tạo, sinh viên cũ được enroll
- Manual smoke: tạo lớp → upload CSV 3 dòng → xác nhận danh sách → gán 1 contest

## Boundaries

- **Always:** Migration mới V7+, không sửa migration cũ; validate CSV trước khi insert (bỏ qua dòng thiếu MSSV)
- **Ask first:** Thêm thư viện parse CSV (OpenCSV); thay đổi format CSV
- **Never:** Import đè lên dữ liệu user hiện có (fullName, role); xóa user khi xóa khỏi lớp

## Success Criteria

1. Admin tạo lớp, upload CSV 3 dòng (1 SV đã tồn tại, 2 SV mới) → 3 người trong lớp, 2 user mới được tạo
2. Admin gán 1 contest vào lớp → hiện trong danh sách contest của lớp
3. Student đăng nhập thấy mình ở lớp nào
4. Xóa lớp → cascade xóa `classroom_students` và `classroom_contests`
5. Student gọi `POST /api/classrooms` → 403

## Open Questions

1. Tên cột trong CSV có cố định không (cột 1 luôn là MSSV, cột 2 là họ tên), hay cần header row?  
   → Giả định: có header row, header "MSSV" và "HọTên" (case-insensitive).
2. Một sinh viên có thể ở nhiều lớp cùng lúc không?  
   → Giả định: có.
