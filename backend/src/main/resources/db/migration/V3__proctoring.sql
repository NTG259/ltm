-- V3__proctoring.sql
-- Thêm bảng ghi nhận vi phạm giám sát thi (rời tab, thoát fullscreen)
CREATE TABLE IF NOT EXISTS contest_violations (
    id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    contest_id     BIGINT       NOT NULL REFERENCES contests (id) ON DELETE CASCADE,
    user_id        BIGINT       NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    violation_type VARCHAR(32)  NOT NULL DEFAULT 'TAB_SWITCH',
    details        VARCHAR(255),
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_contest_violations_contest ON contest_violations (contest_id, user_id, id DESC);

-- Bổ sung số lần vi phạm vào danh sách thí sinh dự thi để tra cứu nhanh
ALTER TABLE contest_participants
    ADD COLUMN IF NOT EXISTS tab_switch_count INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_violation_at TIMESTAMPTZ;
