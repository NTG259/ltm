ALTER TABLE users ADD COLUMN initial_password TEXT;

-- Giữ mật khẩu khởi tạo của tài khoản giảng viên mẫu để admin có thể phân phối.
UPDATE users
SET initial_password = 'gv123456'
WHERE upper(username) = 'GV001' AND role = 'LECTURER';

COMMENT ON COLUMN users.initial_password IS
    'Initial/reset password retained for administrator distribution; cleared after the user changes their password.';
