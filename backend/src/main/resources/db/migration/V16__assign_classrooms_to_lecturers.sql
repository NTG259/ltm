ALTER TABLE classrooms
    ADD COLUMN lecturer_id BIGINT REFERENCES users(id) ON DELETE SET NULL;

-- Các lớp cũ do giảng viên tạo được gán cho đúng người trước khi chuyển sang luồng admin tạo lớp.
UPDATE classrooms c
SET lecturer_id = c.created_by
FROM users u
WHERE c.created_by = u.id AND u.role = 'LECTURER';

CREATE INDEX ix_classrooms_lecturer ON classrooms(lecturer_id);
