-- V11: thêm attempt_token để chặn stale result sau Failover.
-- Master gán UUID mới mỗi lần giao task (OP_TASK_ASSIGN).
-- Worker phải echo lại trong OP_TASK_RESULT.
-- Master từ chối result nếu token không khớp.
ALTER TABLE submissions
    ADD COLUMN IF NOT EXISTS attempt_token UUID;
