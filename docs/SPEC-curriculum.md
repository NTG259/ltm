# Spec: curriculum

## Objective

Admin tạo và quản lý lộ trình học C++ (course). Mỗi course gồm nhiều unit (chủ đề) được sắp xếp theo thứ tự. Sinh viên đăng nhập xem danh sách course đã publish và điều hướng vào từng unit.

**User stories:**
- Admin: Tôi tạo course với tiêu đề và mô tả, thêm/sửa/xóa/sắp xếp unit, rồi publish khi sẵn sàng.
- Sinh viên: Tôi thấy danh sách các course đang mở, vào chi tiết xem từng unit theo thứ tự.

**Out of scope trong module này:** nội dung lý thuyết bên trong unit (→ `lesson`), bài tập (→ `graded`/`tryit`), theo dõi tiến độ (→ `progress`, v2).

## Tech Stack

- Backend: Java 21, Spring Boot 4, Spring Data JPA, Flyway, PostgreSQL (Neon cloud)
- Frontend: React 19, Vite, Ant Design 6

## Commands

```powershell
# Backend
cd backend; .\mvnw spring-boot:run
cd backend; .\mvnw test
cd backend; .\mvnw test -Dtest=CourseControllerTest

# Frontend
cd frontend; npm run dev
cd frontend; npm run lint
```

## Project Structure

```
backend/src/main/java/com/cplusplus/backend/
  domain/course/
    Course.java
    CourseUnit.java
  repository/
    CourseRepository.java
    CourseUnitRepository.java
  controller/
    CourseController.java
  dto/
    DtoMapper.java          ← extend (thêm toCourseDto, toCourseUnitDto)

backend/src/main/resources/db/migration/
  V6__courses.sql           ← schema mới (courses + course_units)

frontend/src/
  pages/Courses/
    CourseListPage.jsx       ← danh sách course (student)
    CourseDetailPage.jsx     ← chi tiết course + danh sách unit (student)
  pages/Admin/
    AdminCoursesPage.jsx     ← CRUD course (admin)
    AdminCourseEditPage.jsx  ← quản lý unit trong 1 course (admin)
```

## Data Model

```sql
-- V6__courses.sql
CREATE TABLE courses (
    id           BIGSERIAL PRIMARY KEY,
    title        VARCHAR(255) NOT NULL,
    description  TEXT,
    is_published BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE course_units (
    id          BIGSERIAL PRIMARY KEY,
    course_id   BIGINT       NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    title       VARCHAR(255) NOT NULL,
    order_index INT          NOT NULL,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE (course_id, order_index)
);
```

## API

| Method | Path | Role | Mô tả |
|--------|------|------|-------|
| GET | `/api/courses` | Student, Admin | Danh sách courses (student: published only; admin: tất cả) |
| GET | `/api/courses/{id}` | Student, Admin | Chi tiết course + danh sách units |
| POST | `/api/courses` | Admin | Tạo course |
| PUT | `/api/courses/{id}` | Admin | Sửa title / description / is_published |
| DELETE | `/api/courses/{id}` | Admin | Xóa course (cascade units) |
| POST | `/api/courses/{id}/units` | Admin | Thêm unit |
| PUT | `/api/courses/{id}/units/{uid}` | Admin | Sửa title unit |
| DELETE | `/api/courses/{id}/units/{uid}` | Admin | Xóa unit |
| PUT | `/api/courses/{id}/units/reorder` | Admin | Đổi thứ tự — body: `[{id, orderIndex}]` |

Auth: reuse `AuthInterceptor` + `SecurityService` hiện có. Không thêm Spring Security.

## Code Style

Theo pattern hiện tại trong codebase:

```java
// domain/course/Course.java
@Entity @Table(name = "courses")
public class Course {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private String title;
    private String description;
    private boolean published;
    private Instant createdAt;
    @OneToMany(mappedBy = "course", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("orderIndex ASC")
    private List<CourseUnit> units = new ArrayList<>();
}
```

- Entity trong `domain/<module>/`, Repository interface trong `repository/`, Controller trong `controller/`
- DTO mapping tập trung tại `DtoMapper` — thêm static method, không tạo class mới
- Frontend: functional components + hooks, Ant Design components (`Table`, `Form`, `Modal`, `Draggable` cho reorder)

## Testing Strategy

- `CourseControllerTest.java` (MockMvc): tạo / lấy / sửa / xóa course và unit, kiểm tra phân quyền (student không gọi được POST/PUT/DELETE)
- Manual smoke: admin tạo course → thêm 3 units → reorder → publish → đăng nhập student thấy course

## Boundaries

- **Always:** Thêm Flyway migration mới (V6+), không chỉnh sửa migration cũ đã commit
- **Ask first:** Thêm dependency vào `pom.xml`; thay đổi cấu trúc `AuthInterceptor`
- **Never:** Sửa file migration đã commit; hardcode chuỗi kết nối DB; bỏ qua phân quyền admin/student

## Success Criteria

1. Admin tạo course, thêm ≥ 2 units, reorder, publish — DB và UI phản ánh đúng
2. Student chỉ thấy course có `is_published = true` trong danh sách
3. Student vào chi tiết course thấy units đúng thứ tự `order_index`
4. Xóa course cascade xóa toàn bộ units liên quan
5. Student gọi `POST /api/courses` → 403 Forbidden

## Open Questions

1. `order_index` có nên là liên tục (1,2,3…) hay tùy ý (10,20,30…) để dễ chèn không chạy reorder?  
   → Giả định hiện tại: tùy ý, reorder API set lại toàn bộ batch.
2. Unit khi bị xóa, các `order_index` còn lại có cần normalize lại không?  
   → Giả định: không, frontend tự xử lý gap.
