# Spec: exam-page — Trang thi cô lập

## Objective

Thay thế trải nghiệm thi hiện tại (StudentLayout + ContestWorkspacePage + ContestDetailPage riêng rẽ)
bằng một trang thi cô lập duy nhất: không có nav bar, không điều hướng ra ngoài, chỉ có 3 tab chức năng + nút Kết thúc.

**User:** Sinh viên đang thi.

## Tech Stack

- React 19 + Vite, Ant Design 6, React Router v6, `.jsx`

## Commands

```powershell
cd frontend; npm run dev    # http://localhost:5173
cd frontend; npm run lint
```

## Project Structure

```
frontend/src/pages/ContestExamPage.jsx          ← trang mới (toàn bộ exam UI)
frontend/src/App.jsx                            ← thêm route /contests/:cid/exam ngoài StudentLayout
frontend/src/api/index.js                       ← thêm finishContest()
frontend/src/pages/ContestDetailPage.jsx        ← thêm nút "Vào phòng thi" → /contests/:cid/exam
```

## Layout `ContestExamPage`

```
┌──────────────────────────────────────────────────────────┐
│  [Tên kỳ thi]   ⏱ 01:23:45   ⚠ 2 vi phạm   [Kết thúc] │  ← header cố định
├──────────────────────────────────────────────────────────┤
│  [Làm bài]  [Lịch sử nộp bài]  [Xếp hạng]               │  ← tabs
├──────────────────────────────────────────────────────────┤
│                                                          │
│   Nội dung tab hiện tại                                  │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### Tab "Làm bài"

- Danh sách bài tập bên trái (label A, B, C…, trạng thái AC/tried/chưa làm)
- Nhấn vào bài → mở code editor + submit giống `WorkspacePage` (reuse component)
- Hiện thị giới hạn thời gian, bộ nhớ

### Tab "Lịch sử nộp bài"

- Reuse `SubmissionsTab` / bảng submissions của contest hiện tại
- Lọc theo bài, verdict

### Tab "Xếp hạng"

- Reuse `ContestStandings` component

### Nút "Kết thúc"

- `Popconfirm` hoặc `Modal.confirm`: "Bạn có chắc muốn kết thúc bài thi? Sau khi kết thúc, bạn sẽ không thể vào lại."
- Confirm → `POST /api/contests/{id}/finish` → navigate `/contests/{id}` với thông báo "Đã nộp bài thành công"
- Sau khi finish: nếu sinh viên truy cập lại `/contests/:cid/exam` → redirect `/contests/{id}`

### Header

- Tên kỳ thi (truncated)
- `ContestClock` countdown
- Số vi phạm (từ `useProctoring`) — màu đỏ nếu > 0
- Nút "Kết thúc" (màu đỏ/danger)

## Route

Thêm vào `App.jsx` **ngoài** `<StudentLayout>`:

```jsx
<Route path="/contests/:cid/exam" element={<ContestExamPage />} />
```

## API

Thêm vào `frontend/src/api/index.js`:

```js
finishContest: (id) => http('POST', `/contests/${id}/finish`),
```

## Entry point

`ContestDetailPage` khi contest RUNNING và sinh viên chưa finish → hiện nút "Vào phòng thi" → navigate `/contests/:cid/exam`.

## Testing Strategy

- Manual: vào `/contests/:cid/exam`, kiểm tra không có nav bar, 3 tab hoạt động đúng.
- Kiểm tra nút Kết thúc → confirm → redirect đúng.
- Kiểm tra truy cập lại sau finish → redirect.

## Boundaries

- **Always:** Gate `finished` khi load page — redirect nếu đã finish.
- **Ask first:** Reuse `Workspace` component từ `WorkspacePage` hay copy + simplify?
- **Never:** Hiện link điều hướng sang lớp học, trang chủ, admin trong exam page.

## Success Criteria

1. `/contests/:cid/exam` render không có StudentLayout nav bar.
2. 3 tab hoạt động: làm bài submit được, lịch sử hiển thị, xếp hạng hiển thị.
3. Kết thúc → confirm → API → redirect `/contests/{id}`.
4. Truy cập lại sau finish → redirect tự động.
5. Countdown clock hiển thị đúng.
