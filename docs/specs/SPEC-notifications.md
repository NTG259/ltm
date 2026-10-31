# Spec: notifications

## Objective

Thêm hệ thống thông báo in-app: icon chuông 🔔 trên navbar hiển thị badge số thông báo chưa đọc.
Khi giảng viên thực hiện 3 hành động, hệ thống tự tạo thông báo cho **tất cả sinh viên trong classroom liên quan**.

**Trigger events:**
| Sự kiện | Endpoint hiện tại |
|---------|------------------|
| GV gán contest mới vào lớp | `POST /api/classrooms/{id}/contests` |
| GV cập nhật thông tin contest | `PUT /api/contests/{id}` (TeacherController/AdminController) |
| GV cập nhật bài học / lesson | `PUT /api/courses/units/{unitId}/lessons/{lessonId}` |

**User:** Sinh viên trong classroom liên quan.

**Success criteria:**
- Badge đỏ hiện số thông báo chưa đọc; =0 thì ẩn badge.
- Click chuông → dropdown danh sách tối đa 20 thông báo mới nhất.
- Click "Đánh dấu tất cả đã đọc" → badge về 0.
- Click vào 1 thông báo → navigate đến contest/course tương ứng + đánh dấu đã đọc.
- Sinh viên ở lớp khác không nhận thông báo.
- Thông báo persist qua reload (lưu DB, không phải localStorage).

## Tech Stack

- Backend: Spring Boot 4 / Java 21, Spring Data JPA, PostgreSQL
- Frontend: React 19 + Vite + Ant Design 6 (JSX) — dùng `Popover` + `Badge`
- Auth: Bearer token
- DB migration: Flyway V21 (thêm sau V20)
- **Không dùng WebSocket push** — frontend poll `GET /api/notifications/unread-count` mỗi 30 giây; đủ real-time cho use case này.

## Commands

```powershell
# Backend
cd backend; .\mvnw compile
cd backend; .\mvnw test -Dtest=NotificationServiceTest

# Frontend  
cd frontend; npm run dev
cd frontend; npm run lint
```

## Project Structure

```
backend/src/main/resources/db/migration/
  V21__notifications.sql              ← bảng notifications mới

backend/src/main/java/com/cplusplus/backend/
  domain/notification/
    Notification.java                 ← entity
    NotificationType.java             ← enum: CONTEST_CREATED, CONTEST_UPDATED, LESSON_UPDATED
  repository/
    NotificationRepository.java       ← queries
  service/
    NotificationService.java          ← createForClassroom(), markRead(), markAllRead()
  controller/
    NotificationController.java       ← GET /api/notifications, PATCH /{id}/read, PATCH /read-all, GET /unread-count

frontend/src/
  api/index.js                        ← thêm api.getNotifications(), api.markRead(), api.markAllRead(), api.unreadCount()
  components/NotificationBell.jsx     ← icon chuông + Popover + Badge
  App.jsx (hoặc layout)               ← mount <NotificationBell /> trên navbar
```

## DB Schema — V21__notifications.sql

```sql
create table notifications (
    id          bigserial primary key,
    user_id     bigint      not null references users(id) on delete cascade,
    type        varchar(40) not null,             -- CONTEST_CREATED | CONTEST_UPDATED | LESSON_UPDATED
    title       varchar(200) not null,
    body        varchar(500),
    entity_type varchar(40),                      -- 'contest' | 'lesson'
    entity_id   bigint,                           -- id của contest hoặc lesson
    read_at     timestamptz,                      -- null = chưa đọc
    created_at  timestamptz not null default now()
);

create index idx_notifications_user_unread
    on notifications(user_id, created_at desc)
    where read_at is null;
```

## Code Style

```java
// NotificationService — tạo thông báo hàng loạt cho sinh viên trong lớp
@Transactional
public void createForClassroom(Long classroomId, NotificationType type,
                               String title, String body,
                               String entityType, Long entityId) {
    List<Long> studentIds = classroomStudentRepository
        .findAllUserIdsByClassroomId(classroomId);
    List<Notification> batch = studentIds.stream()
        .map(uid -> new Notification(uid, type, title, body, entityType, entityId))
        .toList();
    notificationRepository.saveAll(batch);
}
```

```java
// NotificationController
@GetMapping
public ResponseEntity<?> list(HttpServletRequest req) { ... }   // 20 recent, sorted by created_at desc

@GetMapping("/unread-count")
public ResponseEntity<?> unreadCount(HttpServletRequest req) { ... }

@PatchMapping("/{id}/read")
@Transactional
public ResponseEntity<?> markRead(@PathVariable Long id, HttpServletRequest req) { ... }

@PatchMapping("/read-all")
@Transactional
public ResponseEntity<?> markAllRead(HttpServletRequest req) { ... }
```

```jsx
// NotificationBell.jsx — poll mỗi 30s
const { data: countData } = useFetch(() => api.unreadCount(), [])
const count = countData?.count ?? 0

<Badge count={count} size="small">
  <BellOutlined style={{ fontSize: 18, cursor: 'pointer' }} />
</Badge>
```

## Testing Strategy

- Unit test `NotificationService`: mock `classroomStudentRepository`, kiểm tra số lượng notification được tạo đúng bằng số sinh viên trong lớp.
- Manual smoke test:
  - GV gán contest vào lớp → sinh viên lớp đó thấy badge +1.
  - GV cập nhật lesson → sinh viên lớp đó thấy badge +1.
  - Sinh viên click thông báo contest → navigate đến `/contests/{id}`.
  - "Đánh dấu tất cả đã đọc" → badge = 0.
  - Reload trang → badge vẫn đúng (persistent).

## Boundaries

- **Always:** Tạo notification trong cùng transaction với hành động của GV (saveAll trong @Transactional); nếu lỗi notification thì rollback cả action chính.
- **Ask first:** Nếu muốn dùng WebSocket push thay poll (phức tạp hơn nhưng instant); nếu muốn giới hạn số notification lưu per user (cleanup job).
- **Never:** Gửi notification cho người dùng không thuộc classroom; lưu notification vào localStorage; đẩy ra email/push ngoài.

## Assumptions

1. Poll 30 giây là đủ — không cần real-time tức thì cho thông báo bài học/contest.
2. `classroomStudentRepository` cần thêm query `findAllUserIdsByClassroomId(Long classroomId)` trả về `List<Long>` — hiện chỉ có `findAllWithUserByClassroomId` trả về entity.
3. Khi GV cập nhật contest, phải xác định classroomId liên quan qua `ClassroomContestRepository.findByContestId(contestId)` → có thể nhiều lớp, tạo notification cho tất cả.
4. Trigger "cập nhật bài học" là `PUT` lesson trong `CourseController`; cần thêm inject `NotificationService` vào đó.
5. Số thông báo hiển thị trong dropdown giới hạn 20 (tránh quá dài); badge count = tổng chưa đọc (không giới hạn 20).

## Open Questions

- Notification cho "GV cập nhật contest" cần biết classroomId: lấy qua `ClassroomContestRepository.findByContestId()`. Nếu contest gán cho nhiều lớp → tạo notification cho sinh viên **tất cả** các lớp đó. Xác nhận behavior này?
- Giữ notification bao lâu? (Đề xuất: 30 ngày, sau đó xoá bằng scheduled job — nhưng không implement trong scope này.)
