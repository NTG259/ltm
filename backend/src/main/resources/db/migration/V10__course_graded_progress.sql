-- ============================================================
-- V10: Quản lý bài tập thực hành theo chủ đề & Lưu tiến độ học tập
-- ============================================================

CREATE TABLE IF NOT EXISTS course_unit_problems (
    id          BIGSERIAL PRIMARY KEY,
    unit_id     BIGINT       NOT NULL REFERENCES course_units(id) ON DELETE CASCADE,
    problem_id  BIGINT       NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
    order_index INT          NOT NULL DEFAULT 1,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE (unit_id, problem_id)
);

CREATE INDEX IF NOT EXISTS ix_course_unit_problems_unit ON course_unit_problems(unit_id);
CREATE INDEX IF NOT EXISTS ix_course_unit_problems_problem ON course_unit_problems(problem_id);

CREATE TABLE IF NOT EXISTS user_unit_progress (
    id           BIGSERIAL PRIMARY KEY,
    user_id      BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    unit_id      BIGINT       NOT NULL REFERENCES course_units(id) ON DELETE CASCADE,
    completed    BOOLEAN      NOT NULL DEFAULT TRUE,
    completed_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, unit_id)
);

CREATE INDEX IF NOT EXISTS ix_user_unit_progress_user ON user_unit_progress(user_id);
CREATE INDEX IF NOT EXISTS ix_user_unit_progress_unit ON user_unit_progress(unit_id);

-- Gắn sẵn bài tập thực hành cho các chủ đề của Khóa 1 (C++ Cơ bản)
-- Unit 1 (I/O cin/cout) -> Problem 1: A + B Problem
INSERT INTO course_unit_problems (unit_id, problem_id, order_index, created_at)
SELECT u.id, 1, 1, NOW()
FROM course_units u
WHERE u.course_id = 1 AND u.order_index = 1
ON CONFLICT (unit_id, problem_id) DO NOTHING;

-- Unit 4 (Rẽ nhánh) -> Problem 3: Kiểm tra số nguyên tố
INSERT INTO course_unit_problems (unit_id, problem_id, order_index, created_at)
SELECT u.id, 3, 1, NOW()
FROM course_units u
WHERE u.course_id = 1 AND u.order_index = 4
ON CONFLICT (unit_id, problem_id) DO NOTHING;

-- Unit 5 (Vòng lặp) -> Problem 2: Fibonacci
INSERT INTO course_unit_problems (unit_id, problem_id, order_index, created_at)
SELECT u.id, 2, 1, NOW()
FROM course_units u
WHERE u.course_id = 1 AND u.order_index = 5
ON CONFLICT (unit_id, problem_id) DO NOTHING;

-- Unit 7 (Mảng & Chuỗi) -> Problem 4: Min/Max mảng & Problem 5: Chuỗi đối xứng
INSERT INTO course_unit_problems (unit_id, problem_id, order_index, created_at)
SELECT u.id, 4, 1, NOW()
FROM course_units u
WHERE u.course_id = 1 AND u.order_index = 7
ON CONFLICT (unit_id, problem_id) DO NOTHING;

INSERT INTO course_unit_problems (unit_id, problem_id, order_index, created_at)
SELECT u.id, 5, 2, NOW()
FROM course_units u
WHERE u.course_id = 1 AND u.order_index = 7
ON CONFLICT (unit_id, problem_id) DO NOTHING;
