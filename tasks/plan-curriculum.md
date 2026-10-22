# Plan: curriculum

Spec: [SPEC-curriculum.md](../docs/SPEC-curriculum.md)

## Tổng quan

Xây từ dưới lên: DB → entities → repositories → DtoMapper → controller → frontend.
Backend hoàn chỉnh và xác nhận compile trước khi làm frontend.

## Thứ tự implementation

```
[1] DB migration V8 (courses, course_units)
      ↓
[2] Domain entities (Course, CourseUnit)
      ↓
[3] Repositories + DtoMapper extension
      ↓
[4] CourseController — CRUD khóa học & units (/api/courses)
      ↓
[5] Frontend: API client extension (frontend/src/api/index.js)
      ↓
[6] Frontend Pages:
    ├─ Admin: AdminCoursesPage, AdminCourseEditPage
    └─ Student: CourseListPage, CourseDetailPage
      ↓
[7] Router & Navigation (App.jsx, AppLayout.jsx)
```

## Chi tiết từng bước

### [1] DB migration V8
- Tạo `V8__courses.sql` với 2 bảng:
  - `courses` (id, title, description, is_published, created_at)
  - `course_units` (id, course_id FK cascade, title, order_index, created_at, UNIQUE(course_id, order_index))

### [2] Domain entities
- `Course`: id, title, description, published (`is_published`), createdAt, @OneToMany `units`
- `CourseUnit`: id, course, title, orderIndex (`order_index`), createdAt

### [3] Repositories + DtoMapper
- `CourseRepository`: `findByPublishedTrueOrderByCreatedAtDesc()`, `findAllByOrderByCreatedAtDesc()`
- `CourseUnitRepository`: `findByCourseIdOrderByOrderIndexAsc(Long courseId)`
- `DtoMapper`: `toCourseDto`, `toCourseDetailDto`, `toCourseUnitDto`

### [4] CourseController — CRUD
- `GET /api/courses`: Admin xem tất cả; Student chỉ xem `is_published = true`
- `GET /api/courses/{id}`: Chi tiết course kèm units đã sắp xếp
- `POST /api/courses`: Admin tạo course
- `PUT /api/courses/{id}`: Admin sửa title, description, is_published
- `DELETE /api/courses/{id}`: Admin xóa course (cascade xóa units)
- `POST /api/courses/{id}/units`: Admin thêm unit mới
- `PUT /api/courses/{id}/units/{uid}`: Admin sửa tên unit
- `DELETE /api/courses/{id}/units/{uid}`: Admin xóa unit
- `PUT /api/courses/{id}/units/reorder`: Admin đổi thứ tự danh sách unit

### [5] Frontend API Client
- Thêm các methods `getCourses`, `getCourse`, `createCourse`, `updateCourse`, `deleteCourse`, `addCourseUnit`, `updateCourseUnit`, `deleteCourseUnit`, `reorderCourseUnits` vào `frontend/src/api/index.js`.

### [6] Frontend Pages
- Admin:
  - `AdminCoursesPage.jsx`: Quản lý danh sách các khóa học, modal tạo mới, toggle trạng thái publish, nút vào trang edit units.
  - `AdminCourseEditPage.jsx`: Quản lý các unit bên trong một khóa học, thêm/sửa/xóa unit, hỗ trợ kéo thả/đổi thứ tự.
- Student:
  - `CourseListPage.jsx`: Danh sách các khóa học công khai dưới dạng Card.
  - `CourseDetailPage.jsx`: Chi tiết khóa học và danh sách các unit theo thứ tự.

### [7] Router & Navigation
- Cập nhật `App.jsx` và `AppLayout.jsx` thêm tab "Khóa học" cho cả Student và Admin.
