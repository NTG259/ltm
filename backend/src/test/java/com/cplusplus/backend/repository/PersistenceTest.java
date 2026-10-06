package com.cplusplus.backend.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.cplusplus.backend.TestcontainersConfiguration;
import com.cplusplus.backend.domain.contest.Contest;
import com.cplusplus.backend.domain.contest.ContestPhase;
import com.cplusplus.backend.domain.problem.Difficulty;
import com.cplusplus.backend.domain.problem.Problem;
import com.cplusplus.backend.domain.problem.TestCase;
import com.cplusplus.backend.domain.submission.Submission;
import com.cplusplus.backend.domain.submission.SubmissionEventType;
import com.cplusplus.backend.domain.submission.SubmissionStatus;
import com.cplusplus.backend.domain.submission.SubmissionTestResult;
import com.cplusplus.backend.domain.submission.TestStatus;
import com.cplusplus.backend.domain.submission.Verdict;
import com.cplusplus.backend.domain.user.User;
import com.cplusplus.backend.domain.user.UserSession;
import com.cplusplus.backend.domain.worker.JudgeWorker;
import com.cplusplus.backend.domain.worker.WorkerStatus;
import jakarta.persistence.EntityManager;
import java.net.InetAddress;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Pageable;
import org.springframework.transaction.annotation.Transactional;

/** Kiểm tra entity + repository trên PostgreSQL thật (mỗi test rollback sau khi chạy). */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
@Transactional
class PersistenceTest {

    @Autowired EntityManager em;
    @Autowired UserRepository users;
    @Autowired UserSessionRepository sessions;
    @Autowired ProblemRepository problems;
    @Autowired ContestRepository contests;
    @Autowired SubmissionRepository submissions;
    @Autowired JudgeWorkerRepository workers;

    Instant now;
    User alice;
    User bob;
    Problem aPlusB;
    JudgeWorker worker1;
    JudgeWorker worker2;

    @BeforeEach
    void setUp() {
        now = Instant.now().truncatedTo(ChronoUnit.MICROS);
        alice = users.save(User.student("b20dccn001", "Nguyễn Văn An"));
        bob = users.save(User.student("B20DCCN014", "Trần Thị Bình"));
        aPlusB = new Problem("A + B Problem", "Tính `a + b`.");
        aPlusB.setDifficulty(Difficulty.EASY);
        aPlusB.setTags(List.of("I/O cơ bản", "Số học"));
        aPlusB.addTestCase("3 5", "8", true);
        aPlusB.addTestCase("-7 10", "3", false);
        problems.save(aPlusB);
        worker1 = workers.save(new JudgeWorker("worker-1", now));
        worker1.onRegister("127.0.0.1:52340", "judge-01", "0.1.0", "g++ 15.2.0", "rlimit+static",
                "{\"workerId\":\"worker-1\",\"languages\":[\"cpp17\"]}", now);
        worker2 = workers.save(new JudgeWorker("worker-2", now));
        em.flush();
    }

    private Submission.Outcome accepted() {
        return new Submission.Outcome(Verdict.AC, 100, 2, 1600, 2, 2, null, null, List.of(
                new SubmissionTestResult.Data((short) 1, TestStatus.AC, 1, 1600, "8\n", null, null, null, null),
                new SubmissionTestResult.Data((short) 2, TestStatus.AC, 2, 1580, "3\n", null, null, null, null)));
    }

    private Submission.Outcome wrongAnswer() {
        return new Submission.Outcome(Verdict.WA, 50, 1, 1600, 1, 2, null, null, List.of(
                new SubmissionTestResult.Data((short) 1, TestStatus.AC, 1, 1600, "8\n", null, null, null, null),
                new SubmissionTestResult.Data((short) 2, TestStatus.WA, 1, 1600, "-17\n", null, null, null,
                        "Đầu ra không khớp đáp án")));
    }

    private Submission judged(User user, Contest contest, Submission.Outcome outcome, Instant at) {
        Submission s = submissions.save(new Submission(user, aPlusB, contest, "int main(){}", at));
        s.assignTo(worker1, at);
        s.updateStatus(SubmissionStatus.COMPILING, at);
        s.updateStatus(SubmissionStatus.TESTING, at);
        s.finish(outcome, at);
        return s;
    }

    @Test
    void userLookupIsCaseInsensitiveAndStudentCodeIsUppercased() {
        assertThat(alice.getUsername()).isEqualTo("B20DCCN001");
        assertThat(users.findByUsernameIgnoreCase("b20dccn001")).contains(alice);
    }

    @Test
    void sessionStoresHashAndInet() throws Exception {
        byte[] hash = java.security.MessageDigest.getInstance("SHA-256").digest("token".getBytes());
        UserSession s = new UserSession(hash, alice, now.plus(Duration.ofHours(8)));
        s.setClientIp(InetAddress.getByName("192.168.1.20"));
        sessions.save(s);
        em.flush();
        em.clear();

        UserSession loaded = sessions.findActive(hash, now).orElseThrow();
        assertThat(loaded.getUser().getUsername()).isEqualTo("B20DCCN001");
        assertThat(loaded.getClientIp().getHostAddress()).isEqualTo("192.168.1.20");
        assertThat(sessions.findActive(hash, now.plus(Duration.ofDays(1)))).isEmpty();
    }

    @Test
    void problemRoundTripsTagsTestsAndWorkerJson() {
        em.clear();
        Problem p = problems.findWithTestCases(aPlusB.getId()).orElseThrow();
        assertThat(p.getTags()).containsExactly("I/O cơ bản", "Số học");
        assertThat(p.getTestCases()).extracting(TestCase::getPosition).containsExactly((short) 1, (short) 2);
        assertThat(p.getSamples()).hasSize(1);
        assertThat(workers.findById("worker-1").orElseThrow().getRegisterPayload()).contains("cpp17");

        // Thay bộ test: đổi chỗ vị trí trong cùng transaction nhờ unique DEFERRABLE.
        p.replaceTestCases(List.of(new TestCase.Data("1 1", "2", true), new TestCase.Data("3 5", "8", false)));
        em.flush();
        assertThat(problems.findAllStats()).anySatisfy(st -> {
            assertThat(st.getProblemId()).isEqualTo(p.getId());
            assertThat(st.getTestCount()).isEqualTo(2);
        });
    }

    @Test
    void softDeletedProblemIsHiddenButSubmissionsKeepIt() {
        Submission s = judged(alice, null, accepted(), now);
        aPlusB.softDelete(now);
        em.flush();
        em.clear();
        assertThat(problems.findByDeletedAtIsNullOrderById()).isEmpty();
        assertThat(submissions.findDetailed(s.getId()).orElseThrow().getProblem().isDeleted()).isTrue();
    }

    @Test
    void submissionLifecycleIsPersistedWithTimeline() {
        Submission s = judged(alice, null, wrongAnswer(), now);
        worker1.onTaskFinished();
        em.flush();
        em.clear();

        Submission loaded = submissions.findDetailed(s.getId()).orElseThrow();
        assertThat(loaded.getId()).isGreaterThanOrEqualTo(1001L);
        assertThat(loaded.getStatus()).isEqualTo(SubmissionStatus.FINISHED);
        assertThat(loaded.getVerdict()).isEqualTo(Verdict.WA);
        assertThat(loaded.getWorker().getId()).isEqualTo("worker-1");
        assertThat(loaded.getTestResults()).extracting(SubmissionTestResult::getStatus)
                .containsExactly(TestStatus.AC, TestStatus.WA);
        assertThat(loaded.getTestResults().get(1).getTestCase().getExpectedOutput()).isEqualTo("3");
        assertThat(loaded.getEvents()).extracting(e -> e.getEvent()).containsExactly(
                SubmissionEventType.IN_QUEUE, SubmissionEventType.ASSIGNED, SubmissionEventType.COMPILING,
                SubmissionEventType.TESTING, SubmissionEventType.FINISHED);
        assertThat(workers.findById("worker-1").orElseThrow().getCompletedCount()).isEqualTo(1);
    }

    @Test
    void failoverRequeuesAtHeadAndFailsAfterThreeAttempts() {
        Submission s = submissions.save(new Submission(alice, aPlusB, null, "int main(){}", now));
        Submission later = submissions.save(new Submission(bob, aPlusB, null, "int main(){}", now));
        s.assignTo(worker1, now);
        s.updateStatus(SubmissionStatus.COMPILING, now);
        assertThat(s.requeue(SubmissionEventType.REQUEUED, "worker-1 mất kết nối", now)).isTrue();
        em.flush();
        // Hàng đợi khôi phục theo thứ tự nộp: bài bị thu hồi vẫn đứng trước bài nộp sau.
        assertThat(submissions.findPendingIdsInQueueOrder()).containsExactly(s.getId(), later.getId());

        s.assignTo(worker2, now);
        assertThat(s.requeue(SubmissionEventType.REJECTED, "worker-2 đang bận", now)).isTrue();
        assertThat(s.getAttempts()).isEqualTo((short) 1); // REJECTED không tính lượt
        s.assignTo(worker2, now);
        assertThat(s.requeue(SubmissionEventType.REQUEUED, "worker-2 mất kết nối", now)).isTrue();
        s.assignTo(worker1, now);
        assertThat(s.requeue(SubmissionEventType.REQUEUED, "worker-1 mất kết nối", now)).isFalse();
        em.flush();

        assertThat(s.getStatus()).isEqualTo(SubmissionStatus.FAILED);
        assertThat(s.getErrorMessage()).contains("Failover");
        assertThat(submissions.findPendingIdsInQueueOrder()).containsExactly(later.getId());
    }

    @Test
    void contestStandingsFollowIcpcRules() {
        Contest c = new Contest("Giữa kỳ", now.minus(Duration.ofMinutes(50)), Duration.ofMinutes(150));
        c.setProblemList(List.of(aPlusB));
        contests.save(c);
        c.register(alice, now.minus(Duration.ofDays(1)));
        c.register(bob, now.minus(Duration.ofDays(1)));
        em.flush();
        assertThat(c.phaseAt(now)).isEqualTo(ContestPhase.RUNNING);
        assertThat(contests.isRegistered(c.getId(), alice.getId())).isTrue();

        judged(alice, c, wrongAnswer(), now.minus(Duration.ofMinutes(40)));   // +20 phút phạt
        judged(alice, c, accepted(), now.minus(Duration.ofMinutes(30)));      // AC phút 20
        judged(bob, c, accepted(), now.minus(Duration.ofMinutes(20)));        // AC phút 30
        em.flush();

        assertThat(contests.findStandings(c.getId()))
                .extracting(ContestRepository.StandingRow::getUsername, ContestRepository.StandingRow::getRank,
                        ContestRepository.StandingRow::getPenalty)
                .containsExactly(
                        org.assertj.core.groups.Tuple.tuple("B20DCCN014", 1L, 30L),
                        org.assertj.core.groups.Tuple.tuple("B20DCCN001", 2L, 40L));
        assertThat(contests.findStandingCells(c.getId()))
                .filteredOn(cell -> cell.getUserId().equals(alice.getId()))
                .singleElement()
                .satisfies(cell -> {
                    assertThat(cell.getLabel()).isEqualTo("A");
                    assertThat(cell.getWrong()).isEqualTo(1);
                    assertThat(cell.isFirstSolve()).isTrue();
                });
    }

    @Test
    void databaseRejectsSubmissionFromUnregisteredUser() {
        Contest c = new Contest("Giữa kỳ", now.minus(Duration.ofMinutes(10)), Duration.ofMinutes(60));
        c.setProblemList(List.of(aPlusB));
        contests.save(c);
        em.flush();

        // Khóa IDENTITY nên INSERT chạy ngay khi save(), trigger từ chối tại đó.
        assertThatThrownBy(() -> submissions.save(new Submission(alice, aPlusB, c, "int main(){}", now)))
                .isInstanceOf(DataIntegrityViolationException.class)
                .hasStackTraceContaining("chưa đăng ký kỳ thi");
    }

    @Test
    void leaderboardAndSearchProjections() {
        judged(alice, null, wrongAnswer(), now);
        judged(alice, null, accepted(), now);
        judged(bob, null, wrongAnswer(), now);
        em.flush();

        assertThat(submissions.findLeaderboard())
                .extracting(SubmissionRepository.LeaderboardRow::getUsername, SubmissionRepository.LeaderboardRow::getScore)
                .containsExactly(
                        org.assertj.core.groups.Tuple.tuple("B20DCCN001", 100L),
                        org.assertj.core.groups.Tuple.tuple("B20DCCN014", 50L));
        assertThat(submissions.findBestCells()).filteredOn(SubmissionRepository.BestCell::isSolved).hasSize(1);

        assertThat(submissions.search(null, null, null, null, Pageable.ofSize(50))).hasSize(3);
        assertThat(submissions.search("b20dccn001", aPlusB.getId(), null, Verdict.AC, Pageable.ofSize(50)))
                .singleElement()
                .satisfies(row -> {
                    assertThat(row.getStatus()).isEqualTo("FINISHED");
                    assertThat(row.getWorkerId()).isEqualTo("worker-1");
                    assertThat(row.getContestId()).isNull();
                });
    }

    @Test
    void markAllWorkersDeadOnMasterStartup() {
        assertThat(workers.markAllDead(now, WorkerStatus.DEAD)).isEqualTo(1);
    }
}
