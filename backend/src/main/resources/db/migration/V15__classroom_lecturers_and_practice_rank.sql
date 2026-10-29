-- Phân công nhiều giảng viên cho một lớp và tối ưu truy vấn bảng xếp hạng luyện tập.
CREATE TABLE IF NOT EXISTS classroom_lecturers (
    classroom_id BIGINT NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (classroom_id, user_id)
);

-- Giữ quyền truy cập của các giảng viên đang sở hữu lớp trước khi có bảng phân công.
INSERT INTO classroom_lecturers (classroom_id, user_id)
SELECT id, created_by FROM classrooms
WHERE created_by IS NOT NULL
ON CONFLICT DO NOTHING;

CREATE INDEX IF NOT EXISTS ix_classroom_lecturers_user
    ON classroom_lecturers(user_id, classroom_id);

CREATE INDEX IF NOT EXISTS ix_submissions_practice_rank
    ON submissions (created_at, user_id, problem_id)
    WHERE contest_id IS NULL AND status = 'FINISHED';
