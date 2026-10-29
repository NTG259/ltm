-- V14: Thêm role LECTURER vào bảng users

-- Xoá inline CHECK constraint chặn role LECTURER (tên auto-generated bởi Postgres)
DO $$
DECLARE
    c_name TEXT;
BEGIN
    SELECT conname INTO c_name
    FROM pg_constraint
    WHERE conrelid = 'users'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%STUDENT%'
      AND pg_get_constraintdef(oid) LIKE '%ADMIN%'
      AND pg_get_constraintdef(oid) NOT LIKE '%LECTURER%';
    IF c_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE users DROP CONSTRAINT ' || quote_ident(c_name);
    END IF;
END
$$;

-- Constraint mới cho phép STUDENT, ADMIN, LECTURER
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check_v14;
ALTER TABLE users ADD CONSTRAINT users_role_check_v14
    CHECK (role IN ('STUDENT', 'ADMIN', 'LECTURER'));

-- Tài khoản giảng viên mẫu: GV001 / gv123456 (bcrypt cost 10)
-- Dùng WHERE NOT EXISTS vì unique index là trên upper(username), không phải username
INSERT INTO users (username, full_name, role, password_hash)
SELECT 'GV001', 'Giảng viên mẫu', 'LECTURER',
       '$2a$10$DGCyct6YxT0BMVh5Sds7hu2NhzXQhwOEWMnewxCvX36.kh/n5pBZq'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE upper(username) = 'GV001');
