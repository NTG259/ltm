# Spec: tryit

## Objective

Cung cấp tính năng "Try it Yourself" (Trình chạy thử code C++ trực tuyến) theo phong cách W3Schools.
Người học có thể trực tiếp sửa mã nguồn ví dụ, cung cấp dữ liệu đầu vào tùy ý (stdin) và bấm "Chạy code (Run Code)" để xem kết quả xuất ra (stdout) tức thời mà không cần nộp bài chấm điểm chính thức.

**User stories:**
- Người học đọc bài lý thuyết, muốn chạy thử ngay đoạn code C++ mẫu mà không cần cài đặt Compiler trên máy.
- Người học tự sửa code (ví dụ đổi biến, thêm lệnh in) và kiểm tra xem chương trình chạy ra kết quả gì.
- Người học nhập input tùy ý để test hành vi của thuật toán.

**Out of scope:** Lưu lịch sử chạy vào cơ sở dữ liệu (để tránh rác DB), bảng xếp hạng.

## Tech Stack

- Backend: Tái sử dụng endpoint `/api/submissions/run` (`JudgeMasterService.runCustomTest`) giao bài trực tiếp cho Judge Worker qua TCP.
- Frontend: React 19, Monaco Editor (`@monaco-editor/react`), Ant Design 6.

## Endpoints

| Method | Path | Auth | Mô tả |
|--------|------|------|-------|
| `POST` | `/api/submissions/run` | Tùy chọn | Chạy code C++ với input tùy ý, trả về stdout, stderr, timeMs, memoryKb |

Payload:
```json
{
  "problemId": null,
  "sourceCode": "#include <iostream>\\n...",
  "input": "10 20",
  "expectedOutput": ""
}
```

Response:
```json
{
  "verdict": "AC",
  "timeMs": 15,
  "memoryKb": 2048,
  "output": "30\n",
  "stderr": "",
  "compileLog": null
}
```

## UI Components

1. `PlaygroundPage.jsx` (`/playground`):
   - Thanh chọn bài mẫu (Presets: Hello World, Nhập xuất I/O, Vòng lặp, Mảng STL).
   - Trình soạn thảo Monaco C++ với theme Dark/Light.
   - Khung nhập dữ liệu đầu vào (Custom Input).
   - Khung kết quả đầu ra (Console Terminal Output) với thời gian thực thi (ms) và bộ nhớ (KB).
2. Tích hợp trong `CourseDetailPage.jsx`:
   - Nút "Mở trong Trình chạy C++ (Try it Yourself)" để người học có thể chạy ngay code mẫu của chủ đề đang học.
