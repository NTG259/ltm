# Spec: violation-modal — Blocking modal vi phạm thoát tab

## Objective

Khi sinh viên thoát tab hoặc mất focus cửa sổ trong khi thi, hiển thị ngay một modal
chặn toàn bộ UI với thông báo "Thí sinh đã vi phạm". Sinh viên bắt buộc bấm OK mới tiếp tục.
Vi phạm được ghi log (đã có qua `useProctoring`). Giảng viên nhận notification realtime (đã có qua WebSocket).

**User:** Sinh viên (thấy modal); Giảng viên (nhận chuông — đã hoạt động, không thay đổi).

## Tech Stack

- React 19, Ant Design 6 `Modal`, hook `useProctoring` hiện có

## Project Structure

```
frontend/src/pages/ContestExamPage.jsx   ← tích hợp blocking modal vào exam page
frontend/src/lib/useProctoring.js        ← không thay đổi
```

## Thay đổi cụ thể

Trong `ContestExamPage`, dùng `onViolation` callback của `useProctoring` để set state:

```jsx
const [violationModalOpen, setViolationModalOpen] = useState(false)
const [lastViolationCount, setLastViolationCount] = useState(0)

const { violationCount } = useProctoring({
  contest,
  user,
  enabled: !isFinished,
  onViolation: (count) => {
    setLastViolationCount(count)
    setViolationModalOpen(true)
  },
})
```

Modal UI:

```jsx
<Modal
  open={violationModalOpen}
  closable={false}
  maskClosable={false}
  keyboard={false}
  footer={
    <Button type="primary" danger onClick={() => setViolationModalOpen(false)}>
      Tôi đã hiểu
    </Button>
  }
  title={<span style={{ color: '#ef4444' }}>⚠️ Thí sinh đã vi phạm</span>}
>
  <p>Bạn vừa rời khỏi màn hình làm bài.</p>
  <p>Hành vi này đã được ghi lại. Số lần vi phạm: <b>{lastViolationCount}</b></p>
  <p>Nhấn <b>"Tôi đã hiểu"</b> để tiếp tục làm bài.</p>
</Modal>
```

**Thuộc tính quan trọng:**
- `closable={false}` — không có nút X
- `maskClosable={false}` — click ra ngoài không đóng
- `keyboard={false}` — ESC không đóng

## Testing Strategy

- Manual: trong exam page, Alt+Tab sang cửa sổ khác → modal hiện; bấm "Tôi đã hiểu" → modal đóng, tiếp tục làm bài bình thường.
- Kiểm tra violation count tăng đúng.
- Kiểm tra `useProctoring` debounce 2.5s ngăn double-trigger.

## Boundaries

- **Always:** Modal không block khi contest đã FINISHED hoặc sinh viên đã finish.
- **Never:** Tự động kết thúc bài thi sau N vi phạm.

## Success Criteria

1. Alt+Tab trong exam page → modal xuất hiện ngay lập tức.
2. Modal không thể đóng bằng ESC, click mask, hoặc nút X.
3. Bấm "Tôi đã hiểu" → modal đóng → tiếp tục làm bài bình thường.
4. Số lần vi phạm hiển thị đúng trong modal và trong header exam page.
5. Vi phạm được ghi vào DB qua `useProctoring` (không thay đổi logic này).
