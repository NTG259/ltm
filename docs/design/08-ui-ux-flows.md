# UI/UX Flows — CodeJudge

> Mô tả tất cả màn hình, luồng điều hướng, input/output cho từng vai trò người dùng.  
> Mục tiêu: dùng làm tài liệu tham chiếu để tối ưu lại UX, giảm rối cho người dùng.

---

## 1. Đăng nhập (Chung)

**URL:** `/login`  
**Layout:** Full-page frosted-glass card, nền animated gradient (orb + grid).

### Input
| Trường | Loại | Ghi chú |
|---|---|---|
| Tài khoản | Text | MSSV hoặc tên tài khoản, trim tự động |
| Mật khẩu | Password | `autoComplete="current-password"` |

### Action
- **Đăng nhập** (submit): gọi `login()` → redirect theo role:
  - `admin` → `/admin/overview`
  - `lecturer` → `/teacher/classrooms`
  - `student` → `/problems`
- **Toggle Dark/Light** (top-right): đổi theme, lưu vào `localStorage`

### Output / State
- Loading spinner trên nút khi đang xử lý
- `message.success` khi thành công: "Xin chào, {tên}"
- `message.error` khi thất bại: hiển thị lỗi từ API
- Chip trạng thái server: "X sinh viên online" (fetch realtime)

### Pain points
- Không có "Quên mật khẩu" — sinh viên phải nhờ giảng viên reset
- Không phân biệt rõ placeholder giữa MSSV và tên admin → dễ nhầm

---

## 2. Sinh viên (Student)

### Navigation (Header sticky)
| Menu | Icon | Route |
|---|---|---|
| Bài tập | CodeOutlined | `/problems` |
| Khóa học | BookOutlined | `/courses` |
| Kỳ thi | FlagOutlined | `/contests` |
| Bài nộp | OrderedListOutlined | `/submissions` |
| Lớp học | TeamOutlined | `/my-classrooms` |
| Xếp hạng | TrophyOutlined | `/leaderboard` |

Header còn có: toggle dark/light, dropdown tài khoản (Đổi mật khẩu, Đăng xuất).

---

### 2.1 Danh sách đề bài — `/problems`

**Hiển thị:** Bảng danh sách bài tập, tiêu đề "Kho bài tập".

**Bộ lọc / Tìm kiếm:**
- Input tìm kiếm (debounce 300ms): theo tên hoặc mã bài (`#1`)
- Segmented: Tất cả / Dễ / Trung bình / Khó
- Select dropdown: Chủ đề (tag), lấy từ danh sách bài hiện tại

**Bảng:**
| Cột | Nội dung |
|---|---|
| Mã | `#id` monospace |
| Bài tập | Tên bài + tags, màu xanh nếu đã AC, đỏ nếu đã nộp WA |
| Giới hạn | `Xs · YMB` |
| Tỉ lệ AC | Progress bar (xanh ≥50%, vàng ≥25%, đỏ <25%) |
| Độ khó | Pill Dễ/Trung bình/Khó |
| — | Nút "Làm bài" / "Làm tiếp" / "Đã giải" |

**Action:**
- Click tên bài → `/problems/:id`
- Double-click hàng → `/problems/:id`
- Nút "Làm bài / Làm tiếp / Đã giải" → `/problems/:id`
- Phân trang: 20 bài/trang

**Output:**
- Badge "Đã giải X/Total" + progress bar nhỏ ở header
- Loading: spinner trên bảng
- Empty: bảng trống khi không có kết quả

**Điều hướng đến:** WorkspacePage

---

### 2.2 Workspace (Làm bài) — `/problems/:id`

**Hiển thị:** Layout split panel — trái: đề bài + lịch sử, phải: code editor.

**Input:**
- Monaco Code Editor (C++, starter code mặc định)
- Upload file `.cpp` (drag-drop hoặc chọn file)
- Dropdown chọn ngôn ngữ (nếu có nhiều ngôn ngữ)

**Action:**
- **Nộp bài** (Run/Submit): gửi code, nhận kết quả realtime qua WebSocket
- **Copy code**: sao chép toàn bộ code
- **Upload file**: tải code từ file `.cpp`
- **Xem lịch sử nộp**: danh sách submissions cá nhân cho bài này
- **Back**: quay về danh sách bài (`/problems`)

**Output:**
- Kết quả chấm: Verdict tag (AC/WA/TLE/MLE/RTE/CE/SEC)
- Điểm, thời gian, memory
- TestResults: bảng kết quả từng test case
- CompilerErrorExplainer: phân tích lỗi compile (CE)
- Proctor: theo dõi tab switching nếu trong contest

**Điều hướng đến:** Quay lại `/problems` (breadcrumb/back button)

---

### 2.3 Kỳ thi — `/contests`

**Hiển thị:** Grid card 2 cột (responsive), tiêu đề "Kỳ thi".

**Bộ lọc:**
- Segmented: "Đang & sắp diễn ra" / "Đã kết thúc"

**Card kỳ thi:**
- Tag trạng thái: RUNNING (xanh) / UPCOMING (xanh dương) / ENDED (xám)
- Tag "Đã đăng ký" nếu có
- Tên kỳ thi, ngày bắt đầu, thời lượng, số thí sinh
- Đồng hồ đếm ngược (ContestClock) nếu chưa kết thúc

**Action theo trạng thái:**
| Trạng thái | Chưa đăng ký | Đã đăng ký |
|---|---|---|
| UPCOMING | Nút "Đăng ký" | Nút "Xem thể lệ" |
| RUNNING | Nút "Đăng ký & vào thi" | Nút "Vào thi" (primary) |
| ENDED | Nút "Xem kết quả" | Nút "Xem kết quả" |

- Click card hoặc nút → `/contests/:id`
- Đăng ký thành công + kỳ thi đang chạy → tự redirect `/contests/:id`

**Output:**
- Loading: Spin
- Empty: thông báo chưa có kỳ thi
- Realtime update qua WebSocket `CONTEST_UPDATE`

**Điều hướng đến:** ContestDetailPage

---

### 2.4 Chi tiết kỳ thi — `/contests/:id`

**Hiển thị:** Tabs — Đề bài, Bảng xếp hạng, (Admin: Gian lận).

**Tab Đề bài:**
- UPCOMING: thông báo "Đề bài sẽ hiện khi thi bắt đầu" (lock icon)
- RUNNING / ENDED: bảng danh sách bài (label A/B/C…, tên, giới hạn, tỉ lệ giải)
- Icon check (AC) / warning (đã nộp WA) trên từng bài

**Action:**
- Click bài → `/contests/:cid/problems/:label` (nếu đang thi)
- ENDED → redirect về `/problems/:id` (xem bài thường)
- Nút "Vào thi" / "Đăng ký & vào thi"
- ContestClock: đồng hồ đếm ngược realtime

**Tab Bảng xếp hạng:** ContestStandings — bảng điểm ICPC realtime.

**Output:**
- Trạng thái đăng ký của bản thân
- Breadcrumb: Kỳ thi > Tên kỳ thi
- Proctor: ContestProctoring khi đang thi (phát hiện chuyển tab)

**Điều hướng đến:** ContestWorkspacePage, `/contests`

---

### 2.5 Workspace trong kỳ thi — `/contests/:cid/problems/:label`

Tương tự WorkspacePage nhưng:
- Có ContestClock cố định trên cùng
- Proctor bật (ghi violation khi chuyển tab)
- Back về `/contests/:id` (không phải `/problems`)

---

### 2.6 Khóa học — `/courses`

**Hiển thị:** Grid card 3 cột (responsive), tiêu đề "Khóa học".

**Card:**
- Tên khóa học, mô tả (3 dòng ellipsis), số chủ đề
- Badge "Bản nháp" nếu chưa published (chỉ admin thấy)

**Action:**
- Nút "Xem khóa học" → `/courses/:id`
- Sinh viên chỉ thấy khóa học `published = true`

**Output:**
- Loading: Card skeleton
- Empty: thông báo chưa có khóa học

**Điều hướng đến:** CourseDetailPage

---

### 2.7 Chi tiết khóa học — `/courses/:id`

**Hiển thị:** Thông tin khóa học, danh sách chủ đề (units), tiến độ.

**Action:**
- Nút "Bắt đầu học" / "Tiếp tục học" → `/courses/:courseId/learn`
- Click chủ đề → `/courses/:courseId/learn/:unitId`

---

### 2.8 Trang học — `/courses/:courseId/learn` hoặc `/learn/:unitId`

**Hiển thị:** Layout 2 cột — sidebar trái (danh sách chủ đề), nội dung phải.

**Sidebar:**
- Danh sách units với trạng thái: hoàn thành (check xanh) / đang làm / chưa làm
- Nút thu/mở sidebar (MenuFoldOutlined)
- Progress bar tổng tiến độ

**Nội dung:**
- Tab "Bài giảng": MarkdownViewer hiển thị lý thuyết + sample code
- Tab "Bài tập": danh sách problems liên kết (solved/tried/chưa làm), mini CodeEditor
- Tab "Tài liệu": file PDF/tài liệu đính kèm (download)

**Action:**
- Nút Prev/Next để chuyển unit
- "Đánh dấu hoàn thành" → cập nhật tiến độ
- Click bài tập → mở mini workspace hoặc `/problems/:id`
- Download tài liệu PDF

---

### 2.9 Bài nộp — `/submissions`

**Hiển thị:** Bảng lịch sử nộp bài cá nhân.

**Bộ lọc:**
- Input tìm theo tên/MSSV sinh viên (debounce)
- Select verdict: Tất cả / Đang chờ / AC / WA / TLE / MLE / RTE / CE / SEC
- Select problem ID

**Bảng:** Thời gian, Bài, Verdict (tag màu), Điểm, Thời gian chạy, Bộ nhớ

**Action:**
- Click hàng → `/submissions/:id`
- Realtime: WebSocket cập nhật verdict đang chấm
- Phân trang: 50 bài/trang

---

### 2.10 Chi tiết bài nộp — `/submissions/:id`

**Hiển thị:** Thông tin nộp bài đầy đủ.

**Output:**
- Verdict, điểm, thời gian, bộ nhớ
- Source code (syntax highlight)
- TestResults: bảng kết quả từng test (pass/fail, time, memory)
- Compile log nếu CE

---

### 2.11 Lớp học của tôi — `/my-classrooms`

**Hiển thị:** Bảng danh sách lớp học đã tham gia.

**Cột:** Tên lớp (link), Kỳ học (tag), Ngày tạo, Nút "Vào lớp học"

**Output:**
- Empty: "Bạn chưa có lớp học. Liên hệ giảng viên để được thêm vào lớp."
- Loading: bảng skeleton

**Điều hướng đến:** `/classrooms/:id`

---

### 2.12 Chi tiết lớp học — `/classrooms/:id`

**Hiển thị:** Hero card (tên lớp, mô tả, tiến độ), Tabs 2 tab.

**Tab Nội dung học tập:**
- Danh sách units theo khóa học của lớp
- Progress bar tổng % hoàn thành
- Nút "Tiếp tục học" (unit chưa hoàn thành tiếp theo)
- Icon check xanh cho unit đã hoàn thành

**Tab Kỳ thi của lớp:**
- Danh sách kỳ thi được gán cho lớp
- Tag trạng thái, link vào thi

**Action:**
- Nút "Tiếp tục học" → `/courses/:courseId/learn/:unitId`
- Back → `/my-classrooms`

---

### 2.13 Xếp hạng — `/leaderboard`

**Hiển thị:** Bảng xếp hạng toàn hệ thống.

**Output:** Hạng, MSSV, Tên, Số bài AC, Tổng điểm

---

## 3. Admin

### Navigation (Sidebar trái, cố định)

**Nhóm Vận hành:**
| Menu | Route |
|---|---|
| Tổng quan | `/admin/overview` |
| Giám sát máy chấm | `/admin` |
| Bài nộp | `/admin/submissions` |

**Nhóm Quản trị:**
| Menu | Route |
|---|---|
| Giảng viên | `/admin/lecturers` |
| Đề bài | `/admin/problems` |
| Kỳ thi | `/admin/contests` |
| Khóa học | `/admin/courses` |
| Lớp học | `/admin/classrooms` |
| Xếp hạng | `/admin/leaderboard` |

Header: trạng thái WebSocket, số người online, toggle dark/light, dropdown tài khoản.  
Footer sidebar: badge kết nối realtime + số người online.

---

### 3.1 Tổng quan — `/admin/overview`

**Hiển thị:** Dashboard single-screen (không scroll), 2 section.

**Section "Vận hành hiện tại":**
| Card | Dữ liệu |
|---|---|
| Worker hoạt động | X/Y |
| Bài đang tồn đọng | N bài trong queue |
| Đang xử lý | N bài đang chấm |
| Tổng bài nộp | Tổng cộng |

- Realtime qua WebSocket `WORKER_UPDATE`
- Badge "Đã kết nối" / trạng thái WebSocket
- Link "Mở giám sát máy chấm" → `/admin`

**Section "Phân tích bài nộp":**
- Card "Hoạt động 7 ngày gần đây": bar chart số bài nộp theo ngày
- Card "Phân bố kết quả chấm": progress bar AC/WA/TLE/MLE/RTE/CE/MLE

**Action:**
- Nút "Cập nhật dữ liệu": reload API
- Link "Xem tất cả →" → `/admin/submissions`

---

### 3.2 Giám sát máy chấm — `/admin`

**Hiển thị:** Cluster summary + bảng worker + log realtime.

**Output:**
- ClusterSummary: tổng workers, alive/busy/dead
- MachineTable: bảng mỗi worker — ID, status, latency, pending tasks, uptime
- ConnectionLogPanel: log stream realtime (filter theo level)

**Action:**
- Nút START/STOP/RESTART cho từng worker
- Nút "Xóa worker đã ngắt" (xóa DEAD workers)
- Filter log theo level (INFO/WARN/ERROR)

---

### 3.3 Đề bài — `/admin/problems`

**Hiển thị:** Ngân hàng đề bài với CRUD đầy đủ.

**Bộ lọc:**
- Input tìm kiếm: tên, mã, tag (debounce)
- Select độ khó: Tất cả / Dễ / Trung bình / Khó
- Select trạng thái: Tất cả / Đang công khai / Đang ẩn

**Bảng:**
| Cột | Nội dung |
|---|---|
| Mã | #id |
| Tên bài | Tên + tags |
| Độ khó | Badge |
| Trạng thái | Switch công khai/ẩn (inline toggle) |
| Tỉ lệ AC | N AC / M tổng (%) |
| Thao tác | Xem, Sửa, Tải ZIP, Xóa |

**Action:**
- **Thêm đề bài** (+ Plus): mở Sheet (slide-in drawer) tạo mới
- **Sửa** (Edit3 icon): mở Sheet với data hiện tại
- **Toggle công khai** (Switch): toggle ngay không cần xác nhận
- **Tải ZIP**: tải testcase ZIP về máy
- **Xóa**: AlertDialog xác nhận trước khi xóa
- Click tên bài → `/admin/problems/:id` (WorkspacePage)

**Sheet (tạo/sửa đề bài):**
| Field | Loại |
|---|---|
| Tên bài | Text |
| Độ khó | Select (Dễ/Trung/Khó) |
| Giới hạn thời gian (ms) | Number |
| Giới hạn bộ nhớ (MB) | Number |
| Tags | Multi-select/input |
| Đề bài (Markdown) | Textarea |
| Test cases | Upload ZIP hoặc nhập tay |
| Công khai | Switch |

---

### 3.4 Kỳ thi — `/admin/contests`

**Hiển thị:** Danh sách kỳ thi với CRUD.

**Bộ lọc:** Input tìm kiếm

**Bảng:**
| Cột | Nội dung |
|---|---|
| Tên | Tên kỳ thi |
| Trạng thái | Badge UPCOMING/RUNNING/ENDED |
| Thời gian | Ngày bắt đầu + thời lượng |
| Thí sinh | Số người đăng ký |
| Thao tác | Xem, Sửa, Xóa |

**Action:**
- **Tạo kỳ thi** (+ Plus): mở Sheet
- **Sửa**: mở Sheet với data
- **Xóa**: AlertDialog xác nhận
- Click tên → `/admin/contests/:id` (ContestDetailPage — view của admin)

**Sheet (tạo/sửa kỳ thi):**
| Field | Loại |
|---|---|
| Tên kỳ thi | Text |
| Mô tả | Textarea |
| Thời gian bắt đầu | Datetime-local |
| Thời lượng (phút) | Number |
| Danh sách đề bài | Checkbox list (tìm kiếm) + sắp xếp thứ tự A/B/C/… |

**Chi tiết kỳ thi** (admin view tại `/admin/contests/:id`):
- Tab Đề bài: xem + click vào từng bài
- Tab Bảng xếp hạng: ContestStandings
- Tab Gian lận: ContestPlagiarism (chạy phát hiện, xem kết quả)
- Tab Giám sát: ContestProctoring (vi phạm realtime)

---

### 3.5 Khóa học — `/admin/courses`

**Hiển thị:** Danh sách khóa học với CRUD.

**Tabs:** Khóa học của tôi / Tất cả

**Bảng:**
| Cột | Nội dung |
|---|---|
| Tên | Tên khóa học |
| Trạng thái | Badge Published/Draft |
| Số chủ đề | N units |
| Thao tác | Sửa nội dung, Xóa |

**Action:**
- **Tạo khóa học**: Dialog (tên + mô tả + switch Published)
- **Sửa nội dung**: link → `/admin/courses/:id`
- **Xóa**: AlertDialog xác nhận

---

### 3.6 Chỉnh sửa khóa học — `/admin/courses/:id`

**Hiển thị:** Editor khóa học với quản lý units.

**Section Info:** Tên, mô tả, trạng thái published

**Bảng Units:** Danh sách chủ đề, kéo thả thứ tự (↑↓)

**Action:**
- **Thêm chủ đề**: Modal (tên unit, loại)
- **Sửa chủ đề**: mở Drawer soạn bài giảng
- **Xóa chủ đề**: Popconfirm

**Drawer soạn bài giảng (Lesson Editor):**
- Tab Lý thuyết: MarkdownViewer editor + preview
- Tab Bài tập: danh sách problems liên kết, thêm/xóa bài tập (select từ ngân hàng)
- Tab Tài liệu: upload PDF/file, danh sách file đã upload

---

### 3.7 Lớp học — `/admin/classrooms`

**Hiển thị:** Danh sách lớp học CRUD.

**Bộ lọc:** Input tìm kiếm

**Bảng:**
| Cột | Nội dung |
|---|---|
| Tên lớp | Link → detail |
| Kỳ học | Tag |
| Giảng viên | Tên giảng viên |
| Số SV | Badge |
| Thao tác | Sửa, Xóa |

**Action:**
- **Tạo lớp**: Dialog (tên, kỳ học, giảng viên phụ trách)
- **Sửa**: Dialog với data hiện tại
- **Xóa**: AlertDialog

---

### 3.8 Chi tiết lớp học — `/admin/classrooms/:id`

**Tabs:**

**Tab Sinh viên:**
- Bảng: MSSV, Tên, Ngày tham gia
- Action: Thêm sinh viên (nhập tay 1 SV hoặc nhập hàng loạt), Import CSV, Xóa SV, Reset mật khẩu

**Tab Kỳ thi:**
- Danh sách kỳ thi được gán
- Action: Gán kỳ thi mới (select từ danh sách), Gỡ kỳ thi, Link giám sát → `/admin/classrooms/:cid/contests/:kid/monitor`

**Tab Giảng viên:**
- Danh sách giảng viên phụ trách
- Action: Thêm giảng viên (modal), Gỡ giảng viên

---

### 3.9 Giám sát kỳ thi lớp học — `/admin/classrooms/:cid/contests/:kid/monitor`

**Hiển thị:** Bảng tiến độ realtime của tất cả sinh viên trong kỳ thi.

**Output:**
- Mỗi hàng: MSSV, Tên, Điểm, Bài đã giải (A✓ B✗...), Số lần nộp, Thời gian nộp cuối
- Realtime qua WebSocket

---

### 3.10 Giảng viên — `/admin/lecturers`

**Hiển thị:** Danh sách giảng viên CRUD.

**Bộ lọc:** Input tìm kiếm + phân trang 20/trang

**Bảng:**
| Cột | Nội dung |
|---|---|
| Mã GV | staffId |
| Tên | fullName |
| Thao tác | Reset mật khẩu, Xóa |

**Action:**
- **Tạo giảng viên**: Dialog (staffId, fullName, password + toggle show/hide)
- **Import CSV**: upload file danh sách giảng viên
- **Chọn nhiều**: checkbox → xóa hàng loạt
- **Reset mật khẩu**: Dialog nhập mật khẩu mới

---

### 3.11 Bài nộp (Admin) — `/admin/submissions`

Tương tự SubmissionsPage sinh viên nhưng:
- Xem được TẤT CẢ bài nộp của mọi sinh viên
- Bộ lọc thêm: MSSV, classroom
- Không giới hạn theo user

---

## 4. Giảng viên (Teacher/Lecturer)

### Navigation (Header sticky)

| Menu | Icon | Route |
|---|---|---|
| Lớp học | TeamOutlined | `/teacher/classrooms` |
| Khóa học | BookOutlined | `/teacher/courses` |
| Kho đề | DatabaseOutlined | `/teacher/problems` |
| Kỳ thi | FlagOutlined | `/teacher/contests` |
| Bài nộp | OrderedListOutlined | `/teacher/submissions` |
| Xếp hạng | TrophyOutlined | `/teacher/leaderboard` |

Header: toggle dark/light, dropdown tài khoản (Đổi mật khẩu, Đăng xuất).

---

### 4.1 Lớp học được phân công — `/teacher/classrooms`

**Hiển thị:** Bảng danh sách lớp học giảng viên được phân công.

**Bảng:** Tên lớp (link), Kỳ học (tag tím), Ngày tạo, Nút "Quản lý"

**Output:**
- Empty: "Bạn chưa được phân công lớp học nào. Hãy liên hệ admin."
- Không có chức năng tạo lớp (admin tạo, admin gán giảng viên)

**Điều hướng đến:** `/teacher/classrooms/:id`

---

### 4.2 Quản lý lớp học — `/teacher/classrooms/:id`

**Tabs:**

**Tab Sinh viên:**
- Bảng: MSSV, Tên, Ngày tham gia
- Action: Thêm SV (đơn lẻ: Form MSSV+tên / hàng loạt: paste text nhiều dòng), Import CSV (Ant Upload), Reset mật khẩu SV
- Export danh sách CSV

**Tab Kỳ thi:**
- Danh sách kỳ thi của lớp (trạng thái: sắp/đang/kết thúc)
- Action: Tạo kỳ thi mới (form trong modal), Giám sát → `/teacher/classrooms/:cid/contests/:kid/monitor`
- Bảng kết quả kỳ thi (bài nộp realtime)

**Tab Bài nộp:** Danh sách bài nộp của tất cả SV trong lớp, filter theo SV/verdict/bài

**Action chính:**
- Back → `/teacher/classrooms`

---

### 4.3 Kho đề (Teacher) — `/teacher/problems`

Dùng chung `AdminProblemsPage` với prop `teacher=true`.

Khác biệt:
- Không có nút xóa đề bài của người khác
- Tạo/sửa đề bài của mình: full quyền

---

### 4.4 Kỳ thi (Teacher) — `/teacher/contests`

Dùng chung `AdminContestsPage` với prop `teacher=true`.  
Giảng viên tạo và quản lý kỳ thi của mình.

---

### 4.5 Khóa học (Teacher) — `/teacher/courses`

Dùng chung `AdminCoursesPage` với prop `teacher=true`.

**Tabs:** Khóa học của tôi / Tất cả  
Giảng viên chỉ edit được khóa học của mình (`createdBy === user.id`).

---

### 4.6 Bài nộp (Teacher) — `/teacher/submissions`

Dùng chung `SubmissionsPage` với prop `teacher=true`.

Đặc điểm:
- Filter theo lớp học (dropdown lớp học của GV)
- Xem được bài nộp của tất cả SV trong lớp mình phụ trách

---

### 4.7 Giám sát kỳ thi — `/teacher/classrooms/:cid/contests/:kid/monitor`

Giống `/admin/classrooms/:cid/contests/:kid/monitor` nhưng cho giảng viên.  
Bảng realtime: điểm, bài giải, vi phạm proctoring của từng SV.

---

## 5. Luồng liên kết giữa các màn hình

```
Login
 ├─ admin  → /admin/overview → /admin (giám sát) → /admin/submissions
 │                           → /admin/problems  → /admin/problems/:id (Workspace)
 │                           → /admin/contests  → /admin/contests/:id
 │                           → /admin/classrooms → /admin/classrooms/:id
 │                                              → /admin/classrooms/:cid/contests/:kid/monitor
 │                           → /admin/courses   → /admin/courses/:id (editor)
 │                           → /admin/lecturers
 │
 ├─ lecturer → /teacher/classrooms → /teacher/classrooms/:id
 │                                 → /teacher/classrooms/:cid/contests/:kid/monitor
 │           → /teacher/problems → /teacher/problems/:id (Workspace)
 │           → /teacher/contests → /teacher/contests/:id
 │           → /teacher/courses → /teacher/courses/:id (editor)
 │           → /teacher/submissions
 │
 └─ student  → /problems → /problems/:id (Workspace)
             → /contests → /contests/:id → /contests/:cid/problems/:label (Workspace)
             → /courses  → /courses/:id → /courses/:courseId/learn/:unitId
             → /submissions → /submissions/:id
             → /my-classrooms → /classrooms/:id → /courses/:courseId/learn/:unitId
             → /leaderboard
```

### Điều hướng thông minh
- Admin/Lecturer mở link `/problems/:id` → tự redirect về `/admin/problems/:id` hoặc `/teacher/problems/:id`
- Truy cập URL của role khác → redirect về trang chủ của role mình

---

## 6. Vấn đề UX hiện tại & Đề xuất

### 6.1 Đăng nhập
| Pain point | Đề xuất |
|---|---|
| Không phân biệt rõ field tài khoản giữa MSSV (SV) và staffId (GV) / "admin" (Admin) | Thêm hint text hoặc placeholder cụ thể hơn |
| Không có chức năng "Quên mật khẩu" | Hiển thị hướng dẫn "Liên hệ giảng viên/admin để reset" |
| Không hiển thị role trên trang login | Có thể thêm radio/tab chọn role để giảm nhầm lẫn |

### 6.2 Sinh viên
| Pain point | Đề xuất |
|---|---|
| Trang `/my-classrooms` và `/classrooms/:id` bị tách rời khỏi flow chính | Gộp vào menu hoặc hiển thị thông báo khi có kỳ thi mới của lớp |
| Workspace không có autosave rõ ràng | Hiển thị trạng thái "Đã lưu nháp" thay vì chỉ dùng localStorage âm thầm |
| Khi nộp bài xong không có cách xem ngay lịch sử nộp từ Workspace | Thêm tab "Lịch sử nộp" ngay trong Workspace |
| Trang Khóa học dùng inline style riêng (`maxWidth: 1100px`) thay vì layout chung | Thống nhất layout |
| Không có thông báo khi kỳ thi sắp bắt đầu | Toast / badge notification trên menu Kỳ thi |

### 6.3 Admin
| Pain point | Đề xuất |
|---|---|
| Badge "Đã kết nối" nằm trơ ở góc phải section header, không rõ context | Gộp vào cluster status hoặc topbar |
| Stat cards hiện `2/2` (workers) khác format với các card khác (số thuần) | Thống nhất format: dùng suffix `/ total` trên tất cả hoặc không |
| Phân bố kết quả chấm không hiện tổng → không biết 38 AC là 38/50 hay 38/2785 | Thêm tổng số vào mỗi hàng: `38 / 50 (76%)` |
| Chart 7 ngày dùng bar thủ công không có scale rõ ràng → bar 16 trông gần bằng bar 33 | Dùng charting library (Recharts/Chart.js) hoặc normalize scale |
| AdminContestMonitorPage không có link ngắn từ danh sách kỳ thi | Thêm nút "Giám sát" trực tiếp trên bảng kỳ thi |

### 6.4 Giảng viên
| Pain point | Đề xuất |
|---|---|
| Giảng viên không tạo được lớp học → phụ thuộc hoàn toàn vào admin | Cân nhắc cho phép GV tự tạo lớp, admin duyệt |
| TeacherClassroomsPage dùng `maxWidth: 1000px` inline, lệch với layout hệ thống | Thống nhất dùng `.page` class |
| Flow thêm SV: chuyển qua Tab mới mỗi lần → mất context | Gộp sidebar danh sách SV + form thêm trong một view |
| Không có tổng kết nhanh lớp học (SV học được bao nhiêu %) ngay trên danh sách lớp | Thêm progress bar inline cho mỗi lớp trong bảng |

### 6.5 Chung
| Pain point | Đề xuất |
|---|---|
| Không có breadcrumb nhất quán cho admin pages | Thêm breadcrumb Admin > Lớp học > Tên lớp |
| Một số page admin dùng Ant Design, một số dùng shadcn/ui component → visual inconsistency | Thống nhất component library từng bước |
| Không có loading skeleton cho phần lớn pages cũ | Thêm skeleton state để tránh layout shift |
| Không có empty state illustration (chỉ có text) | Thêm minh họa cho empty state quan trọng |
| WebSocket disconnect không thông báo rõ ràng cho sinh viên | Toast "Mất kết nối, đang thử lại" với màu cảnh báo |
