# Font Sync theo shadcn

## Hiện trạng

| Điểm | Trạng thái |
|------|-----------|
| Font chữ | ✅ Geist (sans) + JetBrains Mono — trùng với preset `nova` |
| Load font | ✅ Google Fonts trong `index.html` |
| `--font-sans` | ✅ Đúng tên shadcn |
| `--mono` | ❌ shadcn dùng `--font-mono`, project đang dùng `--mono` |
| `components.json` | ❌ Chưa init shadcn |

---

## Task #1 — Init shadcn với preset nova

```powershell
cd frontend
npx shadcn@latest init --preset nova
```

- Preset `nova` dùng Geist — khớp font hiện tại
- Tạo `components.json`, thiết lập CSS vars chuẩn shadcn
- Không cần Tailwind (project dùng Ant Design)

---

## Task #2 — Rename `--mono` → `--font-mono` trong global.css

File: `frontend/src/styles/global.css`

1. Dòng 20 — đổi khai báo biến:
   ```css
   /* trước */
   --mono: 'JetBrains Mono', 'Cascadia Code', 'Fira Code', Consolas, ui-monospace, monospace;
   /* sau */
   --font-mono: 'JetBrains Mono', 'Cascadia Code', 'Fira Code', Consolas, ui-monospace, monospace;
   ```
2. Replace all `var(--mono)` → `var(--font-mono)` — **30+ chỗ**
3. Thêm alias tương thích vào `:root` để tránh break code còn sót:
   ```css
   --mono: var(--font-mono);
   ```

> Không đổi font stack, chỉ đổi tên biến.

---

## Task #3 — Cập nhật `--mono` → `--font-mono` trong JS/JSX

| File | Dòng | Thay đổi |
|------|------|---------|
| `src/theme.js` | 15 | `fontFamilyCode: 'var(--mono)'` → `'var(--font-mono)'` |
| `src/pages/admin/AdminCourseEditPage.jsx` | 483, 540 | `fontFamily: 'var(--mono)'` → `'var(--font-mono)'` |
| `src/pages/ProblemsPage.jsx` | 80 | `fontFamily: 'var(--mono)'` → `'var(--font-mono)'` |
| `src/pages/Courses/CourseLearnPage.jsx` | 669, 685 | `fontFamily: 'var(--mono)'` → `'var(--font-mono)'` |

---

## Task #4 — Verify và dọn dẹp

1. Chạy `npx shadcn@latest preset resolve --json` — kiểm tra xem shadcn muốn set `--font-mono` thành gì
   - Nếu shadcn ghi đè bằng Geist Mono → giữ nguyên JetBrains Mono (cần cho code editor)
2. Grep kiểm tra còn `var(--mono)` sót không:
   ```powershell
   grep -r "var(--mono)" frontend/src
   ```
3. Nếu sạch → xóa dòng alias `--mono: var(--font-mono)` trong `global.css`
4. Chạy `npm run dev` và kiểm tra UI đảm bảo font hiển thị đúng

---

## Thứ tự thực hiện

```
#2 → #3 (rename biến, an toàn, không phụ thuộc) → #1 (init shadcn) → #4 (verify + dọn)
```
