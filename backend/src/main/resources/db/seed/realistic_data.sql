-- Synthetic classroom dataset. Additive and repeatable; requires migrations V1-V11.
-- Demo accounts only: password admin123 (same bcrypt hash as the original seed).
BEGIN;
SET TIME ZONE 'Asia/Ho_Chi_Minh';

-- Repair sequences left behind by older explicit-ID seeds before adding rows.
SELECT setval(pg_get_serial_sequence('users','id'), greatest(coalesce(max(id),1),1)) FROM users;
SELECT setval(pg_get_serial_sequence('classrooms','id'), greatest(coalesce(max(id),1),1)) FROM classrooms;
SELECT setval(pg_get_serial_sequence('contests','id'), greatest(coalesce(max(id),1),1)) FROM contests;

CREATE TEMP TABLE demo_classes (n int, name text, teacher text, full_name text) ON COMMIT DROP;
INSERT INTO demo_classes VALUES
 (1,'D24CQCN01-B · Lập trình C++','gv.minh','Nguyễn Quang Minh'),
 (2,'D24CQCN02-B · Lập trình C++','gv.lan','Trần Ngọc Lan'),
 (3,'D24CQCN03-B · Lập trình C++','gv.hung','Lê Mạnh Hùng'),
 (4,'D23CQCN01-B · Cấu trúc dữ liệu','gv.minh','Nguyễn Quang Minh'),
 (5,'D23CQCN02-B · Cấu trúc dữ liệu','gv.lan','Trần Ngọc Lan'),
 (6,'CLB Olympic Tin học · Nhóm nâng cao','gv.hung','Lê Mạnh Hùng');

INSERT INTO users(username,full_name,role,password_hash,initial_password,created_at)
SELECT DISTINCT d.teacher,d.full_name,'LECTURER',
 '$2a$10$HEDAKlQqJpiB6BsR1w1Y2unKqDEKSM7Czn1eZZfvTUasGRZBVhtfO','admin123',now()-interval '60 days'
FROM demo_classes d WHERE NOT EXISTS (SELECT 1 FROM users u WHERE upper(u.username)=upper(d.teacher));

INSERT INTO users(username,full_name,role,password_hash,created_at)
SELECT 'B24DCCN'||lpad(g::text,3,'0'),
 (ARRAY['Nguyễn','Trần','Lê','Phạm','Hoàng','Vũ','Đặng','Bùi','Đỗ','Hồ','Ngô','Dương'])[(g-1)%12+1]||' '||
 (ARRAY['Minh Anh','Quốc Bảo','Ngọc Chi','Tiến Dũng','Thu Hà','Gia Hân','Trung Hiếu','Quang Huy','Khánh Linh','Đức Long','Tuấn Minh','Thanh Nam','Bảo Ngọc','Hồng Nhung','Minh Phúc','Anh Quân','Phương Thảo','Đức Thành','Thanh Thư','Hải Yến'])[((g-1)/12)%20+1],
 'STUDENT','$2a$10$HEDAKlQqJpiB6BsR1w1Y2unKqDEKSM7Czn1eZZfvTUasGRZBVhtfO',
 now()-interval '55 days'+g*interval '2 hours'
FROM generate_series(101,280) g
WHERE NOT EXISTS (SELECT 1 FROM users u WHERE upper(u.username)='B24DCCN'||lpad(g::text,3,'0'));

INSERT INTO classrooms(name,semester,created_by,created_at)
SELECT d.name,'HK1/2026-2027',u.id,now()-interval '50 days'
FROM demo_classes d JOIN users u ON u.username=d.teacher
WHERE NOT EXISTS (SELECT 1 FROM classrooms c WHERE c.name=d.name AND c.semester='HK1/2026-2027');

INSERT INTO classroom_students(classroom_id,user_id,joined_at)
SELECT c.id,u.id,now()-interval '45 days'
FROM demo_classes d JOIN classrooms c ON c.name=d.name AND c.semester='HK1/2026-2027'
JOIN users u ON u.username ~ '^B24DCCN[0-9]{3}$'
 AND substring(u.username from 8)::int BETWEEN 101+(d.n-1)*30 AND 130+(d.n-1)*30
ON CONFLICT DO NOTHING;

CREATE TEMP TABLE demo_exams(n int,label text,starts timestamptz,ends timestamptz) ON COMMIT DROP;
INSERT INTO demo_exams VALUES
 (1,'Kiểm tra giữa kỳ',now()-interval '14 days',now()-interval '14 days'+interval '120 minutes'),
 (2,'Luyện tập tuần 8',now()-interval '45 minutes',now()+interval '135 minutes'),
 (3,'Thi cuối kỳ',now()+interval '7 days',now()+interval '7 days 150 minutes');

INSERT INTO contests(title,description,start_at,end_at,created_by,created_at)
SELECT e.label||' | '||d.name,
 'Dữ liệu giả lập phục vụ trình diễn. '||e.label||' học kỳ 1 năm học 2026–2027. '
 ||'Gồm 4 bài: nhập xuất, số nguyên tố, chuỗi và sắp xếp. Chấm theo ICPC; mỗi lần sai trước AC cộng 20 phút. '
 ||'Thí sinh làm bài độc lập, sử dụng C++17 và đọc dữ liệu từ stdin.',
 e.starts,e.ends,u.id,now()-interval '21 days'
FROM demo_classes d CROSS JOIN demo_exams e JOIN users u ON u.username=d.teacher
WHERE NOT EXISTS (SELECT 1 FROM contests c WHERE c.title=e.label||' | '||d.name);

INSERT INTO classroom_contests(classroom_id,contest_id,assigned_at)
SELECT cl.id,c.id,c.created_at FROM demo_classes d
JOIN classrooms cl ON cl.name=d.name AND cl.semester='HK1/2026-2027'
CROSS JOIN demo_exams e JOIN contests c ON c.title=e.label||' | '||d.name
ON CONFLICT DO NOTHING;

INSERT INTO contest_problems(contest_id,problem_id,label)
SELECT c.id,p.id,p.label FROM demo_classes d CROSS JOIN demo_exams e
JOIN contests c ON c.title=e.label||' | '||d.name
CROSS JOIN (VALUES (1,'A'),(3,'B'),(5,'C'),(6,'D')) p(id,label)
ON CONFLICT (contest_id,problem_id) DO NOTHING;

INSERT INTO contest_participants(contest_id,user_id,registered_at)
SELECT cc.contest_id,cs.user_id,c.start_at-interval '2 days'
FROM classroom_contests cc JOIN classroom_students cs ON cs.classroom_id=cc.classroom_id
JOIN classrooms cl ON cl.id=cc.classroom_id JOIN demo_classes d ON d.name=cl.name
JOIN contests c ON c.id=cc.contest_id
ON CONFLICT DO NOTHING;

CREATE TEMP TABLE demo_solutions(problem_id int,code text) ON COMMIT DROP;
INSERT INTO demo_solutions VALUES
 (1,E'#include <iostream>\nusing namespace std;\nint main(){long long a,b;cin>>a>>b;cout<<a+b<<"\\n";}'),
 (3,E'#include <iostream>\nusing namespace std;\nint main(){long long n;cin>>n;bool ok=n>=2;for(long long i=2;i*i<=n&&ok;i++)if(n%i==0)ok=false;cout<<(ok?"YES":"NO")<<"\\n";}'),
 (5,E'#include <bits/stdc++.h>\nusing namespace std;\nint main(){string s;cin>>s;string t=s;reverse(t.begin(),t.end());cout<<(s==t?"YES":"NO")<<"\\n";}'),
 (6,E'#include <bits/stdc++.h>\nusing namespace std;\nint main(){int n;cin>>n;vector<long long>a(n);for(auto &x:a)cin>>x;sort(a.begin(),a.end());for(int i=0;i<n;i++)cout<<a[i]<<(i+1==n?"\\n":" ");}');

-- Finished history only: no artificial workload is sent to the judge queue.
WITH attempts AS (
 SELECT c.id contest_id,cp.user_id,p.problem_id,p.code,e.n exam,
        a.n attempt, (cp.user_id+p.problem_id)%5 skill,
        c.start_at+((p.problem_id*3+cp.user_id%9+a.n*9)*interval '1 minute') submitted
 FROM demo_classes d CROSS JOIN demo_exams e
 JOIN contests c ON c.title=e.label||' | '||d.name
 JOIN contest_participants cp ON cp.contest_id=c.id
 CROSS JOIN demo_solutions p CROSS JOIN (VALUES(1),(2)) a(n)
 WHERE e.n<3 AND (cp.user_id+p.problem_id)%7<>0
   AND (a.n=1 OR (cp.user_id+p.problem_id)%5 IN (1,2,3))
), rows AS (
 SELECT *,CASE WHEN skill=0 OR (attempt=2 AND skill IN (1,2)) THEN 'AC' ELSE 'WA' END result
 FROM attempts WHERE submitted+interval '4 seconds'<now()
)
INSERT INTO submissions(user_id,problem_id,contest_id,source_code,time_limit_ms,memory_limit_mb,
 status,verdict,score,time_ms,memory_kb,passed_tests,total_tests,attempts,created_at,started_at,finished_at)
SELECT r.user_id,r.problem_id,r.contest_id,
 '// demo-campus-v1:'||r.contest_id||':'||r.user_id||':'||r.problem_id||':'||r.attempt||E'\n'
 ||CASE WHEN r.result='AC' THEN r.code ELSE E'#include <iostream>\nint main(){std::cout<<0<<"\\n";}' END,
 p.time_limit_ms,p.memory_limit_mb,'FINISHED',r.result,CASE WHEN r.result='AC' THEN 100 ELSE 0 END,
 2+(r.user_id*r.problem_id)%90,512+(r.user_id%16)*128,
 CASE WHEN r.result='AC' THEN t.n ELSE 0 END,t.n,1,r.submitted,r.submitted+interval '1 second',r.submitted+interval '4 seconds'
FROM rows r JOIN problems p ON p.id=r.problem_id
CROSS JOIN LATERAL (SELECT count(*)::smallint n FROM test_cases tc WHERE tc.problem_id=r.problem_id) t
WHERE NOT EXISTS (SELECT 1 FROM submissions s WHERE s.user_id=r.user_id AND s.contest_id=r.contest_id
 AND s.problem_id=r.problem_id AND s.source_code LIKE '// demo-campus-v1:'||r.contest_id||':'||r.user_id||':'||r.problem_id||':'||r.attempt||E'\n%');

INSERT INTO submission_test_results(submission_id,test_index,test_case_id,status,time_ms,memory_kb,exit_code,detail)
SELECT s.id,t.position,t.id,s.verdict,s.time_ms,s.memory_kb,0,'Kết quả giả lập cho bộ dữ liệu demo'
FROM submissions s JOIN test_cases t ON t.problem_id=s.problem_id
WHERE s.source_code LIKE '// demo-campus-v1:%'
ON CONFLICT DO NOTHING;

INSERT INTO submission_events(submission_id,created_at,event,attempt,note)
SELECT s.id,s.finished_at,'FINISHED',1,'Lịch sử giả lập phục vụ trình diễn lớp học'
FROM submissions s WHERE s.source_code LIKE '// demo-campus-v1:%'
AND NOT EXISTS (SELECT 1 FROM submission_events e WHERE e.submission_id=s.id AND e.event='FINISHED');

-- Make existing seeded student accounts usable in the clean demo too; leave real passwords intact.
UPDATE users SET password_hash='$2a$10$HEDAKlQqJpiB6BsR1w1Y2unKqDEKSM7Czn1eZZfvTUasGRZBVhtfO'
WHERE password_hash IS NULL AND username IN
 ('B20DCCN001','B20DCCN014','B20DCCN027','B20DCCN033','B20DCCN048','B20DCCN052','B20DCCN069','B20DCCN075');

INSERT INTO classroom_lecturers(classroom_id, user_id, assigned_at)
SELECT c.id, u.id, now() - interval '45 days'
FROM demo_classes d
JOIN classrooms c ON c.name = d.name AND c.semester = 'HK1/2026-2027'
JOIN users u ON u.username = d.teacher
ON CONFLICT DO NOTHING;

UPDATE classrooms c
SET lecturer_id = u.id
FROM demo_classes d
JOIN users u ON u.username = d.teacher
WHERE c.name = d.name AND c.semester = 'HK1/2026-2027' AND c.lecturer_id IS NULL;

INSERT INTO users (username, full_name, role, password_hash, initial_password)
SELECT 'GV001', 'Giảng viên mẫu', 'LECTURER',
       '$2a$10$DGCyct6YxT0BMVh5Sds7hu2NhzXQhwOEWMnewxCvX36.kh/n5pBZq', 'gv123456'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE upper(username) = 'GV001');

COMMIT;
