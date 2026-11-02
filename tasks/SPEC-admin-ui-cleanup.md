# Spec: Admin UI Cleanup — Remove Subtitles, Move Action Buttons, Constrain Table Height

## Objective

Clean up the admin list pages to maximize table visibility:
1. Remove the description/subtitle line under each page title
2. Move primary action buttons (Add/Create) from the page header into the card table toolbar
3. Constrain the table card height to 2/3 of the viewport height (66vh)

## Affected Files

All 5 admin list pages (same pattern applies to each):

| File | Description prop text | Actions to move |
|---|---|---|
| `frontend/src/pages/admin/AdminProblemsPage.jsx` | "Quản lý nội dung, giới hạn chạy, testcase…" | `<Button>Thêm đề bài</Button>` |
| `frontend/src/pages/admin/AdminContestsPage.jsx` | Conditional teacher/admin description string | `<Button>Tạo kỳ thi</Button>` |
| `frontend/src/pages/admin/AdminClassroomsPage.jsx` | "Tạo lớp học, phân công giảng viên…" | `<Button>Tạo lớp</Button>` |
| `frontend/src/pages/admin/AdminCoursesPage.jsx` | "Xây dựng lộ trình học tập…" | `<Tabs>` filter + `<Button>Tạo khóa học</Button>` |
| `frontend/src/pages/admin/AdminLecturersPage.jsx` | "Tạo tài khoản, theo dõi lớp phụ trách…" | hidden `<input type="file">` + `<Button>Import CSV</Button>` + `<Button>Thêm giảng viên</Button>` |

## Change 1 — Remove description from AdminPageHeader

In each file, remove **only** the `description` prop from `<AdminPageHeader>`. Leave `eyebrow`, `title`, and `actions` untouched for now (actions will be removed in Change 2).

**Component signature** (`frontend/src/components/admin/AdminPageHeader.jsx`):
```jsx
export default function AdminPageHeader({ title, description, eyebrow, icon, actions })
```
The `{description && <p>{description}</p>}` line inside the component itself does NOT need to be removed — removing the prop is enough.

## Change 2 — Move action buttons into the card toolbar

Each page has a Card with a toolbar div at the top:
```jsx
<Card className="flex-1 min-h-0 flex flex-col overflow-hidden">
  <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium">...</p>
      <p className="text-xs text-muted-foreground">...</p>
    </div>
    {/* search/filter controls go here */}
  </div>
  ...
```

Move the button(s) from `AdminPageHeader`'s `actions` prop **into** this toolbar div, after the search/filter controls. Also remove the now-empty `actions` prop from `AdminPageHeader`.

### Per-page toolbar target

**AdminProblemsPage** — toolbar already has a `<div className="flex flex-wrap items-center gap-2">` containing search + 2 selects. Append the button inside that div:
```jsx
<Button onClick={() => setEditing({})}>
  <Plus data-icon="inline-start" />
  Thêm đề bài
</Button>
```

**AdminContestsPage** — toolbar currently has `<InputGroup>` directly (no wrapper div). Wrap search + button in `<div className="flex flex-wrap items-center gap-2">`:
```jsx
<div className="flex flex-wrap items-center gap-2">
  <InputGroup className="w-full sm:w-64">...</InputGroup>
  <Button onClick={() => setEditing({})}>
    <Plus data-icon="inline-start" />
    Tạo kỳ thi
  </Button>
</div>
```

**AdminClassroomsPage** — same pattern as AdminContestsPage (direct `<InputGroup>`, needs wrapping):
```jsx
<div className="flex flex-wrap items-center gap-2">
  <InputGroup className="w-full sm:w-64">...</InputGroup>
  <Button onClick={openCreate}>
    <Plus data-icon="inline-start" />
    Tạo lớp
  </Button>
</div>
```

**AdminCoursesPage** — same, direct `<InputGroup>`. Wrap and prepend the Tabs filter (only shown when `teacher`):
```jsx
<div className="flex flex-wrap items-center gap-2">
  {teacher && (
    <Tabs value={filterMode} onValueChange={setFilterMode}>
      <TabsList>
        <TabsTrigger value="my">Của tôi</TabsTrigger>
        <TabsTrigger value="all">Tất cả</TabsTrigger>
      </TabsList>
    </Tabs>
  )}
  <InputGroup className="w-full sm:w-64">...</InputGroup>
  <Button onClick={openCreate}>
    <Plus data-icon="inline-start" />
    Tạo khóa học
  </Button>
</div>
```

**AdminLecturersPage** — toolbar already has `<div className="flex flex-wrap items-center gap-2">` with selectedIds delete button + search. Prepend the hidden file input and both buttons at the start of that div (before the selectedIds conditional):
```jsx
<input
  ref={fileInputRef}
  className="sr-only"
  type="file"
  accept=".csv,text/csv"
  onChange={importCsv}
  aria-label="Chọn file CSV giảng viên"
/>
<Button variant="outline" disabled={importing} onClick={() => fileInputRef.current?.click()}>
  {importing ? <Spinner data-icon="inline-start" /> : <FileUp data-icon="inline-start" />}
  Import CSV
</Button>
<Button onClick={() => {
  setCreateForm(EMPTY_FORM)
  setCreateErrors({})
  setCreateOpen(true)
}}>
  <Plus data-icon="inline-start" />
  Thêm giảng viên
</Button>
{selectedIds.length > 0 && (...existing delete button...)}
```

## Change 3 — Constrain card height to 2/3 viewport

Replace `flex-1` on each Card with a fixed height class so the card never exceeds 2/3 of the screen height. The card already scrolls internally (`overflow-y-auto` on CardContent), so it will show a scrollbar when content overflows.

Change on each of the 5 files:
```jsx
// Before
<Card className="flex-1 min-h-0 flex flex-col overflow-hidden">

// After
<Card className="h-[66vh] min-h-0 flex flex-col overflow-hidden">
```

> **Why `h-[66vh]` not `max-h-[66vh]`**: the card should always sit at 2/3 height, not grow to fill if content is less. `flex-1` is removed because it expands to fill remaining space, which is the behavior we want to constrain.

## What NOT to change

- `AdminDashboardPage.jsx` — no description, keep as-is
- `AdminOverviewPage.jsx` — no description, keep as-is
- `AdminContestMonitorPage.jsx`, `AdminClassroomMonitorPage.jsx` — monitor pages, not list pages, skip
- `AdminCourseEditPage.jsx` — edit page, not a list, skip
- The `AdminPageHeader` component itself (`AdminPageHeader.jsx`) — do NOT modify it
- The `<div className="stat-metrics">` block above the Card — keep it untouched. This is the summary stats row (counts of total/active/etc.) and must remain visible above the table.

## Pre-requisite: shadcn migration

Some pages (AdminProblemsPage, AdminClassroomsPage, AdminCoursesPage, AdminLecturersPage) still use legacy Ant Design components (`import ... from 'antd'`). These must be migrated to shadcn/ui components **before** applying the 3 cleanup changes. AdminContestsPage was already on shadcn and can be updated directly.

Migration means replacing:
- `antd` Button/Input/Select/Table/Modal/Form → shadcn equivalents in `../../components/ui/`
- `@ant-design/icons` → lucide-react icons
- Ant Design Form (`Form.useForm()`, `Form.Item`) → controlled state + shadcn `Field`/`Input`
- Ant Design Modal/Drawer → shadcn `Dialog`/`Sheet`

## Verification

After making changes, run:
```powershell
cd frontend; npm run lint
```
Expected: no new lint errors introduced. The 4 pre-existing errors in other files (CourseLearnPage, ContestExamPage) are unrelated and can be ignored.

Check that no import becomes unused:
- `AdminCoursesPage`: `Tabs`, `TabsList`, `TabsTrigger` still used in card toolbar
- `AdminLecturersPage`: `FileUp`, `Spinner` still used in card toolbar
- `AdminProblemsPage`: `Plus` still used in card toolbar

## Success Criteria

- [ ] No `description` prop passed to `AdminPageHeader` in any of the 5 files
- [ ] Primary action buttons appear in the table card toolbar (right side, after search/filter)
- [ ] All 5 cards have `h-[66vh]` (not `flex-1`)
- [ ] `npm run lint` produces no new errors
- [ ] Existing empty-state buttons inside cards (e.g. "Tạo kỳ thi đầu tiên") are left untouched
