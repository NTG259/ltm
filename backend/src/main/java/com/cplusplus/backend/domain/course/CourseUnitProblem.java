package com.cplusplus.backend.domain.course;

import com.cplusplus.backend.domain.problem.Problem;
import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

@Entity
@Table(name = "course_unit_problems", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"unit_id", "problem_id"})
})
public class CourseUnitProblem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "unit_id", nullable = false)
    private CourseUnit unit;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "problem_id", nullable = false)
    private Problem problem;

    @Column(name = "order_index", nullable = false)
    private int orderIndex = 1;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected CourseUnitProblem() {}

    public CourseUnitProblem(CourseUnit unit, Problem problem, int orderIndex) {
        this.unit = unit;
        this.problem = problem;
        this.orderIndex = orderIndex;
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

    public Problem getProblem() {
        return problem;
    }

    public void setProblem(Problem problem) {
        this.problem = problem;
    }

    public int getOrderIndex() {
        return orderIndex;
    }

    public void setOrderIndex(int orderIndex) {
        this.orderIndex = orderIndex;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
