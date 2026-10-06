package com.cplusplus.backend.repository;

import com.cplusplus.backend.domain.contest.Contest;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface ContestRepository extends JpaRepository<Contest, Long> {

    /** Một dòng bảng xếp hạng ICPC (view v_contest_standings). */
    interface StandingRow {
        long getRank();

        Long getUserId();

        String getUsername();

        String getFullName();

        long getSolved();

        long getPenalty();
    }

    /** Một ô (thí sinh, bài) của bảng ICPC (view v_contest_cells). */
    interface StandingCell {
        Long getUserId();

        Long getProblemId();

        String getLabel();

        boolean isSolved();

        long getWrong();

        long getPending();

        Integer getSolveMinute();

        boolean isFirstSolve();
    }

    List<Contest> findAllByOrderByStartAtDesc();

    @EntityGraph(attributePaths = {"problems", "problems.problem"})
    @Query("select c from Contest c where c.id = :id")
    Optional<Contest> findWithProblems(Long id);

    @Query("select count(p) > 0 from ContestParticipant p where p.contest.id = :contestId and p.user.id = :userId")
    boolean isRegistered(Long contestId, Long userId);

    @Query("select count(p) from ContestParticipant p where p.contest.id = :contestId")
    long countParticipants(Long contestId);

    @Query(value = """
            select rank, user_id as userId, username, full_name as fullName, solved, penalty
            from v_contest_standings where contest_id = :contestId
            order by rank, username
            """, nativeQuery = true)
    List<StandingRow> findStandings(Long contestId);

    @Query(value = """
            select user_id as userId, problem_id as problemId, label, solved, wrong, pending,
                   solve_minute as solveMinute, first_solve as firstSolve
            from v_contest_cells where contest_id = :contestId
            """, nativeQuery = true)
    List<StandingCell> findStandingCells(Long contestId);
}
