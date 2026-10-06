-- Dữ liệu ban đầu: 10 đề bài, test case mẫu, tài khoản mẫu và kỳ thi
ALTER TABLE submissions ALTER COLUMN id RESTART WITH 1001;

-- Quản trị viên: mật khẩu mặc định admin123 (bcrypt cost 10)
INSERT INTO users (id, username, full_name, role, password_hash) VALUES
    (1, 'admin', 'Quản trị viên', 'ADMIN', '$2a$10$HEDAKlQqJpiB6BsR1w1Y2unKqDEKSM7Czn1eZZfvTUasGRZBVhtfO')
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, username, full_name, role) VALUES
    (2, 'B20DCCN001', 'Nguyễn Văn An', 'STUDENT'),
    (3, 'B20DCCN014', 'Trần Thị Bình', 'STUDENT'),
    (4, 'B20DCCN027', 'Lê Hoàng Cường', 'STUDENT'),
    (5, 'B20DCCN033', 'Phạm Minh Dũng', 'STUDENT'),
    (6, 'B20DCCN048', 'Hoàng Thu Hà', 'STUDENT'),
    (7, 'B20DCCN052', 'Vũ Quốc Huy', 'STUDENT'),
    (8, 'B20DCCN069', 'Đỗ Khánh Linh', 'STUDENT'),
    (9, 'B20DCCN075', 'Bùi Đức Mạnh', 'STUDENT')
ON CONFLICT (id) DO NOTHING;

-- #1 A + B Problem
INSERT INTO problems (id, title, difficulty, tags, statement, input_spec, output_spec, time_limit_ms, memory_limit_mb, created_by)
VALUES (1, 'A + B Problem', 'easy', ARRAY['I/O cơ bản']::text[],
        'Cho hai số nguyên `a` và `b`. Hãy tính và in ra tổng `a + b`.

Đây là bài khởi động giúp thí sinh làm quen với cách đọc dữ liệu từ `stdin` và ghi kết quả ra `stdout`.',
        'Một dòng duy nhất chứa hai số nguyên `a`, `b` (|a|, |b| ≤ 10^9).',
        'In ra một số nguyên duy nhất là `a + b`.',
        1000, 256, 1)
ON CONFLICT (id) DO NOTHING;
INSERT INTO test_cases (problem_id, position, input, expected_output, is_sample) VALUES
    (1, 1, '3 5', '8', true),
    (1, 2, '-7 10', '3', true),
    (1, 3, '1000000000 1000000000', '2000000000', false),
    (1, 4, '0 0', '0', false);

-- #2 Dãy số Fibonacci Modulo 10^9+7
INSERT INTO problems (id, title, difficulty, tags, statement, input_spec, output_spec, time_limit_ms, memory_limit_mb, created_by)
VALUES (2, 'Dãy số Fibonacci Modulo 10^9+7', 'easy', ARRAY['Số học', 'Quy hoạch động']::text[],
        'Dãy Fibonacci được định nghĩa: `F(0) = 0`, `F(1) = 1`, `F(n) = F(n-1) + F(n-2)` với `n ≥ 2`.

Cho số nguyên `n`, hãy tính `F(n) mod (10^9 + 7)`.',
        'Một số nguyên `n` (0 ≤ n ≤ 10^6).',
        'In ra `F(n) mod (10^9 + 7)`.',
        1000, 256, 1)
ON CONFLICT (id) DO NOTHING;
INSERT INTO test_cases (problem_id, position, input, expected_output, is_sample) VALUES
    (2, 1, '10', '55', true),
    (2, 2, '1', '1', true),
    (2, 3, '50', '586268941', false),
    (2, 4, '1000000', '918091266', false);

-- #3 Kiểm tra số nguyên tố
INSERT INTO problems (id, title, difficulty, tags, statement, input_spec, output_spec, time_limit_ms, memory_limit_mb, created_by)
VALUES (3, 'Kiểm tra số nguyên tố', 'easy', ARRAY['Lý thuyết số']::text[],
        'Cho số nguyên dương `n`. Hãy kiểm tra `n` có phải là số nguyên tố hay không.

Lưu ý `n` có thể lớn tới `10^12`, cần thuật toán duyệt đến `√n`.',
        'Một số nguyên `n` (1 ≤ n ≤ 10^12).',
        'In `YES` nếu `n` là số nguyên tố, ngược lại in `NO`.',
        1000, 256, 1)
ON CONFLICT (id) DO NOTHING;
INSERT INTO test_cases (problem_id, position, input, expected_output, is_sample) VALUES
    (3, 1, '17', 'YES', true),
    (3, 2, '1', 'NO', true),
    (3, 3, '999999999989', 'YES', false),
    (3, 4, '1000000000000', 'NO', false),
    (3, 5, '2', 'YES', false);

-- #4 Tìm Min/Max & Đảo ngược mảng
INSERT INTO problems (id, title, difficulty, tags, statement, input_spec, output_spec, time_limit_ms, memory_limit_mb, created_by)
VALUES (4, 'Tìm Min/Max & Đảo ngược mảng', 'easy', ARRAY['Mảng']::text[],
        'Cho mảng gồm `n` số nguyên. Hãy in ra giá trị nhỏ nhất, giá trị lớn nhất và mảng sau khi đảo ngược.',
        'Dòng 1: số nguyên `n` (1 ≤ n ≤ 10^5).
Dòng 2: `n` số nguyên `a_i` (|a_i| ≤ 10^9).',
        'Dòng 1: `min max`.
Dòng 2: mảng đảo ngược.',
        1000, 256, 1)
ON CONFLICT (id) DO NOTHING;
INSERT INTO test_cases (problem_id, position, input, expected_output, is_sample) VALUES
    (4, 1, '5
3 1 4 1 5', '1 5
5 1 4 1 3', true),
    (4, 2, '1
42', '42 42
42', false),
    (4, 3, '4
-1 -2 -3 -4', '-4 -1
-4 -3 -2 -1', false);

-- #5 Chuỗi đối xứng Palindrome
INSERT INTO problems (id, title, difficulty, tags, statement, input_spec, output_spec, time_limit_ms, memory_limit_mb, created_by)
VALUES (5, 'Chuỗi đối xứng Palindrome', 'easy', ARRAY['Xâu']::text[],
        'Cho xâu `s` chỉ gồm chữ cái thường. Kiểm tra `s` có phải xâu đối xứng (palindrome) hay không.',
        'Một xâu `s` (1 ≤ |s| ≤ 10^6).',
        'In `YES` hoặc `NO`.',
        1000, 256, 1)
ON CONFLICT (id) DO NOTHING;
INSERT INTO test_cases (problem_id, position, input, expected_output, is_sample) VALUES
    (5, 1, 'abcba', 'YES', true),
    (5, 2, 'abca', 'NO', true),
    (5, 3, 'a', 'YES', false),
    (5, 4, 'abccba', 'YES', false);

-- #6 Sắp xếp dãy số
INSERT INTO problems (id, title, difficulty, tags, statement, input_spec, output_spec, time_limit_ms, memory_limit_mb, created_by)
VALUES (6, 'Sắp xếp dãy số', 'easy', ARRAY['Sắp xếp']::text[],
        'Cho dãy `n` số nguyên, hãy sắp xếp dãy theo thứ tự không giảm. Yêu cầu độ phức tạp `O(N log N)`.',
        'Dòng 1: `n` (1 ≤ n ≤ 2·10^5).
Dòng 2: `n` số nguyên.',
        'Dãy sau khi sắp xếp, các số cách nhau một dấu cách.',
        1000, 256, 1)
ON CONFLICT (id) DO NOTHING;
INSERT INTO test_cases (problem_id, position, input, expected_output, is_sample) VALUES
    (6, 1, '5
5 2 9 1 3', '1 2 3 5 9', true),
    (6, 2, '3
1 1 1', '1 1 1', false),
    (6, 3, '4
10 -5 0 7', '-5 0 7 10', false);

-- #7 Tìm kiếm nhị phân
INSERT INTO problems (id, title, difficulty, tags, statement, input_spec, output_spec, time_limit_ms, memory_limit_mb, created_by)
VALUES (7, 'Tìm kiếm nhị phân', 'medium', ARRAY['Tìm kiếm nhị phân']::text[],
        'Cho dãy `n` số nguyên đã sắp xếp tăng dần và `q` truy vấn. Mỗi truy vấn gồm số `x`, hãy in ra vị trí (đánh số từ 1) của `x` trong dãy, hoặc `-1` nếu không tồn tại. Yêu cầu `O(Q log N)`.',
        'Dòng 1: `n q` (1 ≤ n, q ≤ 2·10^5).
Dòng 2: dãy `a`.
`q` dòng tiếp theo: mỗi dòng một số `x`.',
        'In `q` dòng, mỗi dòng là kết quả truy vấn.',
        1000, 256, 1)
ON CONFLICT (id) DO NOTHING;
INSERT INTO test_cases (problem_id, position, input, expected_output, is_sample) VALUES
    (7, 1, '5 3
1 3 5 7 9
7
2
1', '4
-1
1', true),
    (7, 2, '1 1
5
5', '1', false),
    (7, 3, '3 2
2 4 6
6
7', '3
-1', false);

-- #8 Dãy con tăng dài nhất LIS
INSERT INTO problems (id, title, difficulty, tags, statement, input_spec, output_spec, time_limit_ms, memory_limit_mb, created_by)
VALUES (8, 'Dãy con tăng dài nhất LIS', 'medium', ARRAY['Quy hoạch động', 'Tìm kiếm nhị phân']::text[],
        'Cho dãy `n` số nguyên. Tìm độ dài dãy con tăng nghiêm ngặt dài nhất (không cần liên tiếp).',
        'Dòng 1: `n` (1 ≤ n ≤ 2·10^5).
Dòng 2: dãy `a`.',
        'Độ dài LIS.',
        1000, 256, 1)
ON CONFLICT (id) DO NOTHING;
INSERT INTO test_cases (problem_id, position, input, expected_output, is_sample) VALUES
    (8, 1, '8
10 9 2 5 3 7 101 18', '4', true),
    (8, 2, '5
5 4 3 2 1', '1', false),
    (8, 3, '6
1 2 3 4 5 6', '6', false);

-- #9 Bài toán cái túi 0/1 Knapsack
INSERT INTO problems (id, title, difficulty, tags, statement, input_spec, output_spec, time_limit_ms, memory_limit_mb, created_by)
VALUES (9, 'Bài toán cái túi 0/1 Knapsack', 'medium', ARRAY['Quy hoạch động']::text[],
        'Có `n` đồ vật, đồ vật thứ `i` có khối lượng `w_i` và giá trị `v_i`. Chọn một tập đồ vật có tổng khối lượng không vượt quá `W` sao cho tổng giá trị lớn nhất.',
        'Dòng 1: `n W` (1 ≤ n ≤ 100, 1 ≤ W ≤ 10^5).
`n` dòng tiếp: `w_i v_i`.',
        'Tổng giá trị lớn nhất.',
        1000, 256, 1)
ON CONFLICT (id) DO NOTHING;
INSERT INTO test_cases (problem_id, position, input, expected_output, is_sample) VALUES
    (9, 1, '3 8
3 30
4 50
5 60', '90', true),
    (9, 2, '1 1
2 100', '0', false),
    (9, 3, '4 10
5 10
4 40
6 30
3 50', '90', false);

-- #10 Cộng 2 số nguyên lớn BigInt
INSERT INTO problems (id, title, difficulty, tags, statement, input_spec, output_spec, time_limit_ms, memory_limit_mb, created_by)
VALUES (10, 'Cộng 2 số nguyên lớn BigInt', 'hard', ARRAY['Xâu', 'Số lớn']::text[],
        'Cho hai số nguyên không âm `a` và `b` có thể dài tới `10^5` chữ số. Hãy tính `a + b`.

Không thể dùng kiểu `long long`, cần cài đặt phép cộng trên xâu.',
        'Hai dòng, mỗi dòng một số nguyên không âm (không có số 0 thừa ở đầu).',
        'Tổng `a + b`.',
        1000, 256, 1)
ON CONFLICT (id) DO NOTHING;
INSERT INTO test_cases (problem_id, position, input, expected_output, is_sample) VALUES
    (10, 1, '99999999999999999999
1', '100000000000000000000', true),
    (10, 2, '0
0', '0', false),
    (10, 3, '123456789123456789
987654321987654321', '1111111111111111110', false);

-- Kỳ thi: một đã kết thúc, một đang diễn ra, một sắp tới
INSERT INTO contests (id, title, description, start_at, end_at, created_by)
VALUES (1, 'Kỳ thi thử Lập trình mạng – Vòng 1', 'Vòng làm quen với hệ thống chấm tự động. 4 bài cơ bản về I/O, số học và xâu.', now() - interval '26 hours', now() - interval '26 hours' + interval '120 minutes', 1)
ON CONFLICT (id) DO NOTHING;
INSERT INTO contest_problems (contest_id, problem_id, label) VALUES
    (1, 1, 'A'),
    (1, 3, 'B'),
    (1, 5, 'C'),
    (1, 6, 'D');
INSERT INTO contest_participants (contest_id, user_id, registered_at) VALUES
    (1, 2, now() - interval '26 hours' - interval '1 day'),
    (1, 3, now() - interval '26 hours' - interval '1 day'),
    (1, 4, now() - interval '26 hours' - interval '1 day'),
    (1, 5, now() - interval '26 hours' - interval '1 day'),
    (1, 6, now() - interval '26 hours' - interval '1 day'),
    (1, 7, now() - interval '26 hours' - interval '1 day'),
    (1, 8, now() - interval '26 hours' - interval '1 day'),
    (1, 9, now() - interval '26 hours' - interval '1 day');

INSERT INTO contests (id, title, description, start_at, end_at, created_by)
VALUES (2, 'Kỳ thi giữa kỳ – Thuật toán cơ bản', 'Kỳ thi giữa kỳ học phần. Thể thức ICPC: xếp hạng theo số bài đúng, sau đó theo tổng thời gian phạt.
Mỗi lần nộp sai (trừ lỗi biên dịch) trước khi AC bị cộng 20 phút phạt.', now() - interval '50 minutes', now() - interval '50 minutes' + interval '150 minutes', 1)
ON CONFLICT (id) DO NOTHING;
INSERT INTO contest_problems (contest_id, problem_id, label) VALUES
    (2, 2, 'A'),
    (2, 4, 'B'),
    (2, 7, 'C'),
    (2, 8, 'D'),
    (2, 9, 'E');
INSERT INTO contest_participants (contest_id, user_id, registered_at) VALUES
    (2, 2, now() - interval '50 minutes' - interval '1 day'),
    (2, 3, now() - interval '50 minutes' - interval '1 day'),
    (2, 4, now() - interval '50 minutes' - interval '1 day'),
    (2, 5, now() - interval '50 minutes' - interval '1 day'),
    (2, 6, now() - interval '50 minutes' - interval '1 day'),
    (2, 7, now() - interval '50 minutes' - interval '1 day');

INSERT INTO contests (id, title, description, start_at, end_at, created_by)
VALUES (3, 'Kỳ thi cuối kỳ – Quy hoạch động & Số lớn', 'Kỳ thi cuối kỳ gồm 4 bài. Đăng ký trước khi kỳ thi bắt đầu.', now() + interval '20 hours', now() + interval '20 hours' + interval '180 minutes', 1)
ON CONFLICT (id) DO NOTHING;
INSERT INTO contest_problems (contest_id, problem_id, label) VALUES
    (3, 8, 'A'),
    (3, 9, 'B'),
    (3, 10, 'C'),
    (3, 3, 'D');
INSERT INTO contest_participants (contest_id, user_id, registered_at) VALUES
    (3, 2, now() + interval '20 hours' - interval '1 day'),
    (3, 3, now() + interval '20 hours' - interval '1 day'),
    (3, 4, now() + interval '20 hours' - interval '1 day');

-- Đồng bộ lại các sequence sau khi chèn id cố định.
SELECT setval(pg_get_serial_sequence('users', 'id'), (SELECT max(id) FROM users));
SELECT setval(pg_get_serial_sequence('problems', 'id'), (SELECT max(id) FROM problems));
SELECT setval(pg_get_serial_sequence('contests', 'id'), (SELECT max(id) FROM contests));
