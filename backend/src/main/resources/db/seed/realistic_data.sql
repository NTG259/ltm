-- Bộ dữ liệu lớp học dùng cho môi trường demo. Tệp này được gọi sau demo_data.sql.
-- Mật khẩu chung cho toàn bộ tài khoản mẫu: admin123.
BEGIN;
SET TIME ZONE 'Asia/Ho_Chi_Minh';

-- Thay dữ liệu kỳ thi cơ sở bằng bộ dữ liệu lớp học đúng quy mô yêu cầu.
DELETE FROM contests;
DELETE FROM classrooms;
DELETE FROM courses;
DELETE FROM users WHERE role IN ('STUDENT', 'LECTURER');

SELECT setval(pg_get_serial_sequence('users', 'id'), greatest(coalesce(max(id), 1), 1)) FROM users;

CREATE TEMP TABLE demo_classes (
    class_no int PRIMARY KEY, class_name text NOT NULL, teacher_username text NOT NULL,
    teacher_name text NOT NULL, course_title text NOT NULL
) ON COMMIT DROP;
INSERT INTO demo_classes VALUES
    (1, 'C++ Cơ bản', 'GV001', 'Nguyễn Quang Minh', 'Nhập môn C++'),
    (2, 'Cấu trúc dữ liệu', 'GV002', 'Trần Ngọc Lan', 'Cấu trúc dữ liệu'),
    (3, 'Lập trình OOP', 'GV003', 'Lê Mạnh Hùng', 'Lập trình hướng đối tượng');

INSERT INTO users (username, full_name, role, password_hash, initial_password, created_at)
SELECT teacher_username, teacher_name, 'LECTURER',
       '$2a$10$HEDAKlQqJpiB6BsR1w1Y2unKqDEKSM7Czn1eZZfvTUasGRZBVhtfO',
       'admin123', now() - interval '60 days'
FROM demo_classes;

-- 180 sinh viên, chia liên tiếp 60 tài khoản cho mỗi lớp.
INSERT INTO users (username, full_name, role, password_hash, initial_password, created_at)
SELECT 'SV' || lpad(g::text, 3, '0'),
       (ARRAY['Nguyễn','Trần','Lê','Phạm','Hoàng','Vũ','Đặng','Bùi','Đỗ','Hồ','Ngô','Dương'])[(g - 1) % 12 + 1]
       || ' ' ||
       (ARRAY['Minh Anh','Quốc Bảo','Ngọc Chi','Tiến Dũng','Thu Hà','Gia Hân','Trung Hiếu','Quang Huy','Khánh Linh','Đức Long','Tuấn Minh','Thanh Nam','Bảo Ngọc','Hồng Nhung','Minh Phúc'])[((g - 1) / 12) % 15 + 1]
       || ' ' || lpad(g::text, 3, '0'),
       'STUDENT', '$2a$10$HEDAKlQqJpiB6BsR1w1Y2unKqDEKSM7Czn1eZZfvTUasGRZBVhtfO',
       'admin123', now() - interval '55 days' + g * interval '10 minutes'
FROM generate_series(1, 180) g;

INSERT INTO classrooms (name, semester, created_by, lecturer_id, created_at)
SELECT d.class_name, 'HK1/2026-2027', admin_user.id, lecturer.id, now() - interval '50 days'
FROM demo_classes d
JOIN users lecturer ON lecturer.username = d.teacher_username
JOIN users admin_user ON admin_user.username = 'admin';

INSERT INTO classroom_students (classroom_id, user_id, joined_at, imported_password)
SELECT c.id, u.id, now() - interval '45 days', 'admin123'
FROM demo_classes d
JOIN classrooms c ON c.name = d.class_name
JOIN users u ON u.username ~ '^SV[0-9]{3}$'
 AND substring(u.username from 3)::int BETWEEN 1 + (d.class_no - 1) * 60 AND d.class_no * 60;

INSERT INTO classroom_lecturers (classroom_id, user_id, assigned_at)
SELECT c.id, u.id, now() - interval '45 days'
FROM demo_classes d JOIN classrooms c ON c.name = d.class_name
JOIN users u ON u.username = d.teacher_username;

-- Mỗi lớp có một khóa học gồm đúng năm chương.
INSERT INTO courses (title, description, is_published, created_by, created_at)
SELECT d.course_title, 'Giáo trình mẫu của lớp ' || d.class_name || ', gồm 5 chương và tài liệu PDF.',
       true, u.id, now() - interval '40 days'
FROM demo_classes d JOIN users u ON u.username = d.teacher_username;

INSERT INTO classroom_courses (classroom_id, course_id, assigned_at)
SELECT cl.id, co.id, now() - interval '39 days'
FROM demo_classes d JOIN classrooms cl ON cl.name = d.class_name
JOIN courses co ON co.title = d.course_title;

CREATE TEMP TABLE demo_units (
    class_no int, order_index int, title text, problem_id bigint, file_key text, filename text,
    PRIMARY KEY (class_no, order_index)
) ON COMMIT DROP;
INSERT INTO demo_units VALUES
    (1,1,'Chương 1: Nhập xuất',1,'demo-class-1-chapter-1.pdf','01-nhap-xuat.pdf'),
    (1,2,'Chương 2: Biến và kiểu dữ liệu',4,'demo-class-1-chapter-2.pdf','02-bien-va-kieu-du-lieu.pdf'),
    (1,3,'Chương 3: Rẽ nhánh',3,'demo-class-1-chapter-3.pdf','03-re-nhanh.pdf'),
    (1,4,'Chương 4: Vòng lặp',6,'demo-class-1-chapter-4.pdf','04-vong-lap.pdf'),
    (1,5,'Chương 5: Hàm và mảng',7,'demo-class-1-chapter-5.pdf','05-ham-va-mang.pdf'),
    (2,1,'Chương 1: Vector và Pair',8,'demo-class-2-chapter-1.pdf','01-vector-va-pair.pdf'),
    (2,2,'Chương 2: Stack và Queue',9,'demo-class-2-chapter-2.pdf','02-stack-va-queue.pdf'),
    (2,3,'Chương 3: Set và Map',10,'demo-class-2-chapter-3.pdf','03-set-va-map.pdf'),
    (2,4,'Chương 4: Đệ quy',2,'demo-class-2-chapter-4.pdf','04-de-quy.pdf'),
    (2,5,'Chương 5: Sắp xếp',7,'demo-class-2-chapter-5.pdf','05-sap-xep.pdf'),
    (3,1,'Chương 1: Lớp và đối tượng',1,'demo-class-3-chapter-1.pdf','01-lop-va-doi-tuong.pdf'),
    (3,2,'Chương 2: Constructor',4,'demo-class-3-chapter-2.pdf','02-constructor.pdf'),
    (3,3,'Chương 3: Đóng gói',5,'demo-class-3-chapter-3.pdf','03-dong-goi.pdf'),
    (3,4,'Chương 4: Kế thừa',6,'demo-class-3-chapter-4.pdf','04-ke-thua.pdf'),
    (3,5,'Chương 5: Đa hình',8,'demo-class-3-chapter-5.pdf','05-da-hinh.pdf');

INSERT INTO course_units (course_id, title, order_index, created_at)
SELECT c.id, u.title, u.order_index, now() - interval '38 days'
FROM demo_units u JOIN demo_classes d ON d.class_no = u.class_no
JOIN courses c ON c.title = d.course_title;

INSERT INTO course_unit_problems (unit_id, problem_id, order_index)
SELECT cu.id, du.problem_id, 1
FROM demo_units du JOIN demo_classes d ON d.class_no = du.class_no
JOIN courses c ON c.title = d.course_title
JOIN course_units cu ON cu.course_id = c.id AND cu.order_index = du.order_index;

INSERT INTO course_unit_files
    (unit_id, filename, file_key, file_size, order_index, uploaded_at, content_type, status, uploaded_by)
SELECT cu.id, du.filename, du.file_key, NULL, 1, now() - interval '37 days',
       'application/pdf', 'READY', lecturer.id
FROM demo_units du JOIN demo_classes d ON d.class_no = du.class_no
JOIN courses c ON c.title = d.course_title
JOIN course_units cu ON cu.course_id = c.id AND cu.order_index = du.order_index
JOIN users lecturer ON lecturer.username = d.teacher_username;

-- Sáu kỳ thi: hai kỳ đã kết thúc có kết quả và bốn kỳ sắp diễn ra.
CREATE TEMP TABLE demo_contests (
    contest_no int PRIMARY KEY, class_no int, title text, start_at timestamptz,
    end_at timestamptz, is_finished boolean
) ON COMMIT DROP;
INSERT INTO demo_contests VALUES
    (1,1,'C++ - Giữa kỳ', now()-interval '21 days', now()-interval '21 days'+interval '120 minutes',true),
    (2,2,'CTDL - Giữa kỳ',now()-interval '14 days', now()-interval '14 days'+interval '120 minutes',true),
    (3,1,'C++ - Cuối kỳ', now()+interval '5 days', now()+interval '5 days 150 minutes',false),
    (4,2,'CTDL - Cuối kỳ',now()+interval '8 days', now()+interval '8 days 150 minutes',false),
    (5,3,'OOP - Giữa kỳ', now()+interval '12 days',now()+interval '12 days 120 minutes',false),
    (6,3,'OOP - Cuối kỳ', now()+interval '20 days',now()+interval '20 days 150 minutes',false);

INSERT INTO contests (title, description, start_at, end_at, created_by, created_at)
SELECT e.title, 'Kỳ thi mẫu của lớp ' || d.class_name || ', gồm 4 bài.',
       e.start_at, e.end_at, u.id, now() - interval '30 days'
FROM demo_contests e JOIN demo_classes d ON d.class_no = e.class_no
JOIN users u ON u.username = d.teacher_username;

INSERT INTO classroom_contests (classroom_id, contest_id, assigned_at)
SELECT cl.id, c.id, now() - interval '29 days'
FROM demo_contests e JOIN demo_classes d ON d.class_no = e.class_no
JOIN classrooms cl ON cl.name = d.class_name JOIN contests c ON c.title = e.title;

INSERT INTO contest_problems (contest_id, problem_id, label)
SELECT c.id, p.problem_id, p.label
FROM demo_contests e JOIN contests c ON c.title = e.title
CROSS JOIN (VALUES (1::bigint,'A'),(3::bigint,'B'),(5::bigint,'C'),(6::bigint,'D')) p(problem_id,label);

INSERT INTO contest_participants (contest_id, user_id, registered_at, finished_at)
SELECT c.id, cs.user_id, e.start_at - interval '3 days', CASE WHEN e.is_finished THEN e.end_at END
FROM demo_contests e JOIN demo_classes d ON d.class_no = e.class_no
JOIN classrooms cl ON cl.name = d.class_name
JOIN classroom_students cs ON cs.classroom_id = cl.id JOIN contests c ON c.title = e.title;

-- Kết quả cho toàn bộ sinh viên ở hai kỳ thi đã kết thúc.
WITH result_rows AS (
    SELECT c.id contest_id, cp.user_id, p.problem_id,
           CASE WHEN (cp.user_id+p.problem_id)%4=0 THEN 'WA' ELSE 'AC' END verdict,
           c.start_at+(10+(cp.user_id+p.problem_id*7)%90)*interval '1 minute' submitted_at
    FROM demo_contests e JOIN contests c ON c.title=e.title
    JOIN contest_participants cp ON cp.contest_id=c.id
    JOIN contest_problems p ON p.contest_id=c.id WHERE e.is_finished
)
INSERT INTO submissions
    (user_id,problem_id,contest_id,source_code,time_limit_ms,memory_limit_mb,status,verdict,
     score,time_ms,memory_kb,passed_tests,total_tests,attempts,created_at,started_at,finished_at)
SELECT r.user_id,r.problem_id,r.contest_id,
       '// demo-classroom-v2'||E'\n#include <iostream>\nint main(){return 0;}',
       p.time_limit_ms,p.memory_limit_mb,'FINISHED',r.verdict,
       CASE WHEN r.verdict='AC' THEN 100 ELSE 0 END,5+(r.user_id*r.problem_id)%95,
       1024+(r.user_id%16)*128,CASE WHEN r.verdict='AC' THEN tc.total ELSE 0 END,tc.total,1,
       r.submitted_at,r.submitted_at+interval '1 second',r.submitted_at+interval '3 seconds'
FROM result_rows r JOIN problems p ON p.id=r.problem_id
CROSS JOIN LATERAL (SELECT count(*)::smallint total FROM test_cases t WHERE t.problem_id=r.problem_id) tc;

INSERT INTO submission_test_results
    (submission_id,test_index,test_case_id,status,time_ms,memory_kb,exit_code,detail)
SELECT s.id,t.position,t.id,s.verdict,s.time_ms,s.memory_kb,0,'Kết quả mẫu'
FROM submissions s JOIN test_cases t ON t.problem_id=s.problem_id
WHERE s.source_code LIKE '// demo-classroom-v2%';

INSERT INTO submission_events (submission_id,created_at,event,attempt,note)
SELECT s.id,s.finished_at,'FINISHED',1,'Kết quả mẫu cho kỳ thi đã kết thúc'
FROM submissions s WHERE s.source_code LIKE '// demo-classroom-v2%';

SELECT setval(pg_get_serial_sequence('users','id'),(SELECT max(id) FROM users));
SELECT setval(pg_get_serial_sequence('classrooms','id'),(SELECT max(id) FROM classrooms));
SELECT setval(pg_get_serial_sequence('contests','id'),(SELECT max(id) FROM contests));
SELECT setval(pg_get_serial_sequence('courses','id'),(SELECT max(id) FROM courses));

-- Chặn seed hoàn tất nếu quy mô dữ liệu không đúng yêu cầu.
DO $$
DECLARE
    class_count int; lecturer_count int; contest_count int; finished_count int;
    upcoming_count int; invalid_class_count int; invalid_course_count int; pdf_count int;
BEGIN
    SELECT count(*) INTO class_count FROM classrooms;
    SELECT count(*) INTO lecturer_count FROM users WHERE role='LECTURER';
    SELECT count(*) INTO contest_count FROM contests;
    SELECT count(*) INTO finished_count FROM contests WHERE end_at<now();
    SELECT count(*) INTO upcoming_count FROM contests WHERE start_at>now();
    SELECT count(*) INTO invalid_class_count FROM (
        SELECT c.id FROM classrooms c LEFT JOIN classroom_students cs ON cs.classroom_id=c.id
        GROUP BY c.id HAVING count(cs.user_id)<>60
    ) bad;
    SELECT count(*) INTO invalid_course_count FROM (
        SELECT c.id FROM courses c LEFT JOIN course_units u ON u.course_id=c.id
        GROUP BY c.id HAVING count(u.id)<>5
    ) bad;
    SELECT count(*) INTO pdf_count FROM course_unit_files WHERE status='READY';
    IF class_count<>3 OR lecturer_count<>3 OR contest_count<>6 OR finished_count<>2
       OR upcoming_count<>4 OR invalid_class_count<>0 OR invalid_course_count<>0 OR pdf_count<>15 THEN
        RAISE EXCEPTION 'Demo seed sai quy mô: classes=%, lecturers=%, contests=%, finished=%, upcoming=%, bad_classes=%, bad_courses=%, pdfs=%',
            class_count,lecturer_count,contest_count,finished_count,upcoming_count,
            invalid_class_count,invalid_course_count,pdf_count;
    END IF;
    IF EXISTS (SELECT 1 FROM contests c WHERE c.end_at<now()
               AND NOT EXISTS (SELECT 1 FROM submissions s WHERE s.contest_id=c.id)) THEN
        RAISE EXCEPTION 'Có kỳ thi đã kết thúc nhưng chưa có kết quả';
    END IF;
END $$;

COMMIT;
