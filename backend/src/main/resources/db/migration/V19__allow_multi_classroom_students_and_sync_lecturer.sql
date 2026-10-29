-- 1. Cho phép 1 sinh viên tham gia nhiều lớp học khác nhau
--    Khóa chính (classroom_id, user_id) vẫn đảm bảo không bị thêm trùng trong cùng 1 lớp.
ALTER TABLE classroom_students DROP CONSTRAINT IF EXISTS uq_classroom_students_user;

CREATE INDEX IF NOT EXISTS ix_classroom_students_user ON classroom_students (user_id);

-- 2. Đồng bộ trường lecturer_id của bảng classrooms từ bảng phân công classroom_lecturers
UPDATE classrooms c
SET lecturer_id = (
    SELECT cl.user_id
    FROM classroom_lecturers cl
    WHERE cl.classroom_id = c.id
    ORDER BY cl.assigned_at ASC
    LIMIT 1
)
WHERE c.lecturer_id IS NULL
  AND EXISTS (SELECT 1 FROM classroom_lecturers cl WHERE cl.classroom_id = c.id);

