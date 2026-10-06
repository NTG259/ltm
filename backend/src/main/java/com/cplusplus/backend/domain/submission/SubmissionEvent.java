package com.cplusplus.backend.domain.submission;

import com.cplusplus.backend.domain.worker.JudgeWorker;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;

/** Một mốc trên dòng thời gian của bài nộp ({@code history} trong API). */
@Entity
@Table(name = "submission_events")
public class SubmissionEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "submission_id", nullable = false)
    private Submission submission;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 12)
    private SubmissionEventType event;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "worker_id")
    private JudgeWorker worker;

    private Short attempt;

    @Column(columnDefinition = "text")
    private String note;

    protected SubmissionEvent() {
    }

    SubmissionEvent(Submission submission, SubmissionEventType event, JudgeWorker worker, Short attempt,
                    String note, Instant createdAt) {
        this.submission = submission;
        this.event = event;
        this.worker = worker;
        this.attempt = attempt;
        this.note = note;
        this.createdAt = createdAt;
    }

    public Long getId() {
        return id;
    }

    public Submission getSubmission() {
        return submission;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public SubmissionEventType getEvent() {
        return event;
    }

    public JudgeWorker getWorker() {
        return worker;
    }

    public Short getAttempt() {
        return attempt;
    }

    public String getNote() {
        return note;
    }

    @Override
    public boolean equals(Object o) {
        return this == o || (o instanceof SubmissionEvent other && id != null && id.equals(other.id));
    }

    @Override
    public int hashCode() {
        return SubmissionEvent.class.hashCode();
    }
}
