package com.cplusplus.backend.domain.contest;

import com.cplusplus.backend.domain.user.User;
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
import java.time.Instant;
import java.util.Objects;

/** Thí sinh đã đăng ký một kỳ thi. */
@Entity
@Table(name = "contest_participants")
public class ContestParticipant {

    /** Khóa ghép; contestId/userId được Hibernate điền qua {@code @MapsId}. */
    @Embeddable
    public static class Id implements Serializable {

        @Column(name = "contest_id")
        private Long contestId;

        @Column(name = "user_id")
        private Long userId;

        protected Id() {
        }

        public Id(Long contestId, Long userId) {
            this.contestId = contestId;
            this.userId = userId;
        }

        public Long getContestId() {
            return contestId;
        }

        public Long getUserId() {
            return userId;
        }

        @Override
        public boolean equals(Object o) {
            return this == o || (o instanceof Id other
                    && Objects.equals(contestId, other.contestId) && Objects.equals(userId, other.userId));
        }

        @Override
        public int hashCode() {
            return Objects.hash(contestId, userId);
        }
    }

    @EmbeddedId
    private Id id;

    @MapsId("contestId")
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "contest_id")
    private Contest contest;

    @MapsId("userId")
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id")
    private User user;

    @Column(name = "registered_at", nullable = false)
    private Instant registeredAt;

    protected ContestParticipant() {
    }

    ContestParticipant(Contest contest, User user, Instant registeredAt) {
        this.id = new Id(contest.getId(), user.getId());
        this.contest = contest;
        this.user = user;
        this.registeredAt = registeredAt;
    }

    public Id getId() {
        return id;
    }

    public Contest getContest() {
        return contest;
    }

    public User getUser() {
        return user;
    }

    public Instant getRegisteredAt() {
        return registeredAt;
    }

    @Override
    public boolean equals(Object o) {
        return this == o || (o instanceof ContestParticipant other && Objects.equals(id, other.id));
    }

    @Override
    public int hashCode() {
        return Objects.hashCode(id);
    }
}
