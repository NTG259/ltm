package com.cplusplus.backend.repository;

import com.cplusplus.backend.domain.submission.Submission;
import com.cplusplus.backend.domain.submission.Verdict;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface SubmissionRepository extends JpaRepository<Submission, Long> {

    /** Dòng của GET /api/submissions: không kèm mã nguồn, kết quả test và lịch sử. */
    interface Summary {
        Long getId();

        Long getProblemId();

        String getProblemTitle();

        Long getContestId();

        String getUsername();

        String getUserFullName();

        String getStatus();

        Verdict getVerdict();

        Short getScore();

        Integer getTimeMs();

        Integer getMemoryKb();

        String getWorkerId();

        short getAttempts();

        Instant getCreatedAt();
    }

    /** Dòng bảng xếp hạng chung (view v_leaderboard). */
    interface LeaderboardRow {
        long getRank();

        Long getUserId();

        String getUsername();

        String getFullName();

        long getSolved();

        long getScore();

        long getAttempts();
    }

    /** Ô (thí sinh, bài) của bảng xếp hạng chung (view v_user_problem_best). */
    interface BestCell {
        Long getUserId();

        Long getProblemId();

        int getBestScore();

        long getTries();

        boolean isSolved();
    }

    /** Khôi phục hàng đợi FIFO khi Master khởi động lại (dùng chỉ mục ix_submissions_pending). */
    @Query(value = """
            select id from submissions
            where status in ('IN_QUEUE', 'COMPILING', 'TESTING')
            order by id
            """, nativeQuery = true)
    List<Long> findPendingIdsInQueueOrder();

    /** Bài nộp đầy đủ để gửi OP_TASK_ASSIGN / trang chi tiết. */
    @EntityGraph(attributePaths = {"user", "problem", "contest", "worker"})
    @Query("select s from Submission s where s.id = :id")
    Optional<Submission> findDetailed(Long id);

    /**
     * GET /api/submissions?userId=&problemId=&contestId=&verdict= ; tham số null = bỏ lọc.
     * {@code cast(:username as string)}: không ép kiểu thì PostgreSQL suy tham số null là bytea.
     */
    @Query("""
            select s.id as id, p.id as problemId, p.title as problemTitle, s.contest.id as contestId,
                   u.username as username, u.fullName as userFullName, cast(s.status as string) as status,
                   s.verdict as verdict, s.score as score, s.timeMs as timeMs, s.memoryKb as memoryKb,
                   s.worker.id as workerId, s.attempts as attempts, s.createdAt as createdAt
            from Submission s join s.user u join s.problem p
            where (:username is null or upper(u.username) = upper(cast(:username as string)))
              and (:problemId is null or p.id = :problemId)
              and (:contestId is null or s.contest.id = :contestId)
              and (:verdict is null or s.verdict = :verdict)
            order by s.id desc
            """)
    List<Summary> search(String username, Long problemId, Long contestId, Verdict verdict, Pageable page);

    @Query(value = """
            select rank, user_id as userId, username, full_name as fullName, solved, score, attempts
            from v_leaderboard order by rank, username
            """, nativeQuery = true)
    List<LeaderboardRow> findLeaderboard();

    @Query(value = """
            select user_id as userId, problem_id as problemId, best_score as bestScore, tries, solved
            from v_user_problem_best
            """, nativeQuery = true)
    List<BestCell> findBestCells();
}
