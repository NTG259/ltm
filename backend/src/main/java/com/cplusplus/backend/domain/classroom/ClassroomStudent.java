package com.cplusplus.backend.domain.classroom;

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

/** Sinh viên thuộc một lớp học (mỗi sinh viên chỉ ở 1 lớp). */
@Entity
@Table(name = "classroom_students")
public class ClassroomStudent {

    @Embeddable
    public static class Id implements Serializable {

        @Column(name = "classroom_id")
        private Long classroomId;

        @Column(name = "user_id")
        private Long userId;

        protected Id() {
        }

        public Id(Long classroomId, Long userId) {
            this.classroomId = classroomId;
            this.userId = userId;
        }

        public Long getClassroomId() { return classroomId; }

        public Long getUserId() { return userId; }

        @Override
        public boolean equals(Object o) {
            return this == o || (o instanceof Id other
                    && Objects.equals(classroomId, other.classroomId)
                    && Objects.equals(userId, other.userId));
        }

        @Override
        public int hashCode() { return Objects.hash(classroomId, userId); }
    }

    @EmbeddedId
    private Id id;

    @MapsId("classroomId")
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "classroom_id")
    private Classroom classroom;

    @MapsId("userId")
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id")
    private User user;

    @Column(name = "joined_at", nullable = false)
    private Instant joinedAt;

    @Column(name = "imported_password", columnDefinition = "text")
    private String importedPassword;

    protected ClassroomStudent() {
    }

    public ClassroomStudent(Classroom classroom, User user, Instant joinedAt) {
        this.id = new Id(classroom.getId(), user.getId());
        this.classroom = classroom;
        this.user = user;
        this.joinedAt = joinedAt;
    }

    public Id getId() { return id; }

    public Classroom getClassroom() { return classroom; }

    public User getUser() { return user; }

    public Instant getJoinedAt() { return joinedAt; }

    public String getImportedPassword() { return importedPassword; }

    public void setImportedPassword(String importedPassword) { this.importedPassword = importedPassword; }

    @Override
    public boolean equals(Object o) {
        return this == o || (o instanceof ClassroomStudent other && Objects.equals(id, other.id));
    }

    @Override
    public int hashCode() { return Objects.hashCode(id); }
}
