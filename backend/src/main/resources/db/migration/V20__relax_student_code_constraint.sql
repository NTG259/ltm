-- Nới lỏng định dạng mã sinh viên để đồng bộ với bộ lọc Java (3-32 ký tự gồm chữ, số, dấu chấm, gạch dưới, gạch ngang)
-- Tránh lỗi "Lỗi máy chủ nội bộ" khi import file CSV chứa mã sinh viên khác mẫu B20DCCN001.
ALTER TABLE users DROP CONSTRAINT IF EXISTS ck_users_student_code;

ALTER TABLE users ADD CONSTRAINT ck_users_student_code
    CHECK (role <> 'STUDENT' OR username ~ '^[A-Za-z0-9._-]{3,32}$');

