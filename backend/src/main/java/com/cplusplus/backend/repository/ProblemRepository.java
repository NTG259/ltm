package com.cplusplus.backend.repository;

import com.cplusplus.backend.domain.problem.Problem;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface ProblemRepository extends JpaRepository<Problem, Long> {

    /** Thống kê cho GET /api/problems (view v_problem_stats). */
    interface Stats {
        Long getProblemId();

        long getTestCount();

        long getTotalSubmissions();

        long getAcceptedSubmissions();

        long getSolvedUsers();
    }

    /** Kho bài cho thí sinh: chưa xóa và công khai. */
    @EntityGraph(attributePaths = "testCases")
    List<Problem> findByDeletedAtIsNullAndPublicVisibleTrueOrderById();

    /** Trang quản trị: mọi đề chưa xóa. */
    List<Problem> findByDeletedAtIsNullOrderById();

    Optional<Problem> findByIdAndDeletedAtIsNull(Long id);

    /** Đề kèm toàn bộ test – dùng khi đóng gói OP_TASK_ASSIGN hoặc admin sửa đề. */
    @EntityGraph(attributePaths = "testCases")
    @Query("select p from Problem p where p.id = :id")
    Optional<Problem> findWithTestCases(Long id);

    @Query(value = """
            select problem_id as problemId, test_count as testCount, total_submissions as totalSubmissions,
                   accepted_submissions as acceptedSubmissions, solved_users as solvedUsers
            from v_problem_stats
            """, nativeQuery = true)
    List<Stats> findAllStats();
}
