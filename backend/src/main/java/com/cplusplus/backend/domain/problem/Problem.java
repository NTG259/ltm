package com.cplusplus.backend.domain.problem;

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
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

/**
 * Đề bài. Xóa = xóa mềm ({@link #softDelete}) vì bài nộp cũ vẫn tham chiếu tới đề.
 * Truy vấn danh sách đề phải tự lọc {@code deletedAt IS NULL} (xem ProblemRepository).
 */
@Entity
@Table(name = "problems")
public class Problem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(nullable = false, length = 8)
    private Difficulty difficulty = Difficulty.EASY;

    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(nullable = false, columnDefinition = "text[]")
    private List<String> tags = new ArrayList<>();

    /** Markdown. */
    @Column(nullable = false, columnDefinition = "text")
    private String statement;

    @Column(name = "input_spec", nullable = false, columnDefinition = "text")
    private String inputSpec = "";

    @Column(name = "output_spec", nullable = false, columnDefinition = "text")
    private String outputSpec = "";

    @Column(name = "time_limit_ms", nullable = false)
    private int timeLimitMs = 1000;

    @Column(name = "memory_limit_mb", nullable = false)
    private int memoryLimitMb = 256;

    @Column(nullable = false, length = 16)
    private CheckerType checker = CheckerType.LINES;

    /** FALSE: chỉ xuất hiện trong kỳ thi hoặc đang là bản nháp. */
    @Column(name = "is_public", nullable = false)
    private boolean publicVisible = true;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by")
    private User createdBy;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "deleted_at")
    private Instant deletedAt;

    @OneToMany(mappedBy = "problem", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("position")
    private List<TestCase> testCases = new ArrayList<>();

    protected Problem() {
    }

    public Problem(String title, String statement) {
        this.title = title;
        this.statement = statement;
    }

    /** Thêm test vào cuối bộ test. */
    public TestCase addTestCase(String input, String expectedOutput, boolean sample) {
        TestCase tc = new TestCase(this, (short) (testCases.size() + 1), input, expectedOutput, sample);
        testCases.add(tc);
        return tc;
    }

    /** Thay toàn bộ bộ test (admin lưu đề); test cũ bị xóa, kết quả chấm cũ giữ lại với test_case_id = NULL. */
    public void replaceTestCases(List<TestCase.Data> data) {
        testCases.clear();
        data.forEach(d -> addTestCase(d.input(), d.expectedOutput(), d.sample()));
    }

    public List<TestCase> getSamples() {
        return testCases.stream().filter(TestCase::isSample).toList();
    }

    public void softDelete(Instant now) {
        this.deletedAt = now;
    }

    public boolean isDeleted() {
        return deletedAt != null;
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

    public Difficulty getDifficulty() {
        return difficulty;
    }

    public void setDifficulty(Difficulty difficulty) {
        this.difficulty = difficulty;
    }

    public List<String> getTags() {
        return tags;
    }

    public void setTags(List<String> tags) {
        this.tags = new ArrayList<>(tags);
    }

    public String getStatement() {
        return statement;
    }

    public void setStatement(String statement) {
        this.statement = statement;
    }

    public String getInputSpec() {
        return inputSpec;
    }

    public void setInputSpec(String inputSpec) {
        this.inputSpec = inputSpec;
    }

    public String getOutputSpec() {
        return outputSpec;
    }

    public void setOutputSpec(String outputSpec) {
        this.outputSpec = outputSpec;
    }

    public int getTimeLimitMs() {
        return timeLimitMs;
    }

    public void setTimeLimitMs(int timeLimitMs) {
        this.timeLimitMs = timeLimitMs;
    }

    public int getMemoryLimitMb() {
        return memoryLimitMb;
    }

    public void setMemoryLimitMb(int memoryLimitMb) {
        this.memoryLimitMb = memoryLimitMb;
    }

    public CheckerType getChecker() {
        return checker;
    }

    public void setChecker(CheckerType checker) {
        this.checker = checker;
    }

    public boolean isPublicVisible() {
        return publicVisible;
    }

    public void setPublicVisible(boolean publicVisible) {
        this.publicVisible = publicVisible;
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

    public Instant getDeletedAt() {
        return deletedAt;
    }

    public List<TestCase> getTestCases() {
        return testCases;
    }

    @Override
    public boolean equals(Object o) {
        return this == o || (o instanceof Problem other && id != null && id.equals(other.id));
    }

    @Override
    public int hashCode() {
        return Problem.class.hashCode();
    }
}
