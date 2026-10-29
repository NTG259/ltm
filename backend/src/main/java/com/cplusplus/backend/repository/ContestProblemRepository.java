package com.cplusplus.backend.repository;

import com.cplusplus.backend.domain.contest.ContestProblem;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ContestProblemRepository extends JpaRepository<ContestProblem, ContestProblem.Id> {

    @Query("select cp from ContestProblem cp join fetch cp.problem where cp.contest.id = :contestId order by cp.label")
    List<ContestProblem> findByContestIdOrderByLabel(Long contestId);

    @Query("select count(cp) > 0 from ContestProblem cp join ContestParticipant participant " +
           "on participant.contest.id = cp.contest.id where cp.problem.id = :problemId and participant.user.id = :userId")
    boolean isUsedByParticipatingContest(@Param("problemId") Long problemId, @Param("userId") Long userId);
}
