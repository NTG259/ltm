package com.cplusplus.backend.domain.submission;

import com.cplusplus.backend.domain.contest.Contest;
import com.cplusplus.backend.domain.problem.Problem;
import com.cplusplus.backend.domain.problem.TestCase;
import com.cplusplus.backend.domain.user.User;
import com.cplusplus.backend.domain.worker.JudgeWorker;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
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
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Bài nộp. Vòng đời:
 * <pre>
 * IN_QUEUE ─assign→ (IN_QUEUE) ─→ COMPILING ─→ TESTING ─→ FINISHED
 *    ↑                 │ Worker chết / REJECTED
 *    └──── requeue ────┘ (quá {@value #MAX_ATTEMPTS} lần giao → FAILED)
 * </pre>
 * Mỗi bước ghi một {@link SubmissionEvent} vào dòng thời gian.
 */
@Entity
@Table(name = "submissions")
public class Submission {

    /** Failover tối đa 3 lần (khớp CHECK attempts BETWEEN 0 AND 3). */
    public static final int MAX_ATTEMPTS = 3;

    /** Kết quả chấm do Worker gửi về (OP_TASK_RESULT). */
    public record Outcome(
            Verdict verdict,
            int score,
            Integer timeMs,
            Integer memoryKb,
            int passedTests,
            int totalTests,
            String compileLog,
            String securityMessage,
            List<SubmissionTestResult.Data> tests) {
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "problem_id", nullable = false)
    private Problem problem;

    /** NULL = bài luyện tập. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "contest_id")
    private Contest contest;

    @Column(nullable = false, length = 16)
    private Language language = Language.CPP17;

    @Column(name = "source_code", nullable = false, columnDefinition = "text")
    private String sourceCode;

    /** Giới hạn của đề tại thời điểm nộp. */
    @Column(name = "time_limit_ms", nullable = false)
    private int timeLimitMs;

    @Column(name = "memory_limit_mb", nullable = false)
    private int memoryLimitMb;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 12)
    private SubmissionStatus status = SubmissionStatus.IN_QUEUE;

    @Enumerated(EnumType.STRING)
    @Column(length = 3)
    private Verdict verdict;

    private Short score;

    @Column(name = "time_ms")
    private Integer timeMs;

    @Column(name = "memory_kb")
    private Integer memoryKb;

    @Column(name = "passed_tests")
    private Short passedTests;

    @Column(name = "total_tests")
    private Short totalTests;

    @Column(name = "compile_log", columnDefinition = "text")
    private String compileLog;

    @Column(name = "security_message", columnDefinition = "text")
    private String securityMessage;

    @Column(name = "error_message", columnDefinition = "text")
    private String errorMessage;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "worker_id")
    private JudgeWorker worker;

    /** Số lần đã giao cho Worker. */
    @Column(nullable = false)
    private short attempts;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "started_at")
    private Instant startedAt;

    @Column(name = "finished_at")
    private Instant finishedAt;

    @OneToMany(mappedBy = "submission", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("id.testIndex")
    private List<SubmissionTestResult> testResults = new ArrayList<>();

    @OneToMany(mappedBy = "submission", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("id")
    private List<SubmissionEvent> events = new ArrayList<>();

    protected Submission() {
    }

    /**
     * Tạo bài nộp mới ở trạng thái IN_QUEUE. Với bài trong kỳ thi, DB còn kiểm tra thí sinh đã
     * đăng ký, nộp trong giờ thi và bài thuộc kỳ thi (trigger + khóa ngoại kép).
     */
    public Submission(User user, Problem problem, Contest contest, String sourceCode, Instant now) {
        this.user = user;
        this.problem = problem;
        this.contest = contest;
        this.sourceCode = sourceCode;
        this.timeLimitMs = problem.getTimeLimitMs();
        this.memoryLimitMb = problem.getMemoryLimitMb();
        this.createdAt = now;
        record(SubmissionEventType.IN_QUEUE, null, "Nhận bài qua HTTP POST /api/submissions", now);
    }

    // ------------------------------------------------------------------ vòng đời

    /** Master gửi OP_TASK_ASSIGN cho {@code target}. */
    public void assignTo(JudgeWorker target, Instant now) {
        requireStatus(SubmissionStatus.IN_QUEUE);
        if (attempts >= MAX_ATTEMPTS) {
            throw new IllegalStateException("Bài #" + id + " đã được giao " + attempts + " lần");
        }
        attempts++;
        worker = target;
        startedAt = now;
        record(SubmissionEventType.ASSIGNED, target, "OP_TASK_ASSIGN → " + target.getId(), now);
    }

    /** Worker báo OP_TASK_STATUS COMPILING / TESTING. */
    public void updateStatus(SubmissionStatus next, Instant now) {
        if (next != SubmissionStatus.COMPILING && next != SubmissionStatus.TESTING) {
            throw new IllegalArgumentException("OP_TASK_STATUS chỉ mang COMPILING hoặc TESTING");
        }
        if (!status.isPending()) {
            throw new IllegalStateException("Bài #" + id + " đã ở trạng thái " + status);
        }
        if (status != next) {
            status = next;
            record(next == SubmissionStatus.COMPILING ? SubmissionEventType.COMPILING : SubmissionEventType.TESTING,
                    worker, null, now);
        }
    }

    /**
     * Worker chết giữa chừng hoặc từ chối bài: đưa về hàng đợi.
     *
     * @return {@code true} nếu còn được giao lại, {@code false} nếu đã hết lượt và bài bị FAILED
     */
    public boolean requeue(SubmissionEventType reason, String note, Instant now) {
        if (reason != SubmissionEventType.REQUEUED && reason != SubmissionEventType.REJECTED) {
            throw new IllegalArgumentException("Lý do đưa về hàng đợi phải là REQUEUED hoặc REJECTED");
        }
        if (!status.isPending()) {
            return false;
        }
        record(reason, worker, note, now);
        if (reason == SubmissionEventType.REQUEUED && attempts >= MAX_ATTEMPTS) {
            fail("Failover quá " + MAX_ATTEMPTS + " lần", now);
            return false;
        }
        if (reason == SubmissionEventType.REJECTED) {
            attempts--; // Worker bận không làm hỏng bài, không tính là một lần thử
        }
        status = SubmissionStatus.IN_QUEUE;
        worker = null;
        return true;
    }

    /**
     * Worker gửi OP_TASK_RESULT.
     *
     * @param testCasesByIndex test của đề theo {@code position}, để liên kết kết quả với test gốc
     */
    public void finish(Outcome outcome, Map<Short, TestCase> testCasesByIndex, Instant now) {
        if (!status.isPending()) {
            throw new IllegalStateException("Bài #" + id + " đã ở trạng thái " + status);
        }
        status = SubmissionStatus.FINISHED;
        verdict = outcome.verdict();
        score = (short) outcome.score();
        timeMs = outcome.timeMs();
        memoryKb = outcome.memoryKb();
        passedTests = (short) outcome.passedTests();
        totalTests = (short) outcome.totalTests();
        compileLog = outcome.compileLog();
        securityMessage = outcome.securityMessage();
        errorMessage = null;
        finishedAt = now;
        testResults.clear();
        for (SubmissionTestResult.Data data : outcome.tests()) {
            testResults.add(new SubmissionTestResult(this, testCasesByIndex.get(data.testIndex()), data));
        }
        record(SubmissionEventType.FINISHED, worker, "Kết quả " + verdict + " – " + score + "/100 điểm", now);
    }

    /** Tiện ích cho {@link #finish(Outcome, Map, Instant)}: lấy test từ chính đề bài. */
    public void finish(Outcome outcome, Instant now) {
        Map<Short, TestCase> byIndex = problem.getTestCases().stream()
                .collect(Collectors.toMap(TestCase::getPosition, Function.identity()));
        finish(outcome, byIndex, now);
    }

    /** Lỗi phía máy chấm không thể chấm tiếp. */
    public void fail(String message, Instant now) {
        status = SubmissionStatus.FAILED;
        verdict = null;
        errorMessage = message;
        finishedAt = now;
        record(SubmissionEventType.FAILED, worker, message, now);
    }

    /** Admin chấm lại: xóa kết quả cũ và đưa về hàng đợi (giữ dòng thời gian). */
    public void rejudge(Instant now) {
        status = SubmissionStatus.IN_QUEUE;
        verdict = null;
        score = null;
        timeMs = null;
        memoryKb = null;
        passedTests = null;
        totalTests = null;
        compileLog = null;
        securityMessage = null;
        errorMessage = null;
        worker = null;
        attempts = 0;
        startedAt = null;
        finishedAt = null;
        timeLimitMs = problem.getTimeLimitMs();
        memoryLimitMb = problem.getMemoryLimitMb();
        testResults.clear();
        record(SubmissionEventType.REJUDGE, null, "Chấm lại theo yêu cầu quản trị viên", now);
    }

    private void record(SubmissionEventType type, JudgeWorker w, String note, Instant now) {
        events.add(new SubmissionEvent(this, type, w, attempts == 0 ? null : attempts, note, now));
    }

    private void requireStatus(SubmissionStatus expected) {
        if (status != expected) {
            throw new IllegalStateException("Bài #" + id + " đang " + status + ", cần " + expected);
        }
    }

    // ------------------------------------------------------------------ getters

    public Long getId() {
        return id;
    }

    public User getUser() {
        return user;
    }

    public Problem getProblem() {
        return problem;
    }

    public Contest getContest() {
        return contest;
    }

    public Language getLanguage() {
        return language;
    }

    public String getSourceCode() {
        return sourceCode;
    }

    public int getTimeLimitMs() {
        return timeLimitMs;
    }

    public int getMemoryLimitMb() {
        return memoryLimitMb;
    }

    public SubmissionStatus getStatus() {
        return status;
    }

    public Verdict getVerdict() {
        return verdict;
    }

    public Short getScore() {
        return score;
    }

    public Integer getTimeMs() {
        return timeMs;
    }

    public Integer getMemoryKb() {
        return memoryKb;
    }

    public Short getPassedTests() {
        return passedTests;
    }

    public Short getTotalTests() {
        return totalTests;
    }

    public String getCompileLog() {
        return compileLog;
    }

    public String getSecurityMessage() {
        return securityMessage;
    }

    public String getErrorMessage() {
        return errorMessage;
    }

    public JudgeWorker getWorker() {
        return worker;
    }

    public short getAttempts() {
        return attempts;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getStartedAt() {
        return startedAt;
    }

    public Instant getFinishedAt() {
        return finishedAt;
    }

    public List<SubmissionTestResult> getTestResults() {
        return testResults;
    }

    public List<SubmissionEvent> getEvents() {
        return events;
    }

    @Override
    public boolean equals(Object o) {
        return this == o || (o instanceof Submission other && id != null && id.equals(other.id));
    }

    @Override
    public int hashCode() {
        return Submission.class.hashCode();
    }
}
