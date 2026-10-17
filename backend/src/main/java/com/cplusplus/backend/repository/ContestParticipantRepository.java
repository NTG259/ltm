package com.cplusplus.backend.repository;

import com.cplusplus.backend.domain.contest.ContestParticipant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import java.util.List;
import java.util.Optional;

public interface ContestParticipantRepository extends JpaRepository<ContestParticipant, ContestParticipant.Id> {

    @Query("select p from ContestParticipant p where p.contest.id = :contestId and p.user.id = :userId")
    Optional<ContestParticipant> findByContestIdAndUserId(Long contestId, Long userId);

    @Query("select p from ContestParticipant p join fetch p.user where p.contest.id = :contestId order by p.tabSwitchCount desc, p.registeredAt asc")
    List<ContestParticipant> findAllWithUserByContestId(Long contestId);
}
