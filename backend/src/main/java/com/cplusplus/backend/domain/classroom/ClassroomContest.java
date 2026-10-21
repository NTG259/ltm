package com.cplusplus.backend.domain.classroom;

import com.cplusplus.backend.domain.contest.Contest;
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

/** Kỳ thi được gán cho một lớp học. */
@Entity
@Table(name = "classroom_contests")
public class ClassroomContest {

    @Embeddable
    public static class Id implements Serializable {

        @Column(name = "classroom_id")
        private Long classroomId;

        @Column(name = "contest_id")
        private Long contestId;

        protected Id() {
        }

        public Id(Long classroomId, Long contestId) {
            this.classroomId = classroomId;
            this.contestId = contestId;
        }

        public Long getClassroomId() { return classroomId; }

        public Long getContestId() { return contestId; }

        @Override
        public boolean equals(Object o) {
            return this == o || (o instanceof Id other
                    && Objects.equals(classroomId, other.classroomId)
                    && Objects.equals(contestId, other.contestId));
        }

        @Override
        public int hashCode() { return Objects.hash(classroomId, contestId); }
    }

    @EmbeddedId
    private Id id;

    @MapsId("classroomId")
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "classroom_id")
    private Classroom classroom;

    @MapsId("contestId")
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "contest_id")
    private Contest contest;

    @Column(name = "assigned_at", nullable = false)
    private Instant assignedAt;

    protected ClassroomContest() {
    }

    public ClassroomContest(Classroom classroom, Contest contest, Instant assignedAt) {
        this.id = new Id(classroom.getId(), contest.getId());
        this.classroom = classroom;
        this.contest = contest;
        this.assignedAt = assignedAt;
    }

    public Id getId() { return id; }

    public Classroom getClassroom() { return classroom; }

    public Contest getContest() { return contest; }

    public Instant getAssignedAt() { return assignedAt; }

    @Override
    public boolean equals(Object o) {
        return this == o || (o instanceof ClassroomContest other && Objects.equals(id, other.id));
    }

    @Override
    public int hashCode() { return Objects.hashCode(id); }
}
