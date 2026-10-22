-- ============================================================
-- V8: Quản lý khóa học và lộ trình học C++ (Curriculum)
-- ============================================================

CREATE TABLE IF NOT EXISTS courses (
    id           BIGSERIAL PRIMARY KEY,
    title        VARCHAR(255) NOT NULL,
    description  TEXT,
    is_published BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS course_units (
    id          BIGSERIAL PRIMARY KEY,
    course_id   BIGINT       NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    title       VARCHAR(255) NOT NULL,
    order_index INT          NOT NULL,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE (course_id, order_index)
);

CREATE INDEX IF NOT EXISTS ix_course_units_course ON course_units(course_id, order_index);

-- Dữ liệu mẫu ban đầu
INSERT INTO courses (id, title, description, is_published, created_at) VALUES
(1, 'Lập trình C++ Cơ bản (C++ Fundamentals)', 'Lộ trình nhập môn toàn diện: cú pháp, biến, điều kiện, vòng lặp, hàm và mảng.', true, NOW() - INTERVAL '5 days'),
(2, 'Cấu trúc Dữ liệu & Giải thuật C++ (DSA)', 'Thư viện STL nâng cao (Vector, Map, Set), ngăn xếp, hàng đợi, đệ quy và quy hoạch động.', true, NOW() - INTERVAL '3 days'),
(3, 'Lập trình Hướng đối tượng C++ (OOP)', 'Nắm vững 4 tính chất OOP: Đóng gói, Kế thừa, Đa hình và Trừu tượng hóa.', true, NOW() - INTERVAL '1 days'),
(4, 'Kỹ thuật Lập trình C++ Nâng cao (Bản nháp)', 'Quản lý con trỏ thông minh (Smart Pointers), Move Semantics và Concurrency đa luồng.', false, NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO course_units (course_id, title, order_index, created_at) VALUES
-- Khóa 1
(1, 'Chủ đề 1: Cấu trúc chương trình C++ và Nhập xuất (cin / cout)', 1, NOW()),
(1, 'Chủ đề 2: Biến, Kiểu dữ liệu nguyên thủy và Ép kiểu', 2, NOW()),
(1, 'Chủ đề 3: Các phép toán số học, logic và bitwise', 3, NOW()),
(1, 'Chủ đề 4: Cấu trúc rẽ nhánh if - else và switch - case', 4, NOW()),
(1, 'Chủ đề 5: Vòng lặp for, while, do-while và lệnh break / continue', 5, NOW()),
(1, 'Chủ đề 6: Hàm, truyền tham trị và truyền tham chiếu (&)', 6, NOW()),
(1, 'Chủ đề 7: Mảng 1 chiều và chuỗi ký tự cơ bản (std::string)', 7, NOW()),

-- Khóa 2
(2, 'Chủ đề 1: Thư viện chuẩn STL: std::vector và std::pair', 1, NOW()),
(2, 'Chủ đề 2: Ngăn xếp (Stack) và Hàng đợi (Queue, Priority Queue)', 2, NOW()),
(2, 'Chủ đề 3: Tập hợp (std::set) và Bảng ánh xạ (std::map, unordered_map)', 3, NOW()),
(2, 'Chủ đề 4: Kỹ thuật đệ quy và Quay lui (Backtracking)', 4, NOW()),
(2, 'Chủ đề 5: Thuật toán sắp xếp và Tìm kiếm nhị phân (Binary Search)', 5, NOW()),
(2, 'Chủ đề 6: Quy hoạch động 1 chiều (1D Dynamic Programming)', 6, NOW()),

-- Khóa 3
(3, 'Chủ đề 1: Lớp (Class), Đối tượng (Object) và Phạm vi truy cập', 1, NOW()),
(3, 'Chủ đề 2: Hàm khởi tạo (Constructor) và Hàm hủy (Destructor)', 2, NOW()),
(3, 'Chủ đề 3: Tính đóng gói (Encapsulation) và Tính kế thừa (Inheritance)', 3, NOW()),
(3, 'Chủ đề 4: Tính đa hình (Polymorphism) và Hàm ảo (Virtual Functions)', 4, NOW()),
(3, 'Chủ đề 5: Nạp chồng toán tử (Operator Overloading)', 5, NOW()),

-- Khóa 4
(4, 'Chủ đề 1: Con trỏ thô (Raw Pointers) và Vùng nhớ Heap', 1, NOW()),
(4, 'Chủ đề 2: Smart Pointers (unique_ptr, shared_ptr, weak_ptr)', 2, NOW())
ON CONFLICT (course_id, order_index) DO NOTHING;

SELECT setval('courses_id_seq', (SELECT COALESCE(MAX(id), 1) FROM courses));
