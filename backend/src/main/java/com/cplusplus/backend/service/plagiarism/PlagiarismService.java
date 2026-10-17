package com.cplusplus.backend.service.plagiarism;

import com.cplusplus.backend.domain.contest.Contest;
import com.cplusplus.backend.domain.plagiarism.PlagiarismMatch;
import com.cplusplus.backend.domain.plagiarism.PlagiarismReport;
import com.cplusplus.backend.domain.submission.Submission;
import com.cplusplus.backend.domain.worker.LogLevel;
import com.cplusplus.backend.master.service.JudgeMasterService;
import com.cplusplus.backend.repository.ContestRepository;
import com.cplusplus.backend.repository.PlagiarismMatchRepository;
import com.cplusplus.backend.repository.PlagiarismReportRepository;
import com.cplusplus.backend.repository.SubmissionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class PlagiarismService {

    private final ContestRepository contestRepository;
    private final SubmissionRepository submissionRepository;
    private final PlagiarismReportRepository reportRepository;
    private final PlagiarismMatchRepository matchRepository;
    private final JudgeMasterService judgeMasterService;

    public PlagiarismService(
            ContestRepository contestRepository,
            SubmissionRepository submissionRepository,
            PlagiarismReportRepository reportRepository,
            PlagiarismMatchRepository matchRepository,
            JudgeMasterService judgeMasterService) {
        this.contestRepository = contestRepository;
        this.submissionRepository = submissionRepository;
        this.reportRepository = reportRepository;
        this.matchRepository = matchRepository;
        this.judgeMasterService = judgeMasterService;
    }

    @Transactional
    public PlagiarismReport runPlagiarismCheck(Long contestId) {
        Contest contest = contestRepository.findById(contestId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy kỳ thi #" + contestId));

        List<Submission> allSubs = submissionRepository.findAllByContestIdWithDetails(contestId);

        // Gom nhóm theo problem_id
        Map<Long, List<Submission>> subsByProblem = allSubs.stream()
                .filter(s -> s.getSourceCode() != null && !s.getSourceCode().isBlank())
                .collect(Collectors.groupingBy(s -> s.getProblem().getId()));

        List<PlagiarismMatch> detectedMatches = new ArrayList<>();
        int totalSubmissionsConsidered = 0;

        for (Map.Entry<Long, List<Submission>> entry : subsByProblem.entrySet()) {
            List<Submission> problemSubs = entry.getValue();

            // Với mỗi thí sinh, chọn bài nộp tốt nhất (điểm cao nhất, nếu bằng nhau chọn bài sau)
            Map<Long, Submission> bestSubByUser = new HashMap<>();
            for (Submission s : problemSubs) {
                Long uid = s.getUser().getId();
                Submission current = bestSubByUser.get(uid);
                if (current == null) {
                    bestSubByUser.put(uid, s);
                } else {
                    int scoreS = s.getScore() != null ? s.getScore() : 0;
                    int scoreCur = current.getScore() != null ? current.getScore() : 0;
                    if (scoreS > scoreCur || (scoreS == scoreCur && s.getId() > current.getId())) {
                        bestSubByUser.put(uid, s);
                    }
                }
            }

            List<Submission> candidates = new ArrayList<>(bestSubByUser.values());
            totalSubmissionsConsidered += candidates.size();

            // Tiền xử lý token hóa
            Map<Long, List<String>> tokenMap = new HashMap<>();
            for (Submission s : candidates) {
                tokenMap.put(s.getId(), CppCodeTokenizer.tokenize(s.getSourceCode()));
            }

            // So sánh từng cặp (O(N^2))
            int n = candidates.size();
            for (int i = 0; i < n; i++) {
                for (int j = i + 1; j < n; j++) {
                    Submission subA = candidates.get(i);
                    Submission subB = candidates.get(j);

                    List<String> tokensA = tokenMap.get(subA.getId());
                    List<String> tokensB = tokenMap.get(subB.getId());

                    WinnowingEngine.MatchResult res = WinnowingEngine.compare(tokensA, tokensB);

                    // Ngưỡng phát hiện nghi vấn: >= 50.0%
                    if (res.similarityScore() >= 50.0) {
                        String level = res.similarityScore() >= 75.0 ? "HIGH_RISK" : "SUSPICIOUS";
                        PlagiarismMatch match = new PlagiarismMatch(
                                null, // Sẽ gắn report sau
                                contest,
                                subA.getProblem(),
                                subA,
                                subB,
                                res.similarityScore(),
                                level,
                                res.matchedFingerprints(),
                                Instant.now()
                        );
                        detectedMatches.add(match);
                    }
                }
            }
        }

        // Sắp xếp các match theo độ tương đồng giảm dần
        detectedMatches.sort((a, b) -> Double.compare(b.getSimilarityScore(), a.getSimilarityScore()));

        int highRiskCount = (int) detectedMatches.stream().filter(m -> "HIGH_RISK".equals(m.getVerdictLevel())).count();
        int suspiciousCount = detectedMatches.size() - highRiskCount;

        PlagiarismReport report = new PlagiarismReport(
                contest,
                totalSubmissionsConsidered,
                suspiciousCount,
                highRiskCount,
                Instant.now()
        );

        for (PlagiarismMatch m : detectedMatches) {
            report.addMatch(m);
        }

        PlagiarismReport savedReport = reportRepository.save(report);

        // Ghi log cảnh báo hệ thống
        String logMsg = String.format("[Chống đạo văn] Kỳ thi #%d: Quét %d bài nộp, phát hiện %d cặp trùng lặp (%d nguy cơ cao)",
                contestId, totalSubmissionsConsidered, detectedMatches.size(), highRiskCount);
        judgeMasterService.addLog(
                highRiskCount > 0 ? LogLevel.WARNING : LogLevel.INFO,
                logMsg,
                null,
                null
        );

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
