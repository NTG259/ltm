package com.cplusplus.backend.repository;

import com.cplusplus.backend.domain.contest.ContestViolation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import java.util.List;

public interface ContestViolationRepository extends JpaRepository<ContestViolation, Long> {

    @Query("select v from ContestViolation v join fetch v.user where v.contest.id = :contestId order by v.createdAt desc")
    List<ContestViolation> findAllByContestIdWithUser(Long contestId);

    List<ContestViolation> findAllByContestIdAndUserIdOrderByCreatedAtDesc(Long contestId, Long userId);
}
