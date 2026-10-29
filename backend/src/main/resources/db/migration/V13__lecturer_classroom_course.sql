-- ============================================================
-- V13: Giảng viên + Khóa học gắn lớp + File PDF tài liệu
-- ============================================================

-- Gán khóa học cho lớp (1 lớp : 1 khóa học)
CREATE TABLE IF NOT EXISTS classroom_courses (
    classroom_id BIGINT NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
    course_id    BIGINT NOT NULL REFERENCES courses(id)    ON DELETE CASCADE,
    assigned_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (classroom_id)
);

CREATE INDEX IF NOT EXISTS ix_classroom_courses_course ON classroom_courses(course_id);

-- File PDF tài liệu gắn với từng chương
CREATE TABLE IF NOT EXISTS course_unit_files (
    id          BIGSERIAL PRIMARY KEY,
    unit_id     BIGINT       NOT NULL REFERENCES course_units(id) ON DELETE CASCADE,
    filename    VARCHAR(255) NOT NULL,
    file_key    VARCHAR(512) NOT NULL,
    file_size   BIGINT,
    order_index INT          NOT NULL DEFAULT 1,
    uploaded_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_course_unit_files_unit ON course_unit_files(unit_id, order_index);
