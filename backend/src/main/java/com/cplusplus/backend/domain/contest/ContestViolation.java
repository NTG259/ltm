package com.cplusplus.backend.domain.contest;

import com.cplusplus.backend.domain.user.User;
import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "contest_violations")
public class ContestViolation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "contest_id", nullable = false)
    private Contest contest;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "violation_type", nullable = false, length = 32)
    private String violationType;

    @Column(name = "details", length = 255)
    private String details;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected ContestViolation() {
    }

    public ContestViolation(Contest contest, User user, String violationType, String details, Instant createdAt) {
        this.contest = contest;
        this.user = user;
        this.violationType = violationType != null ? violationType : "TAB_SWITCH";
        this.details = details;
        this.createdAt = createdAt != null ? createdAt : Instant.now();
    }

    public Long getId() {
        return id;
    }

    public Contest getContest() {
        return contest;
    }

    public User getUser() {
        return user;
    }

    public String getViolationType() {
        return violationType;
    }

    public String getDetails() {
        return details;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
