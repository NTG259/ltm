package com.cplusplus.backend.domain.submission;

import com.cplusplus.backend.domain.problem.TestCase;
import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.MapsId;
import jakarta.persistence.Table;
import java.io.Serializable;
import java.util.Objects;

/** Kết quả một test của bài nộp (phần tử của mảng {@code tests} trong OP_TASK_RESULT). */
@Entity
@Table(name = "submission_test_results")
public class SubmissionTestResult {

    /** Dữ liệu một test do Worker gửi về. */
    public record Data(
            short testIndex,
            TestStatus status,
            Integer timeMs,
            Integer memoryKb,
            String output,
            String stderr,
            Integer exitCode,
            String signal,
            String detail) {
    }

    /** Khóa ghép (submission_id, test_index). */
    @Embeddable
    public static class Id implements Serializable {

        @Column(name = "submission_id")
        private Long submissionId;

        @Column(name = "test_index")
        private short testIndex;

        protected Id() {
        }

        public Id(Long submissionId, short testIndex) {
            this.submissionId = submissionId;
            this.testIndex = testIndex;
        }

        public Long getSubmissionId() {
            return submissionId;
        }

        public short getTestIndex() {
            return testIndex;
        }

        @Override
        public boolean equals(Object o) {
            return this == o || (o instanceof Id other
                    && Objects.equals(submissionId, other.submissionId) && testIndex == other.testIndex);
        }

        @Override
        public int hashCode() {
            return Objects.hash(submissionId, testIndex);
        }
    }

    @EmbeddedId
    private Id id;

    @MapsId("submissionId")
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "submission_id")
    private Submission submission;

    /** NULL nếu test đã bị admin xóa/sửa sau khi chấm. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "test_case_id")
    private TestCase testCase;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 8)
    private TestStatus status;

    @Column(name = "time_ms")
    private Integer timeMs;

    @Column(name = "memory_kb")
    private Integer memoryKb;

    /** Worker đã cắt còn tối đa 4 KB. */
    @Column(name = "output_preview", columnDefinition = "text")
    private String outputPreview;

    @Column(name = "stderr_preview", columnDefinition = "text")
    private String stderrPreview;

    @Column(name = "exit_code")
    private Integer exitCode;

    @Column(length = 16)
    private String signal;

    private String detail;

    protected SubmissionTestResult() {
    }

    SubmissionTestResult(Submission submission, TestCase testCase, Data data) {
        this.id = new Id(submission.getId(), data.testIndex());
        this.submission = submission;
        this.testCase = testCase;
        this.status = data.status();
        this.timeMs = data.timeMs();
        this.memoryKb = data.memoryKb();
        this.outputPreview = data.output();
        this.stderrPreview = data.stderr();
        this.exitCode = data.exitCode();
        this.signal = data.signal();
        this.detail = data.detail();
    }

    public short getTestIndex() {
        return id.getTestIndex();
    }

    public Submission getSubmission() {
        return submission;
    }

    public TestCase getTestCase() {
        return testCase;
    }

    public TestStatus getStatus() {
        return status;
    }

    public Integer getTimeMs() {
        return timeMs;
    }

    public Integer getMemoryKb() {
        return memoryKb;
    }

    public String getOutputPreview() {
        return outputPreview;
    }

    public String getStderrPreview() {
        return stderrPreview;
    }

    public Integer getExitCode() {
        return exitCode;
    }

    public String getSignal() {
        return signal;
    }

    public String getDetail() {
        return detail;
    }

    @Override
    public boolean equals(Object o) {
        return this == o || (o instanceof SubmissionTestResult other && Objects.equals(id, other.id));
    }

    @Override
    public int hashCode() {
        return Objects.hashCode(id);
    }
}
