-- ============================================================
-- V5: Bảng phát hiện đạo văn (Plagiarism Detection & Code Similarity)
-- ============================================================

CREATE TABLE plagiarism_reports (
    id BIGSERIAL PRIMARY KEY,
    contest_id BIGINT NOT NULL REFERENCES contests(id) ON DELETE CASCADE,
    status VARCHAR(32) NOT NULL DEFAULT 'COMPLETED',
    submission_count INT NOT NULL DEFAULT 0,
    suspicious_count INT NOT NULL DEFAULT 0,
    high_risk_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ix_plagiarism_reports_contest ON plagiarism_reports(contest_id, created_at DESC);

CREATE TABLE plagiarism_matches (
    id BIGSERIAL PRIMARY KEY,
    report_id BIGINT NOT NULL REFERENCES plagiarism_reports(id) ON DELETE CASCADE,
    contest_id BIGINT NOT NULL REFERENCES contests(id) ON DELETE CASCADE,
    problem_id BIGINT NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
    submission_a_id BIGINT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
    submission_b_id BIGINT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
    similarity_score DOUBLE PRECISION NOT NULL,
    verdict_level VARCHAR(32) NOT NULL,
    matched_fingerprints INT DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ix_plagiarism_matches_report ON plagiarism_matches(report_id, similarity_score DESC);
CREATE INDEX ix_plagiarism_matches_contest ON plagiarism_matches(contest_id);
