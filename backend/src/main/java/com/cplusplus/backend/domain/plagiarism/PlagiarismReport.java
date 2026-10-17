package com.cplusplus.backend.domain.plagiarism;

import com.cplusplus.backend.domain.contest.Contest;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "plagiarism_reports")
public class PlagiarismReport {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "contest_id", nullable = false)
    private Contest contest;

    @Column(nullable = false, length = 32)
    private String status = "COMPLETED";

    @Column(name = "submission_count", nullable = false)
    private int submissionCount = 0;

    @Column(name = "suspicious_count", nullable = false)
    private int suspiciousCount = 0;

    @Column(name = "high_risk_count", nullable = false)
    private int highRiskCount = 0;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @OneToMany(mappedBy = "report", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("similarityScore DESC")
    private List<PlagiarismMatch> matches = new ArrayList<>();

    protected PlagiarismReport() {}

    public PlagiarismReport(Contest contest, int submissionCount, int suspiciousCount, int highRiskCount, Instant createdAt) {
        this.contest = contest;
        this.submissionCount = submissionCount;
        this.suspiciousCount = suspiciousCount;
        this.highRiskCount = highRiskCount;
        this.createdAt = createdAt != null ? createdAt : Instant.now();
        this.status = "COMPLETED";
    }

    public Long getId() {
        return id;
    }

    public Contest getContest() {
        return contest;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public int getSubmissionCount() {
        return submissionCount;
    }

    public int getSuspiciousCount() {
        return suspiciousCount;
    }

    public int getHighRiskCount() {
        return highRiskCount;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public List<PlagiarismMatch> getMatches() {
        return matches;
    }

    public void addMatch(PlagiarismMatch match) {
        matches.add(match);
        match.setReport(this);
    }
}
