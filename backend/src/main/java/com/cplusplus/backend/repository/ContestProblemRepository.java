package com.cplusplus.backend.repository;

import com.cplusplus.backend.domain.contest.ContestProblem;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface ContestProblemRepository extends JpaRepository<ContestProblem, ContestProblem.Id> {

    @Query("select cp from ContestProblem cp join fetch cp.problem where cp.contest.id = :contestId order by cp.label")
    List<ContestProblem> findByContestIdOrderByLabel(Long contestId);
}
