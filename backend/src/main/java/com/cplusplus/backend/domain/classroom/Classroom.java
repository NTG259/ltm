package com.cplusplus.backend.domain.classroom;

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
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import org.hibernate.annotations.CreationTimestamp;

/** Lớp học theo kỳ học thực tế. */
@Entity
@Table(name = "classrooms")
public class Classroom {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 255)
    private String name;

    @Column(length = 50)
    private String semester;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by")
    private User createdBy;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @OneToMany(mappedBy = "classroom", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<ClassroomStudent> students = new ArrayList<>();

    @OneToMany(mappedBy = "classroom", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<ClassroomContest> contests = new ArrayList<>();

    protected Classroom() {
    }

    public Classroom(String name, String semester, User createdBy) {
        this.name = name;
        this.semester = semester;
        this.createdBy = createdBy;
    }

    public Long getId() { return id; }

    public String getName() { return name; }

    public void setName(String name) { this.name = name; }

    public String getSemester() { return semester; }

    public void setSemester(String semester) { this.semester = semester; }

    public User getCreatedBy() { return createdBy; }

    public Instant getCreatedAt() { return createdAt; }

    public List<ClassroomStudent> getStudents() { return students; }

    public List<ClassroomContest> getContests() { return contests; }

    @Override
    public boolean equals(Object o) {
        return this == o || (o instanceof Classroom other && id != null && id.equals(other.id));
    }

    @Override
    public int hashCode() { return Classroom.class.hashCode(); }
}
