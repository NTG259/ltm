package com.cplusplus.backend.domain.contest;

import com.cplusplus.backend.domain.problem.Problem;
import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.MapsId;
import jakarta.persistence.Table;
import java.io.Serializable;
import java.util.Objects;

/** Bài thuộc kỳ thi, kèm nhãn A, B, C... */
@Entity
@Table(name = "contest_problems")
public class ContestProblem {

    /** Khóa ghép; contestId/problemId được Hibernate điền qua {@code @MapsId}. */
    @Embeddable
    public static class Id implements Serializable {

        @Column(name = "contest_id")
        private Long contestId;

        @Column(name = "problem_id")
        private Long problemId;

        protected Id() {
        }

        public Id(Long contestId, Long problemId) {
            this.contestId = contestId;
            this.problemId = problemId;
        }

        public Long getContestId() {
            return contestId;
        }

        public Long getProblemId() {
            return problemId;
        }

        @Override
        public boolean equals(Object o) {
            return this == o || (o instanceof Id other
                    && Objects.equals(contestId, other.contestId) && Objects.equals(problemId, other.problemId));
        }

        @Override
        public int hashCode() {
            return Objects.hash(contestId, problemId);
        }
    }

    @EmbeddedId
    private Id id;

    @MapsId("contestId")
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "contest_id")
    private Contest contest;

    @MapsId("problemId")
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "problem_id")
    private Problem problem;

    @Column(nullable = false, length = 2)
    private String label;

    protected ContestProblem() {
    }

    ContestProblem(Contest contest, Problem problem, String label) {
        this.id = new Id(contest.getId(), problem.getId());
        this.contest = contest;
        this.problem = problem;
        this.label = label;
    }

    public Id getId() {
        return id;
    }

    public Contest getContest() {
        return contest;
    }

    public Problem getProblem() {
        return problem;
    }

    public String getLabel() {
        return label;
    }

    @Override
    public boolean equals(Object o) {
        return this == o || (o instanceof ContestProblem other && Objects.equals(id, other.id));
    }

    @Override
    public int hashCode() {
        return Objects.hashCode(id);
    }
}
