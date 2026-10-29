package com.cplusplus.backend.controller;

import com.cplusplus.backend.domain.submission.Language;
import com.cplusplus.backend.domain.submission.Submission;
import com.cplusplus.backend.domain.submission.Verdict;
import com.cplusplus.backend.domain.user.User;
import com.cplusplus.backend.dto.DtoMapper;
import com.cplusplus.backend.master.service.JudgeMasterService;
import com.cplusplus.backend.repository.SubmissionRepository;
import com.cplusplus.backend.security.AuthInterceptor;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/submissions")
public class SubmissionController {

    private final SubmissionRepository submissionRepository;
    private final JudgeMasterService judgeMasterService;

    public SubmissionController(SubmissionRepository submissionRepository, JudgeMasterService judgeMasterService) {
        this.submissionRepository = submissionRepository;
        this.judgeMasterService = judgeMasterService;
    }

    public record SubmitRequest(Long problemId, String language, String sourceCode, Long contestId) {}
    public record RunTestRequest(Long problemId, String language, String sourceCode, String input, String expectedOutput) {}

    @GetMapping("/languages")
    public ResponseEntity<List<Map<String, String>>> getLanguages() {
        List<Map<String, String>> langs = Arrays.stream(Language.values())
                .map(l -> Map.of("code", l.code(), "label", l.label()))
                .toList();
        return ResponseEntity.ok(langs);
    }

    @PostMapping("/run")
    public ResponseEntity<?> runTest(@RequestBody RunTestRequest req, HttpServletRequest servletReq) {
        User user = (User) servletReq.getAttribute(AuthInterceptor.CURRENT_USER_ATTR);
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", "Vui lòng đăng nhập để chạy thử"));
        }
        if (req.sourceCode() == null || req.sourceCode().isBlank()) {
            throw new IllegalArgumentException("Mã nguồn không được để trống");
        }
        Map<String, Object> result = judgeMasterService.runCustomTest(
                req.problemId(),
                req.language(),
                req.sourceCode(),
                req.input(),
                req.expectedOutput()
        );
        return ResponseEntity.ok(result);
    }

    @PostMapping
    public ResponseEntity<?> submit(@RequestBody SubmitRequest req, HttpServletRequest servletReq) {
        User user = (User) servletReq.getAttribute(AuthInterceptor.CURRENT_USER_ATTR);
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", "Vui lòng đăng nhập trước khi nộp bài"));
        }

        if (req.problemId() == null) {
            throw new IllegalArgumentException("Thiếu problemId");
        }
        if (req.sourceCode() == null || req.sourceCode().isBlank()) {
            throw new IllegalArgumentException("Mã nguồn không được để trống");
        }

        Submission submission = judgeMasterService.submit(
                user,
                req.problemId(),
                req.contestId(),
                req.sourceCode(),
                req.language() != null ? req.language() : "cpp17"
        );

        return ResponseEntity.ok(DtoMapper.toSubmissionMap(submission));
    }

    @GetMapping
    public ResponseEntity<?> listSubmissions(
            @RequestParam(required = false) String userId,
            @RequestParam(required = false) Long problemId,
            @RequestParam(required = false) Long contestId,
            @RequestParam(required = false) String verdict,
            @RequestParam(required = false) Integer page,
            @RequestParam(defaultValue = "50") int size) {

        Verdict v = null;
        if (verdict != null && !verdict.isBlank()) {
            try {
                v = Verdict.valueOf(verdict.toUpperCase());
            } catch (Exception ignored) {}
        }

        int pageNum = page != null ? page : 0;
        Pageable pageable = PageRequest.of(pageNum, Math.min(size, 200));
        String usernameFilter = (userId != null && !userId.isBlank()) ? userId : null;

        List<SubmissionRepository.Summary> summaries = submissionRepository.search(
                usernameFilter, problemId, contestId, v, pageable);

        List<Map<String, Object>> rows = summaries.stream().map(s -> {
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("id", s.getId());
            map.put("problemId", s.getProblemId());
            map.put("problemTitle", s.getProblemTitle());
            map.put("contestId", s.getContestId());
            map.put("userId", s.getUsername());
            map.put("userName", s.getUserFullName());
            map.put("status", s.getStatus());
            map.put("verdict", s.getVerdict() != null ? s.getVerdict().name() : null);
            map.put("score", s.getScore() != null ? s.getScore().intValue() : 0);
            map.put("timeMs", s.getTimeMs());
            map.put("memoryKb", s.getMemoryKb());
            map.put("workerId", s.getWorkerId());
            map.put("attempts", (int) s.getAttempts());
            map.put("createdAt", s.getCreatedAt().toEpochMilli());
            return map;
        }).toList();

        // Khi page được chỉ định rõ → trả về { total, submissions } cho phân trang phía client
        if (page != null) {
            long total = submissionRepository.countSearch(usernameFilter, problemId, contestId, v);
            return ResponseEntity.ok(Map.of("total", total, "submissions", rows));
        }
        return ResponseEntity.ok(rows);
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getSubmission(@PathVariable Long id, HttpServletRequest servletReq) {
        User caller = (User) servletReq.getAttribute(AuthInterceptor.CURRENT_USER_ATTR);
        if (caller == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", "Vui lòng đăng nhập"));
        }
        Submission sub = submissionRepository.findDetailed(id)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy bài nộp #" + id));

        if (!caller.isAdmin() && !sub.getUser().getId().equals(caller.getId())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("message", "Bạn không có quyền xem bài nộp này"));
        }
        return ResponseEntity.ok(DtoMapper.toSubmissionMap(sub));
    }
}
