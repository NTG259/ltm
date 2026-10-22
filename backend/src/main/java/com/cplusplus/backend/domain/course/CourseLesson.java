package com.cplusplus.backend.domain.course;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

@Entity
@Table(name = "course_lessons")
public class CourseLesson {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "unit_id", nullable = false, unique = true)
    private CourseUnit unit;

    @Column(name = "theory_content", nullable = false, columnDefinition = "TEXT")
    private String theoryContent;

    @Column(name = "sample_code", columnDefinition = "TEXT")
    private String sampleCode;

    @Column(name = "sample_input", columnDefinition = "TEXT")
    private String sampleInput;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected CourseLesson() {}

    public CourseLesson(CourseUnit unit, String theoryContent, String sampleCode, String sampleInput) {
        this.unit = unit;
        this.theoryContent = theoryContent;
        this.sampleCode = sampleCode;
        this.sampleInput = sampleInput;
    }

    public Long getId() {
        return id;
    }

    public CourseUnit getUnit() {
        return unit;
    }

    public void setUnit(CourseUnit unit) {
        this.unit = unit;
    }

    public String getTheoryContent() {
        return theoryContent;
    }

    public void setTheoryContent(String theoryContent) {
        this.theoryContent = theoryContent;
    }

    public String getSampleCode() {
        return sampleCode;
    }

    public void setSampleCode(String sampleCode) {
        this.sampleCode = sampleCode;
    }

    public String getSampleInput() {
        return sampleInput;
    }

    public void setSampleInput(String sampleInput) {
        this.sampleInput = sampleInput;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
