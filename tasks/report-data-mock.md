# report-data-mock — Rà soát dữ liệu mock / không thực tế

> Tạo: 2026-10-28. Làm theo thứ tự ưu tiên từ trên xuống.

---

## P0 — Nghiêm trọng (ảnh hưởng real mode, có thể mất dữ liệu)

### 1. Silent fallback về mock khi backend lỗi — `api/index.js:715–730`

10 endpoint khóa học trong `realApi` bọc `.catch(() => mockApi.xxx())`:
```js
listCourses: () => http('GET', '/courses').catch(() => mockApi.listCourses()),
getCourse: (id) => http('GET', `/courses/${id}`).catch(() => mockApi.getCourse(id)),
// ... 8 endpoint tương tự
```
**Vấn đề:** Nếu backend trả lỗi (network, 500, 404), frontend silently ghi vào localStorage mock
thay vì báo lỗi → người dùng nghĩ đã lưu thành công nhưng thực ra mất dữ liệu ngầm.

**Việc cần làm:** Xóa tất cả `.catch(() => mockApi.xxx())` trong `realApi`; để lỗi propagate
lên UI như các endpoint khác.

---

## P1 — Bug (crash hoặc UI sai ở real/mock mode)

### 2. `mockApi` thiếu `getClassroomPresence` và `getContestMonitor` — `api/index.js`

`realApi` có cả hai (dòng 712–713), `mockApi` không có.
→ `AdminClassroomMonitorPage` và `AdminContestMonitorPage` crash (`TypeError: api.xxx is not a function`)
khi `VITE_USE_MOCK=true`.

**Việc cần làm:** Thêm stub hai hàm vào `mockApi`; trả dữ liệu giả hợp lệ từ `engine`.

---

### 3. Nút "Kết nối lại" luôn disabled ở real mode — `JudgeClusterPanels.jsx:212`

```jsx
<Button disabled={!USE_MOCK}>Kết nối lại</Button>
```
`realApi.reviveWorker()` luôn reject; nút bị grayed-out không tooltip giải thích.

**Việc cần làm:** Bỏ `disabled={!USE_MOCK}`, gọi API thật, hiển thị thông báo lỗi/thành công
rõ ràng, hoặc ẩn hẳn nút nếu feature chưa hỗ trợ ở backend.

---

## P2 — Chất lượng / bundle

### 4. Import `mock/data.js` trực tiếp trong production page — `WorkspacePage.jsx:38`

```js
import { SAMPLE_SOURCES, STARTER_CODE } from '../api/mock/data'
```
Coupling page thật với thư mục mock; toàn bộ sample sources đưa vào prod bundle.

**Việc cần làm:** Chuyển `SAMPLE_SOURCES` / `STARTER_CODE` sang file riêng (`lib/starterCode.js`
hoặc tương tự) không nằm trong `mock/`.

---

### 5. Dead code `_SAMPLE_LESSONS_REMOVED` ~100 dòng — `CourseLearnPage.jsx:50–150`

```js
// eslint-disable-next-line no-unused-vars
const _SAMPLE_LESSONS_REMOVED = { io: {...}, branches: {...}, ... }
```
Dữ liệu hardcode cũ bị disable bằng prefix `_`, không xóa hẳn → bundle bloat.

**Việc cần làm:** Xóa toàn bộ khối này.

---

## P3 — Chỉ ảnh hưởng mock mode (không urgent)

### 6. `mockApi.leaderboard` bỏ qua `classroomId` — `api/index.js:291`

```js
leaderboard: (_classroomId) => delay(leaderboardFrom(...))
```
Luôn trả bảng xếp hạng toàn hệ thống, không filter theo lớp.

---

### 7. `mockApi.onlineCount` dùng công thức vô nghĩa — `api/index.js:248`

```js
onlineCount: () => delay({ count: engine.submissions().length % 5 })
```
Số online = số bài nộp mod 5 — không phản ánh thực tế, gây hiểu nhầm khi dev.

---

### 8. `mockApi.runTest` luôn trả `verdict: 'AC'` — `api/index.js:266`

Custom test run mock không kiểm tra code, luôn pass.

---

## Checklist

- [ ] P0-1: Xóa silent mock fallback trong realApi (khóa học)
- [ ] P1-2: Thêm stub `getClassroomPresence` + `getContestMonitor` vào mockApi
- [ ] P1-3: Fix nút "Kết nối lại" — bỏ `disabled={!USE_MOCK}`
- [ ] P2-4: Tách `SAMPLE_SOURCES` ra khỏi `mock/data.js`
- [ ] P2-5: Xóa dead code `_SAMPLE_LESSONS_REMOVED`
- [ ] P3-6: Fix mock leaderboard filter theo classroomId
- [ ] P3-7: Fix mock onlineCount trả giá trị thực tế hơn
- [ ] P3-8: Mock runTest trả verdict ngẫu nhiên hợp lệ thay vì luôn AC
