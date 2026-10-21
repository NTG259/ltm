# Plan: classroom

Spec: [SPEC-classroom.md](../SPEC-classroom.md)

## Tổng quan

Xây từ dưới lên: DB → entities → repositories → service → controller → frontend.
Backend hoàn chỉnh trước khi làm frontend.

## Thứ tự implementation

```
[1] DB migration V7
      ↓
[2] Domain entities (Classroom, ClassroomStudent, ClassroomContest)
      ↓
[3] Repositories + DtoMapper extension
      ↓
[4] ClassroomController — CRUD lớp (GET / POST / PUT / DELETE /api/classrooms)
      ↓
[5] ClassroomCsvImporter + endpoint import CSV
      ↓
[6] Contest assignment endpoints (GET / POST / DELETE /api/classrooms/{id}/contests)
      ↓
[7] Frontend: AdminClassroomsPage  ─┐  (có thể làm song song nhau)
[8] Frontend: AdminClassroomDetailPage ┤
[9] Frontend: MyClassroomsPage     ─┘
```

## Chi tiết từng bước

### [1] DB migration V7
- Tạo `V7__classrooms.sql` với 3 bảng: `classrooms`, `classroom_students` (UNIQUE user_id), `classroom_contests`
- Rủi ro: UNIQUE constraint `user_id` trên `classroom_students` — nếu DB demo đang có data thì migration có thể fail nếu 1 user xuất hiện nhiều lần. Xác suất thấp vì đây là bảng mới.

### [2] Domain entities
- `Classroom`: id, name, semester, createdBy (User), createdAt, @OneToMany units
- `ClassroomStudent`: composite PK (classroomId, userId), joinedAt
- `ClassroomContest`: composite PK (classroomId, contestId), assignedAt
- Dùng `@Embeddable` + `@EmbeddedId` cho composite PK (theo pattern JPA chuẩn)

### [3] Repositories + DtoMapper
- `ClassroomRepository`: thêm `findByStudents_UserId(Long userId)` để student query lớp của mình
- `ClassroomStudentRepository`: `existsByClassroomIdAndUserId`, `findByClassroomId`
- `ClassroomContestRepository`: `findByClassroomId`
- `DtoMapper`: thêm `toClassroomDto`, `toClassroomStudentDto` (id, username, fullName, joinedAt)

### [4] ClassroomController — CRUD
- `GET /api/classrooms`: admin → all; student → lớp của mình (query qua ClassroomStudentRepository)
- `POST /api/classrooms`: admin only, body `{name, semester}`
- `PUT /api/classrooms/{id}`: admin only
- `DELETE /api/classrooms/{id}`: admin only, cascade tự động qua DB
- `GET /api/classrooms/{id}/students`: admin only

### [5] ClassroomCsvImporter + import endpoint
- Không dùng thư viện ngoài — parse bằng `BufferedReader` + split(",") + trim
- Header row: tìm index của cột "MSSV" và "HọTên" (case-insensitive, ignore dấu space)
- Mỗi dòng: upsert user (tạo nếu chưa có) → kiểm tra constraint 1 lớp → enroll
- Nếu sinh viên đã ở lớp khác → skip + báo lỗi trong response (không rollback toàn bộ)
- Response: `{imported: N, alreadyEnrolled: M, created: K, skippedInOtherClass: P}`

### [6] Contest assignment
- `GET /api/classrooms/{id}/contests`: join với bảng contests, trả về ContestDto
- `POST /api/classrooms/{id}/contests` body `{contestId}`: kiểm tra contest tồn tại → insert
- `DELETE /api/classrooms/{id}/contests/{contestId}`: delete row

### [7-9] Frontend
- **AdminClassroomsPage**: Table danh sách lớp + nút "Tạo lớp" (Modal Form), link vào detail
- **AdminClassroomDetailPage**: Tabs — [Sinh viên | Kỳ thi]
  - Tab Sinh viên: Table + nút Upload CSV (Ant Design `Upload` component) + nút Xóa từng dòng
  - Tab Kỳ thi: Table + nút Gán kỳ thi (Select từ danh sách contests) + nút Bỏ gán
- **MyClassroomsPage**: Table đơn giản, hiển thị lớp + tên lớp + kỳ học

## Rủi ro

| Rủi ro | Xác suất | Giảm thiểu |
|--------|---------|------------|
| CSV encoding sai (UTF-8 vs ANSI) | Trung bình | Đọc với `InputStreamReader(stream, StandardCharsets.UTF_8)` |
| Sinh viên đã ở lớp khác khi import | Có thể xảy ra | Skip + report trong response, không fail toàn bộ |
| Contest bị xóa sau khi gán vào lớp | Thấp | ON DELETE CASCADE trong `classroom_contests` |

## Verification checkpoints

- Sau [3]: `.\mvnw compile` pass
- Sau [4]: `.\mvnw test -Dtest=ClassroomControllerTest` pass (CRUD basic)
- Sau [5]: upload CSV 3 dòng → response đúng, DB có 3 rows trong `classroom_students`
- Sau [9]: manual smoke test toàn bộ flow
