package com.cplusplus.backend.domain.classroom;

import com.cplusplus.backend.domain.course.Course;
import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "classroom_courses")
public class ClassroomCourse {

    @Id
    private Long classroomId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @MapsId
    @JoinColumn(name = "classroom_id", nullable = false)
    private Classroom classroom;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "course_id", nullable = false)
    private Course course;

    @Column(name = "assigned_at", nullable = false)
    private Instant assignedAt = Instant.now();

    protected ClassroomCourse() {}

    public ClassroomCourse(Classroom classroom, Course course) {
        this.classroom = classroom;
        this.classroomId = classroom.getId();
        this.course = course;
    }

    public Long getClassroomId() { return classroomId; }
    public Classroom getClassroom() { return classroom; }
    public Course getCourse() { return course; }
    public void setCourse(Course course) { this.course = course; }
    public Instant getAssignedAt() { return assignedAt; }
}
