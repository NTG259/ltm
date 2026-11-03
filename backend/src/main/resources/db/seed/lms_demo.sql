-- Additive, repeatable LMS dataset for local/demo databases.
-- Run with psql -v ON_ERROR_STOP=1 -f /seed/lms_demo.sql.
\ir lms_demo_lessons.sql

BEGIN;

-- New exercise data; no existing problems or test cases are changed.
INSERT INTO problems (title, difficulty, tags, statement, input_spec, output_spec,
                      time_limit_ms, memory_limit_mb, created_by)
SELECT p.title, p.difficulty, p.tags, p.statement, p.input_spec, p.output_spec,
       1000, 256, (SELECT id FROM users WHERE username = 'admin')
FROM (VALUES
  ('LMS Demo: Sắp xếp cặp số', 'easy', ARRAY['STL','vector','pair']::text[],
   'Đọc n cặp số nguyên (x, y). Sắp xếp tăng theo x; nếu bằng nhau thì tăng theo y. In từng cặp trên một dòng.',
   'Dòng đầu là n (1 đến 1000). n dòng tiếp theo chứa hai số nguyên.',
   'In n dòng, mỗi dòng là một cặp đã sắp xếp.'),
  ('LMS Demo: Diện tích hình chữ nhật', 'easy', ARRAY['OOP','class']::text[],
   'Đọc chiều rộng và chiều cao. Tạo class Rectangle với dữ liệu private, constructor và hàm area(), rồi in diện tích.',
   'Một dòng chứa hai số nguyên dương w h (1 đến 10000).',
   'In một số nguyên là w nhân h.'),
  ('LMS Demo: Tăng giá trị qua con trỏ', 'easy', ARRAY['pointer','memory']::text[],
   'Đọc số nguyên n. Dùng con trỏ để tăng giá trị lên 1 rồi in kết quả.',
   'Một số nguyên n (-1000000 đến 1000000).',
   'In n + 1.')
) AS p(title, difficulty, tags, statement, input_spec, output_spec)
WHERE NOT EXISTS (SELECT 1 FROM problems existing WHERE existing.title = p.title);

INSERT INTO test_cases (problem_id, position, input, expected_output, is_sample)
SELECT p.id, t.position, t.input, t.expected_output, t.is_sample
FROM (VALUES
  ('LMS Demo: Sắp xếp cặp số', 1::smallint, '3 2 5 1 9 2 1' || chr(10), '1 9' || chr(10) || '2 1' || chr(10) || '2 5' || chr(10), true),
  ('LMS Demo: Sắp xếp cặp số', 2::smallint, '4 0 0 -2 8 0 -3 -2 1' || chr(10), '-2 1' || chr(10) || '-2 8' || chr(10) || '0 -3' || chr(10) || '0 0' || chr(10), false),
  ('LMS Demo: Diện tích hình chữ nhật', 1::smallint, '3 7' || chr(10), '21' || chr(10), true),
  ('LMS Demo: Diện tích hình chữ nhật', 2::smallint, '10000 10000' || chr(10), '100000000' || chr(10), false),
  ('LMS Demo: Tăng giá trị qua con trỏ', 1::smallint, '9' || chr(10), '10' || chr(10), true),
  ('LMS Demo: Tăng giá trị qua con trỏ', 2::smallint, '-1' || chr(10), '0' || chr(10), false)
) AS t(title, position, input, expected_output, is_sample)
JOIN problems p ON p.title = t.title
WHERE NOT EXISTS (SELECT 1 FROM test_cases existing
                  WHERE existing.problem_id = p.id AND existing.position = t.position);

INSERT INTO course_unit_problems (unit_id, problem_id, order_index)
SELECT u.id, p.id,
       COALESCE((SELECT max(cup.order_index) + 1 FROM course_unit_problems cup WHERE cup.unit_id = u.id), 1)
FROM (VALUES
  (2, 1, 'LMS Demo: Sắp xếp cặp số'),
  (3, 1, 'LMS Demo: Diện tích hình chữ nhật'),
  (4, 1, 'LMS Demo: Tăng giá trị qua con trỏ')
) AS link(course_id, order_index, problem_title)
JOIN course_units u ON u.course_id = link.course_id AND u.order_index = link.order_index
JOIN problems p ON p.title = link.problem_title
ON CONFLICT (unit_id, problem_id) DO NOTHING;

-- A classroom and three students let testers inspect not started, partial, and complete progress.
INSERT INTO users (username, full_name, role, password_hash)
SELECT demo.username, demo.full_name, 'STUDENT',
       '$2a$10$HEDAKlQqJpiB6BsR1w1Y2unKqDEKSM7Czn1eZZfvTUasGRZBVhtfO'
FROM (VALUES
  ('B26DCCN901', 'Học viên LMS - Chưa học'),
  ('B26DCCN902', 'Học viên LMS - Đang học'),
  ('B26DCCN903', 'Học viên LMS - Hoàn thành')
) AS demo(username, full_name)
WHERE NOT EXISTS (SELECT 1 FROM users existing WHERE existing.username = demo.username);

INSERT INTO classrooms (name, semester, created_by, lecturer_id)
SELECT 'LMS Demo - C++', 'DEMO-2026', admin.id, lecturer.id
FROM users admin
LEFT JOIN users lecturer ON lecturer.username = 'GV001'
WHERE admin.username = 'admin'
  AND NOT EXISTS (SELECT 1 FROM classrooms c WHERE c.name = 'LMS Demo - C++' AND c.semester = 'DEMO-2026');

INSERT INTO classroom_lecturers (classroom_id, user_id)
SELECT c.id, u.id
FROM classrooms c JOIN users u ON u.username = 'GV001'
WHERE c.name = 'LMS Demo - C++' AND c.semester = 'DEMO-2026'
ON CONFLICT DO NOTHING;

INSERT INTO classroom_students (classroom_id, user_id)
SELECT c.id, u.id
FROM classrooms c JOIN users u ON u.username IN ('B26DCCN901','B26DCCN902','B26DCCN903')
WHERE c.name = 'LMS Demo - C++' AND c.semester = 'DEMO-2026'
ON CONFLICT DO NOTHING;

INSERT INTO classroom_courses (classroom_id, course_id)
SELECT c.id, 1 FROM classrooms c
WHERE c.name = 'LMS Demo - C++' AND c.semester = 'DEMO-2026'
ON CONFLICT DO NOTHING;

INSERT INTO user_unit_progress (user_id, unit_id, completed, completed_at)
SELECT student.id, unit.id, true, now()
FROM users student
JOIN course_units unit ON unit.course_id = 1
WHERE (student.username = 'B26DCCN902' AND unit.order_index IN (1,2))
   OR (student.username = 'B26DCCN903')
ON CONFLICT (user_id, unit_id) DO NOTHING;

COMMIT;
