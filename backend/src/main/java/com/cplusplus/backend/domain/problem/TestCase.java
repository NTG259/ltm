package com.cplusplus.backend.domain.problem;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

/** Một test của đề. {@code sample = true}: hiển thị trong đề làm ví dụ (và vẫn được chấm). */
@Entity
@Table(name = "test_cases")
public class TestCase {

    /** Dữ liệu một test khi admin lưu đề. */
    public record Data(String input, String expectedOutput, boolean sample) {
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "problem_id", nullable = false)
    private Problem problem;

    /** Thứ tự chấm, bắt đầu từ 1; chính là {@code index} trong kết quả chấm. */
    @Column(nullable = false)
    private short position;

    @Column(nullable = false, columnDefinition = "text")
    private String input;

    @Column(name = "expected_output", nullable = false, columnDefinition = "text")
    private String expectedOutput;

    @Column(name = "is_sample", nullable = false)
    private boolean sample;

    protected TestCase() {
    }

    TestCase(Problem problem, short position, String input, String expectedOutput, boolean sample) {
        this.problem = problem;
        this.position = position;
        this.input = input;
        this.expectedOutput = expectedOutput;
        this.sample = sample;
    }

    public Long getId() {
        return id;
    }

    public Problem getProblem() {
        return problem;
    }

    public short getPosition() {
        return position;
    }

    public void setPosition(short position) {
        this.position = position;
    }

    public String getInput() {
        return input;
    }

    public void setInput(String input) {
        this.input = input;
    }

    public String getExpectedOutput() {
        return expectedOutput;
    }

    public void setExpectedOutput(String expectedOutput) {
        this.expectedOutput = expectedOutput;
    }

    public boolean isSample() {
        return sample;
    }

    public void setSample(boolean sample) {
        this.sample = sample;
    }

    @Override
    public boolean equals(Object o) {
        return this == o || (o instanceof TestCase other && id != null && id.equals(other.id));
    }

    @Override
    public int hashCode() {
        return TestCase.class.hashCode();
    }
}
