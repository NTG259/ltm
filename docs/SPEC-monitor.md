# Spec: monitor

## Objective

Admin (giảng viên) theo dõi real-time hai thứ: (1) ai trong lớp đang online trên hệ thống, và (2) màn hình giám sát kỳ thi đang diễn ra — xem từng sinh viên trong lớp đang làm gì, nộp bao nhiêu bài, đã AC chưa.

**Depends on:** `classroom` (cần biết sinh viên nào thuộc lớp nào), hạ tầng WebSocket `:8001` và `submissions` đã có.

**User stories:**
- Admin: Tôi mở trang lớp học, thấy ngay 18/30 sinh viên đang online.
- Admin: Tôi mở giám sát kỳ thi đang chạy, thấy real-time từng sinh viên: đã AC mấy bài, điểm phạt, lần nộp cuối.

**Out of scope:** Can thiệp vào bài thi (kick, pause), ghi log hành vi chi tiết (anti-cheat), giám sát webcam.

## Tech Stack

- Backend: Java 21, Spring Boot 4; mở rộng `MasterWebSocketServer` (`backend/.../master/ws/`)
- Frontend: React 19, Ant Design 6 (Table với polling hoặc WebSocket live update)

## Commands

```powershell
cd backend; .\mvnw spring-boot:run
cd backend; .\mvnw test -Dtest=MonitorTest
cd frontend; npm run dev
```

## Project Structure

```
backend/src/main/java/com/cplusplus/backend/
  master/ws/
    MasterWebSocketServer.java   ← extend: track userId per session, emit PRESENCE_UPDATE
  controller/
    MonitorController.java       ← REST snapshot endpoints
  dto/
    DtoMapper.java               ← extend: toPresenceDto, toContestMonitorRowDto

frontend/src/
  pages/Admin/
    AdminClassroomMonitorPage.jsx   ← presence view (ai online trong lớp)
    AdminContestMonitorPage.jsx     ← contest monitor (per-student live table)
```

## Thiết kế kỹ thuật

### 1. Presence tracking

**Backend — mở rộng `MasterWebSocketServer`:**

- Map hiện có: `session → userId` (thêm vào khi client gửi `AUTH` thành công)
- Khi student kết nối + AUTH OK → emit `PRESENCE_UPDATE {type:"ONLINE", userId, username}` tới tất cả admin sessions
- Khi student disconnect → emit `PRESENCE_UPDATE {type:"OFFLINE", userId, username}`
- Không lưu DB; chỉ in-memory (mất khi restart — chấp nhận được)

**REST snapshot (initial load):**

```
GET /api/classrooms/{id}/presence
→ [{userId, username, fullName, online: true/false}, ...]
```

Backend tính `online` bằng cách check `userId` có trong map WebSocket hiện tại không.

### 2. Contest monitor

**REST snapshot (initial load):**

```
GET /api/classrooms/{classroomId}/contests/{contestId}/monitor
→ [{
    userId, username, fullName,
    acCount: 2, totalSubmissions: 5,
    penaltyMinutes: 40,         // ICPC: chỉ tính bài đã AC
    lastSubmitAt: "...",
    problems: [{label:"A", verdict:"AC", attempts:1, acAt:"..."}, ...]
  }, ...]
```

Query: JOIN `classroom_students` + `submissions` + `contest_problems` WHERE `contest_id = ?` AND `user_id IN (lớp)`.

**Real-time update:**

Tận dụng `SUBMISSION_UPDATE` đã có trên WebSocket. Frontend lắng nghe event này, nếu `userId` thuộc lớp đang giám sát thì cập nhật row tương ứng trong bảng — không cần event mới.

## API

| Method | Path | Role | Mô tả |
|--------|------|------|-------|
| GET | `/api/classrooms/{id}/presence` | Admin | Snapshot online/offline của SV trong lớp |
| GET | `/api/classrooms/{cid}/contests/{kid}/monitor` | Admin | Snapshot trạng thái thi của từng SV |

WebSocket events (`:8001`):

| `type` | Khi nào | Người nhận |
|--------|---------|------------|
| `PRESENCE_UPDATE` | Student kết nối/ngắt WebSocket | Admin sessions |
| `SUBMISSION_UPDATE` | Bài được chấm xong (đã có) | Chủ bài + admin |

## Code Style

```java
// Thêm vào MasterWebSocketServer
private final Map<String, Long> sessionUserIds = new ConcurrentHashMap<>(); // sessionKey → userId

// Khi xử lý AUTH message thành công:
sessionUserIds.put(sessionKey, user.getId());
broadcastToAdmins(buildPresenceEvent("ONLINE", user));

// Khi session đóng:
Long userId = sessionUserIds.remove(sessionKey);
if (userId != null) broadcastToAdmins(buildPresenceEvent("OFFLINE", userId));
```

Frontend contest monitor table: polling 10s fallback + WebSocket live update. Sử dụng Ant Design `Table` với `rowKey="userId"`.

## Testing Strategy

- `MonitorTest.java` (MockMvc + mock WebSocket state):
  - Presence snapshot: 2 sinh viên trong lớp, 1 đang online → trả đúng
  - Contest monitor: 2 sinh viên có submissions → tính đúng acCount, penaltyMinutes
- Manual smoke: mở 2 tab (admin + student), student đăng nhập → admin thấy online

## Boundaries

- **Always:** Presence chỉ in-memory, không persist; không expose WebSocket internal session keys ra ngoài
- **Ask first:** Thêm persistent presence (lưu DB last_seen); thay đổi cấu trúc `MasterWebSocketServer`
- **Never:** Cho phép admin can thiệp vào session/bài thi của sinh viên qua monitor API

## Success Criteria

1. Student mở trình duyệt và kết nối WebSocket → admin thấy student đó chuyển sang online trong ≤ 2s
2. Student ngắt kết nối → admin thấy offline trong ≤ 20s (timeout WebSocket hiện tại)
3. Contest monitor snapshot trả đúng acCount và penaltyMinutes theo luật ICPC
4. Khi có bài được chấm xong, row tương ứng trong bảng admin cập nhật mà không cần reload trang
5. Student không gọi được `/api/classrooms/{id}/presence` (403)

## Open Questions

1. Nếu admin reload trang, có muốn khôi phục lịch sử "ai đã online từ đầu buổi" không?  
   → Giả định: không — chỉ hiện trạng thái live hiện tại.
2. Contest monitor có cần sort tự động (AC nhiều nhất lên đầu) hay để admin tự sort?  
   → Giả định: trả về unsorted, frontend dùng Ant Design Table sort client-side.
