# Intent: Thiết kế lại luồng học bài của sinh viên

**Date:** 2026-11-02

## Confirmed Statement of Intent

- **Outcome:** Xóa cơ chế mở khóa tuần tự — sinh viên truy cập bất kỳ bài học nào trong khóa từ ngày đầu, không cần hoàn thành bài trước.
- **User:** Sinh viên (và giảng viên theo dõi tiến độ).
- **Why now:** Luồng hiện tại ép học theo thứ tự, gây bất tiện khi muốn ôn tập hoặc học không tuyến tính.
- **Success:** Một thanh tiến độ % duy nhất cho toàn khóa; `% = (số bài tập lập trình đạt AC) / (tổng số bài tập lập trình) × 100`; đạt AC hết = 100%.
- **Constraint:** Chỉ bài tập lập trình (problem) tính vào %; trọng số chia đều tự động; bài học lý thuyết không tính.
- **Out of scope:** Không có ngưỡng pass/fail; không có % riêng theo chương; không có trọng số tùy chỉnh theo bài.
