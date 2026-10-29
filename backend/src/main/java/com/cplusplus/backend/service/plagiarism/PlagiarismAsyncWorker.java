package com.cplusplus.backend.service.plagiarism;

import com.cplusplus.backend.domain.contest.Contest;
import com.cplusplus.backend.domain.plagiarism.PlagiarismMatch;
import com.cplusplus.backend.domain.plagiarism.PlagiarismReport;
import com.cplusplus.backend.domain.submission.Submission;
import com.cplusplus.backend.domain.worker.LogLevel;
import com.cplusplus.backend.master.service.JudgeMasterService;
import com.cplusplus.backend.repository.PlagiarismMatchRepository;
import com.cplusplus.backend.repository.PlagiarismReportRepository;
import com.cplusplus.backend.repository.SubmissionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Thực thi kiểm tra đạo văn bất đồng bộ trên thread pool riêng.
 * Được gọi từ PlagiarismService sau khi tạo report với status="RUNNING".
 */
@Service
public class PlagiarismAsyncWorker {

    private static final Logger log = LoggerFactory.getLogger(PlagiarismAsyncWorker.class);

    private final SubmissionRepository submissionRepository;
    private final PlagiarismReportRepository reportRepository;
    private final PlagiarismMatchRepository matchRepository;
    private final JudgeMasterService judgeMasterService;

    public PlagiarismAsyncWorker(
            SubmissionRepository submissionRepository,
            PlagiarismReportRepository reportRepository,
            PlagiarismMatchRepository matchRepository,
            JudgeMasterService judgeMasterService) {
        this.submissionRepository = submissionRepository;
        this.reportRepository = reportRepository;
        this.matchRepository = matchRepository;
        this.judgeMasterService = judgeMasterService;
    }

    @Async
    @Transactional
    public void execute(Contest contest, Long reportId) {
        Long contestId = contest.getId();
        log.info("[Plagiarism] Bắt đầu quét kỳ thi #{} (report #{})", contestId, reportId);

        PlagiarismReport report = reportRepository.findById(reportId)
                .orElseThrow(() -> new IllegalStateException("Report #" + reportId + " không tồn tại"));

        try {
            List<Submission> allSubs = submissionRepository.findAllByContestIdWithDetails(contestId);

            // Gom nhóm theo (problemId, language) — chỉ so sánh cùng ngôn ngữ
            Map<String, List<Submission>> groups = allSubs.stream()
                    .filter(s -> s.getSourceCode() != null && !s.getSourceCode().isBlank())
                    .collect(Collectors.groupingBy(
                            s -> s.getProblem().getId() + ":" + (s.getLanguage() != null ? s.getLanguage().code() : "unknown")
                    ));

            List<PlagiarismMatch> detectedMatches = new ArrayList<>();
            int totalConsidered = 0;

            for (List<Submission> group : groups.values()) {
                Map<Long, Submission> bestByUser = new HashMap<>();
                for (Submission s : group) {
                    Long uid = s.getUser().getId();
                    Submission cur = bestByUser.get(uid);
                    if (cur == null) {
                        bestByUser.put(uid, s);
                    } else {
                        int scoreS = s.getScore() != null ? s.getScore() : 0;
                        int scoreCur = cur.getScore() != null ? cur.getScore() : 0;
                        if (scoreS > scoreCur || (scoreS == scoreCur && s.getId() > cur.getId())) {
                            bestByUser.put(uid, s);
                        }
                    }
                }

                List<Submission> candidates = new ArrayList<>(bestByUser.values());
                totalConsidered += candidates.size();

                // Tokenize theo ngôn ngữ
                Map<Long, List<String>> tokenMap = new HashMap<>();
                for (Submission s : candidates) {
                    boolean isCpp = s.getLanguage() == null || "cpp17".equals(s.getLanguage().code());
                    List<String> tokens = isCpp
                            ? CppCodeTokenizer.tokenize(s.getSourceCode())
                            : GenericCodeTokenizer.tokenize(s.getSourceCode());
                    tokenMap.put(s.getId(), tokens);
                }

                int n = candidates.size();
                for (int i = 0; i < n; i++) {
                    for (int j = i + 1; j < n; j++) {
                        Submission subA = candidates.get(i);
                        Submission subB = candidates.get(j);
                        WinnowingEngine.MatchResult res = WinnowingEngine.compare(
                                tokenMap.get(subA.getId()), tokenMap.get(subB.getId()));
                        if (res.similarityScore() >= 50.0) {
                            String level = res.similarityScore() >= 75.0 ? "HIGH_RISK" : "SUSPICIOUS";
                            detectedMatches.add(new PlagiarismMatch(
                                    null, contest, subA.getProblem(), subA, subB,
                                    res.similarityScore(), level, res.matchedFingerprints(), Instant.now()
                            ));
                        }
                    }
                }
            }

            detectedMatches.sort((a, b) -> Double.compare(b.getSimilarityScore(), a.getSimilarityScore()));
            int highRisk = (int) detectedMatches.stream().filter(m -> "HIGH_RISK".equals(m.getVerdictLevel())).count();

            report.setSubmissionCount(totalConsidered);
            report.setSuspiciousCount(detectedMatches.size() - highRisk);
            report.setHighRiskCount(highRisk);
            for (PlagiarismMatch m : detectedMatches) {
                report.addMatch(m);
            }
            report.setStatus("COMPLETED");
            reportRepository.save(report);

            String msg = String.format("[Chống đạo văn] Kỳ thi #%d: Quét %d bài nộp, phát hiện %d cặp (%d nguy cơ cao)",
                    contestId, totalConsidered, detectedMatches.size(), highRisk);
            judgeMasterService.addLog(highRisk > 0 ? LogLevel.WARNING : LogLevel.INFO, msg, null, null);
            log.info("[Plagiarism] Hoàn tất kỳ thi #{}: {}", contestId, msg);

        } catch (Exception ex) {
            log.error("[Plagiarism] Lỗi khi quét kỳ thi #{}", contestId, ex);
            report.setStatus("FAILED");
            reportRepository.save(report);
        }
    }
}
