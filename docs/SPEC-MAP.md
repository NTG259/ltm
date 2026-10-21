# Capability Map: LMS Học Code

Phát triển CodeJudge thành LMS học C++ theo mô hình W3Schools.  
Mỗi module được spec, plan, và implement riêng theo thứ tự build order bên dưới.

| Module id    | Trách nhiệm                                             | Phụ thuộc         |
|--------------|---------------------------------------------------------|-------------------|
| `curriculum` | Admin tạo/quản lý lộ trình, chủ đề, thứ tự             | —                 |
| `lesson`     | Nội dung lý thuyết (markdown) cho từng chủ đề           | curriculum        |
| `tryit`      | Chạy code ví dụ trên trình duyệt (reuse judge worker)  | lesson, judge     |
| `graded`     | Bài tập thật submit vào judge, lưu verdict              | curriculum, judge |

**Out of scope v1:** `progress` (theo dõi tiến độ sinh viên), điểm danh vật lý

**Build order (LMS):** `curriculum` → `lesson`, `graded` → `tryit`  
**Build order (Classroom):** `classroom` → `monitor`

## Specs

- [SPEC-curriculum.md](SPEC-curriculum.md)
- SPEC-lesson.md _(chưa viết)_
- SPEC-tryit.md _(chưa viết)_
- SPEC-graded.md _(chưa viết)_
- [SPEC-classroom.md](SPEC-classroom.md)
- [SPEC-monitor.md](SPEC-monitor.md)
