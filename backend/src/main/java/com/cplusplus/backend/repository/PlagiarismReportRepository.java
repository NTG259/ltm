package com.cplusplus.backend.repository;

import com.cplusplus.backend.domain.plagiarism.PlagiarismReport;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface PlagiarismReportRepository extends JpaRepository<PlagiarismReport, Long> {

    @Query("SELECT r FROM PlagiarismReport r WHERE r.contest.id = :contestId ORDER BY r.createdAt DESC")
    List<PlagiarismReport> findAllByContestId(@Param("contestId") Long contestId);

    @Query("SELECT r FROM PlagiarismReport r WHERE r.contest.id = :contestId ORDER BY r.createdAt DESC LIMIT 1")
    Optional<PlagiarismReport> findLatestByContestId(@Param("contestId") Long contestId);
}
