package com.cplusplus.backend.service.plagiarism;

import com.cplusplus.backend.domain.contest.Contest;
import com.cplusplus.backend.domain.plagiarism.PlagiarismMatch;
import com.cplusplus.backend.domain.plagiarism.PlagiarismReport;
import com.cplusplus.backend.domain.submission.Submission;
import com.cplusplus.backend.repository.ContestRepository;
import com.cplusplus.backend.repository.PlagiarismMatchRepository;
import com.cplusplus.backend.repository.PlagiarismReportRepository;
import com.cplusplus.backend.repository.SubmissionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;

@Service
public class PlagiarismService {

    private final ContestRepository contestRepository;
    private final SubmissionRepository submissionRepository;
    private final PlagiarismReportRepository reportRepository;
    private final PlagiarismMatchRepository matchRepository;
    private final PlagiarismAsyncWorker asyncWorker;

    public PlagiarismService(
            ContestRepository contestRepository,
            SubmissionRepository submissionRepository,
            PlagiarismReportRepository reportRepository,
            PlagiarismMatchRepository matchRepository,
            PlagiarismAsyncWorker asyncWorker) {
        this.contestRepository = contestRepository;
        this.submissionRepository = submissionRepository;
        this.reportRepository = reportRepository;
        this.matchRepository = matchRepository;
        this.asyncWorker = asyncWorker;
    }

    /**
     * Tạo report với status=RUNNING ngay lập tức và khởi chạy phân tích bất đồng bộ.
     * Controller trả về ngay mà không chặn HTTP thread.
     */
    @Transactional
    public PlagiarismReport runPlagiarismCheck(Long contestId) {
        Contest contest = contestRepository.findById(contestId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy kỳ thi #" + contestId));

        PlagiarismReport report = new PlagiarismReport(contest, 0, 0, 0, Instant.now());
        report.setStatus("RUNNING");
        PlagiarismReport savedReport = reportRepository.save(report);

        // Chạy phân tích trên thread pool async (không chặn request thread)
        asyncWorker.execute(contest, savedReport.getId());

        return savedReport;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getLatestReportDto(Long contestId) {
        Optional<PlagiarismReport> opt = reportRepository.findLatestByContestId(contestId);
        if (opt.isEmpty()) {
            return Map.of(
                    "hasReport", false,
                    "contestId", contestId,
                    "matches", List.of()
            );
        }

        PlagiarismReport report = opt.get();
        List<PlagiarismMatch> matches = matchRepository.findAllWithDetailsByReportId(report.getId());

        List<Map<String, Object>> matchDtos = matches.stream().map(m -> {
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("id", m.getId());
            map.put("problemId", m.getProblem().getId());
            map.put("problemTitle", m.getProblem().getTitle());
            map.put("similarityScore", m.getSimilarityScore());
            map.put("verdictLevel", m.getVerdictLevel());
            map.put("matchedFingerprints", m.getMatchedFingerprints());
            map.put("createdAt", m.getCreatedAt().toEpochMilli());

            Submission sa = m.getSubmissionA();
            Submission sb = m.getSubmissionB();

            map.put("submissionA", Map.of(
                    "id", sa.getId(),
                    "username", sa.getUser().getUsername(),
                    "fullName", sa.getUser().getFullName(),
                    "score", sa.getScore() != null ? sa.getScore() : 0,
                    "verdict", sa.getVerdict() != null ? sa.getVerdict().name() : "PENDING",
                    "createdAt", sa.getCreatedAt().toEpochMilli()
            ));

            map.put("submissionB", Map.of(
                    "id", sb.getId(),
                    "username", sb.getUser().getUsername(),
                    "fullName", sb.getUser().getFullName(),
                    "score", sb.getScore() != null ? sb.getScore() : 0,
                    "verdict", sb.getVerdict() != null ? sb.getVerdict().name() : "PENDING",
                    "createdAt", sb.getCreatedAt().toEpochMilli()
            ));

            return map;
        }).toList();

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("hasReport", true);
        res.put("reportId", report.getId());
        res.put("contestId", contestId);
        res.put("status", report.getStatus());
        res.put("submissionCount", report.getSubmissionCount());
        res.put("suspiciousCount", report.getSuspiciousCount());
        res.put("highRiskCount", report.getHighRiskCount());
        res.put("totalMatches", matches.size());
        res.put("createdAt", report.getCreatedAt().toEpochMilli());
        res.put("matches", matchDtos);

        return res;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> compareSubmissions(Long subAId, Long subBId) {
        Submission subA = submissionRepository.findDetailed(subAId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy bài nộp #" + subAId));
        Submission subB = submissionRepository.findDetailed(subBId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy bài nộp #" + subBId));

        List<String> tokensA = CppCodeTokenizer.tokenize(subA.getSourceCode());
        List<String> tokensB = CppCodeTokenizer.tokenize(subB.getSourceCode());
        WinnowingEngine.MatchResult res = WinnowingEngine.compare(tokensA, tokensB);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("similarityScore", res.similarityScore());
        result.put("matchedFingerprints", res.matchedFingerprints());
        result.put("verdictLevel", res.similarityScore() >= 75.0 ? "HIGH_RISK" : res.similarityScore() >= 50.0 ? "SUSPICIOUS" : "NORMAL");

        result.put("submissionA", Map.of(
                "id", subA.getId(),
                "username", subA.getUser().getUsername(),
                "fullName", subA.getUser().getFullName(),
                "score", subA.getScore() != null ? subA.getScore() : 0,
                "verdict", subA.getVerdict() != null ? subA.getVerdict().name() : "PENDING",
                "createdAt", subA.getCreatedAt().toEpochMilli(),
                "sourceCode", subA.getSourceCode()
        ));

        result.put("submissionB", Map.of(
                "id", subB.getId(),
                "username", subB.getUser().getUsername(),
                "fullName", subB.getUser().getFullName(),
                "score", subB.getScore() != null ? subB.getScore() : 0,
                "verdict", subB.getVerdict() != null ? subB.getVerdict().name() : "PENDING",
                "createdAt", subB.getCreatedAt().toEpochMilli(),
                "sourceCode", subB.getSourceCode()
        ));

        return result;
    }
}
