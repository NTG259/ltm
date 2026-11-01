ALTER TABLE course_unit_files
    ADD COLUMN IF NOT EXISTS storage_bucket VARCHAR(255),
    ADD COLUMN IF NOT EXISTS content_type VARCHAR(100) NOT NULL DEFAULT 'application/pdf',
    ADD COLUMN IF NOT EXISTS checksum VARCHAR(255),
    ADD COLUMN IF NOT EXISTS status VARCHAR(16) NOT NULL DEFAULT 'READY',
    ADD COLUMN IF NOT EXISTS uploaded_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

ALTER TABLE course_unit_files DROP CONSTRAINT IF EXISTS ck_course_unit_files_status;
ALTER TABLE course_unit_files ADD CONSTRAINT ck_course_unit_files_status
    CHECK (status IN ('PENDING', 'READY', 'DELETING', 'FAILED'));

CREATE INDEX IF NOT EXISTS ix_course_unit_files_cleanup
    ON course_unit_files(status, expires_at)
    WHERE status IN ('PENDING', 'DELETING');
