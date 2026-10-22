package com.cplusplus.backend.domain.course;

import com.cplusplus.backend.domain.user.User;
import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

@Entity
@Table(name = "user_unit_progress", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"user_id", "unit_id"})
})
public class UserUnitProgress {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "unit_id", nullable = false)
    private CourseUnit unit;

    @Column(nullable = false)
    private boolean completed = true;

    @CreationTimestamp
    @Column(name = "completed_at", nullable = false)
    private Instant completedAt;

    protected UserUnitProgress() {}

    public UserUnitProgress(User user, CourseUnit unit, boolean completed) {
        this.user = user;
        this.unit = unit;
        this.completed = completed;
        this.completedAt = Instant.now();
    }

    public Long getId() {
        return id;
    }

    public User getUser() {
        return user;
    }

    public CourseUnit getUnit() {
        return unit;
    }

    public boolean isCompleted() {
        return completed;
    }

    public void setCompleted(boolean completed) {
        this.completed = completed;
        if (completed) {
            this.completedAt = Instant.now();
        }
    }

    public Instant getCompletedAt() {
        return completedAt;
    }

    public void setCompletedAt(Instant completedAt) {
        this.completedAt = completedAt;
    }
}
