package com.cplusplus.backend.domain.worker;

import com.cplusplus.backend.domain.submission.Submission;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;

/** Một dòng nhật ký của Master (trang Admin). */
@Entity
@Table(name = "system_logs")
public class SystemLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(nullable = false, length = 8)
    private LogLevel level;

    @Column(nullable = false, columnDefinition = "text")
    private String message;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "worker_id")
    private JudgeWorker worker;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "submission_id")
    private Submission submission;

    protected SystemLog() {
    }

    public SystemLog(LogLevel level, String message, Instant createdAt) {
        this.level = level;
        this.message = message;
        this.createdAt = createdAt;
    }

    public SystemLog about(JudgeWorker worker, Submission submission) {
        this.worker = worker;
        this.submission = submission;
        return this;
    }

    public Long getId() {
        return id;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public LogLevel getLevel() {
        return level;
    }

    public String getMessage() {
        return message;
    }

    public JudgeWorker getWorker() {
        return worker;
    }

    public Submission getSubmission() {
        return submission;
    }
}
