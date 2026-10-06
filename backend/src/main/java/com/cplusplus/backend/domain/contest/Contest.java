package com.cplusplus.backend.domain.contest;

import com.cplusplus.backend.domain.problem.Problem;
import com.cplusplus.backend.domain.user.User;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

/** Kỳ thi thể thức ICPC. */
@Entity
@Table(name = "contests")
public class Contest {

    private static final String LABELS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(nullable = false, columnDefinition = "text")
    private String description = "";

    @Column(name = "start_at", nullable = false)
    private Instant startAt;

    @Column(name = "end_at", nullable = false)
    private Instant endAt;

    /** Phút phạt cho mỗi lần nộp sai trước AC (CE/SEC không tính). */
    @Column(name = "penalty_minutes", nullable = false)
    private short penaltyMinutes = 20;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by")
    private User createdBy;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @OneToMany(mappedBy = "contest", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("label")
    private List<ContestProblem> problems = new ArrayList<>();

    @OneToMany(mappedBy = "contest", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<ContestParticipant> participants = new ArrayList<>();

    protected Contest() {
    }

    public Contest(String title, Instant startAt, Duration duration) {
        this.title = title;
        reschedule(startAt, duration);
    }

    public void reschedule(Instant startAt, Duration duration) {
        if (duration.isNegative() || duration.isZero()) {
            throw new IllegalArgumentException("Thời lượng kỳ thi phải dương");
        }
        this.startAt = startAt;
        this.endAt = startAt.plus(duration);
    }

    public ContestPhase phaseAt(Instant now) {
        if (now.isBefore(startAt)) {
            return ContestPhase.UPCOMING;
        }
        return now.isBefore(endAt) ? ContestPhase.RUNNING : ContestPhase.ENDED;
    }

    public long getDurationMinutes() {
        return Duration.between(startAt, endAt).toMinutes();
    }

    /** Đặt lại danh sách bài theo thứ tự; nhãn A, B, C... theo vị trí. */
    public void setProblemList(List<Problem> list) {
        if (list.size() > LABELS.length()) {
            throw new IllegalArgumentException("Kỳ thi tối đa " + LABELS.length() + " bài");
        }
        problems.clear();
        for (int i = 0; i < list.size(); i++) {
            problems.add(new ContestProblem(this, list.get(i), String.valueOf(LABELS.charAt(i))));
        }
    }

    public Optional<ContestProblem> findProblem(long problemId) {
        return problems.stream().filter(p -> p.getProblem().getId() == problemId).findFirst();
    }

    public ContestParticipant register(User user, Instant now) {
        if (phaseAt(now) == ContestPhase.ENDED) {
            throw new IllegalStateException("Kỳ thi đã kết thúc");
        }
        return participants.stream()
                .filter(p -> p.getUser().equals(user))
                .findFirst()
                .orElseGet(() -> {
                    ContestParticipant p = new ContestParticipant(this, user, now);
                    participants.add(p);
                    return p;
                });
    }

    public Long getId() {
        return id;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public Instant getStartAt() {
        return startAt;
    }

    public Instant getEndAt() {
        return endAt;
    }

    public short getPenaltyMinutes() {
        return penaltyMinutes;
    }

    public void setPenaltyMinutes(short penaltyMinutes) {
        this.penaltyMinutes = penaltyMinutes;
    }

    public User getCreatedBy() {
        return createdBy;
    }

    public void setCreatedBy(User createdBy) {
        this.createdBy = createdBy;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public List<ContestProblem> getProblems() {
        return problems;
    }

    public List<ContestParticipant> getParticipants() {
        return participants;
    }

    @Override
    public boolean equals(Object o) {
        return this == o || (o instanceof Contest other && id != null && id.equals(other.id));
    }

    @Override
    public int hashCode() {
        return Contest.class.hashCode();
    }
}
