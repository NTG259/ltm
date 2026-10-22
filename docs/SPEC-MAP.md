# Capability Map: LMS Học Code

Phát triển CodeJudge thành LMS học C++ theo mô hình W3Schools.  
Mỗi module được spec, plan, và implement riêng theo thứ tự build order bên dưới.

| Module id    | Trách nhiệm                                             | Phụ thuộc         | Trạng thái |
|--------------|---------------------------------------------------------|-------------------|------------|
| `curriculum` | Admin tạo/quản lý lộ trình, chủ đề, thứ tự             | —                 | **Đã hoàn thành** (V8, CourseController, UI) |
| `tryit`      | Chạy code ví dụ trên trình duyệt (reuse judge worker)  | judge             | **Đã hoàn thành** (/playground, CourseLearnPage Try-it) |
| `lesson`     | Nội dung lý thuyết (markdown) cho từng chủ đề           | curriculum        | **Đã hoàn thành** (V9, MarkdownViewer, Admin Editor, CourseLearnPage Workspace) |
| `graded`     | Bài tập thật submit vào judge, lưu verdict              | curriculum, judge | **Đã hoàn thành** (V10, CourseProgressService, CourseLearnPage Exercises) |

**Out of scope v1:** điểm danh vật lý

**Build order (LMS):** `curriculum` (✅) → `tryit` (✅) → `lesson` (✅) → `graded` (✅)  
**Build order (Classroom):** `classroom` (✅) → `monitor` (✅)

## Specs

- [SPEC-curriculum.md](SPEC-curriculum.md)
- [SPEC-tryit.md](SPEC-tryit.md)
- [SPEC-lesson.md](SPEC-lesson.md)
- [SPEC-graded.md](SPEC-graded.md)
- [SPEC-classroom.md](SPEC-classroom.md)
- [SPEC-monitor.md](SPEC-monitor.md)
