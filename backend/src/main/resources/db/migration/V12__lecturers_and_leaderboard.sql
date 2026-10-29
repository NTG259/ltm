-- Giảng viên đăng nhập bằng tài khoản/mật khẩu và chỉ xem lớp được phân công.
ALTER TABLE users DROP CONSTRAINT users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('STUDENT', 'LECTURER', 'ADMIN'));
ALTER TABLE users DROP CONSTRAINT ck_users_admin_password;
ALTER TABLE users ADD CONSTRAINT ck_users_staff_password CHECK (role = 'STUDENT' OR password_hash IS NOT NULL);

CREATE TABLE classroom_lecturers (
    classroom_id BIGINT NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (classroom_id, user_id)
);
CREATE INDEX ix_classroom_lecturers_user ON classroom_lecturers(user_id, classroom_id);

CREATE INDEX ix_submissions_practice_rank
    ON submissions (created_at, user_id, problem_id)
    WHERE contest_id IS NULL AND status = 'FINISHED';
