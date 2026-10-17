package com.cplusplus.backend.domain.plagiarism;

import com.cplusplus.backend.domain.contest.Contest;
import com.cplusplus.backend.domain.problem.Problem;
import com.cplusplus.backend.domain.submission.Submission;
import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "plagiarism_matches")
public class PlagiarismMatch {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "report_id", nullable = false)
    private PlagiarismReport report;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "contest_id", nullable = false)
    private Contest contest;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "problem_id", nullable = false)
    private Problem problem;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "submission_a_id", nullable = false)
    private Submission submissionA;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "submission_b_id", nullable = false)
    private Submission submissionB;

    @Column(name = "similarity_score", nullable = false)
    private double similarityScore;

    @Column(name = "verdict_level", nullable = false, length = 32)
    private String verdictLevel; // HIGH_RISK, SUSPICIOUS

    @Column(name = "matched_fingerprints", nullable = false)
    private int matchedFingerprints = 0;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    protected PlagiarismMatch() {}

    public PlagiarismMatch(
            PlagiarismReport report,
            Contest contest,
            Problem problem,
            Submission submissionA,
            Submission submissionB,
            double similarityScore,
            String verdictLevel,
            int matchedFingerprints,
            Instant createdAt) {
        this.report = report;
        this.contest = contest;
        this.problem = problem;
        this.submissionA = submissionA;
        this.submissionB = submissionB;
        this.similarityScore = similarityScore;
        this.verdictLevel = verdictLevel;
        this.matchedFingerprints = matchedFingerprints;
        this.createdAt = createdAt != null ? createdAt : Instant.now();
    }

    public Long getId() {
        return id;
    }

    public PlagiarismReport getReport() {
        return report;
    }

    public void setReport(PlagiarismReport report) {
        this.report = report;
    }

    public Contest getContest() {
        return contest;
    }

    public Problem getProblem() {
        return problem;
    }

    public Submission getSubmissionA() {
        return submissionA;
    }

    public Submission getSubmissionB() {
        return submissionB;
    }

    public double getSimilarityScore() {
        return similarityScore;
    }

    public String getVerdictLevel() {
        return verdictLevel;
    }

    public int getMatchedFingerprints() {
        return matchedFingerprints;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
