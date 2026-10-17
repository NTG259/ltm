package com.cplusplus.backend.repository;

import com.cplusplus.backend.domain.plagiarism.PlagiarismMatch;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface PlagiarismMatchRepository extends JpaRepository<PlagiarismMatch, Long> {

    @Query("""
        SELECT m FROM PlagiarismMatch m
        JOIN FETCH m.problem
        JOIN FETCH m.submissionA sa
        JOIN FETCH sa.user
        JOIN FETCH m.submissionB sb
        JOIN FETCH sb.user
        WHERE m.report.id = :reportId
        ORDER BY m.similarityScore DESC
    """)
    List<PlagiarismMatch> findAllWithDetailsByReportId(@Param("reportId") Long reportId);

    @Query("""
        SELECT m FROM PlagiarismMatch m
        JOIN FETCH m.problem
        JOIN FETCH m.submissionA sa
        JOIN FETCH sa.user
        JOIN FETCH m.submissionB sb
        JOIN FETCH sb.user
        WHERE m.contest.id = :contestId
        ORDER BY m.createdAt DESC, m.similarityScore DESC
    """)
    List<PlagiarismMatch> findAllWithDetailsByContestId(@Param("contestId") Long contestId);
}
