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
    private final com.cplusplus.backend.repository.ContestRepository contestRepository;
    private final com.cplusplus.backend.repository.ContestProblemRepository contestProblemRepository;
    private final com.cplusplus.backend.repository.ClassroomRepository classroomRepository;

    public SubmissionController(
            SubmissionRepository submissionRepository,
            JudgeMasterService judgeMasterService,
            com.cplusplus.backend.repository.ContestRepository contestRepository,
            com.cplusplus.backend.repository.ContestProblemRepository contestProblemRepository,
            com.cplusplus.backend.repository.ClassroomRepository classroomRepository) {
        this.submissionRepository = submissionRepository;
        this.judgeMasterService = judgeMasterService;
        this.contestRepository = contestRepository;
        this.contestProblemRepository = contestProblemRepository;
        this.classroomRepository = classroomRepository;
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

        if (req.contestId() != null) {
            var contest = contestRepository.findById(req.contestId())
                    .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy kỳ thi #" + req.contestId()));
            if (!user.isAdmin()) {
                if (!contestRepository.isRegistered(req.contestId(), user.getId())) {
                    return ResponseEntity.status(HttpStatus.FORBIDDEN)
                            .body(Map.of("message", "Bạn chưa đăng ký tham gia kỳ thi này"));
                }
                var phase = contest.phaseAt(java.time.Instant.now());
                if (phase == com.cplusplus.backend.domain.contest.ContestPhase.UPCOMING) {
                    return ResponseEntity.badRequest().body(Map.of("message", "Kỳ thi chưa bắt đầu"));
                }
                if (phase == com.cplusplus.backend.domain.contest.ContestPhase.ENDED) {
                    return ResponseEntity.badRequest().body(Map.of("message", "Kỳ thi đã kết thúc"));
                }
            }
            if (!contestProblemRepository.existsById(new com.cplusplus.backend.domain.contest.ContestProblem.Id(req.contestId(), req.problemId()))) {
                return ResponseEntity.badRequest().body(Map.of("message", "Bài tập #" + req.problemId() + " không thuộc kỳ thi này"));
            }
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
            @RequestParam(required = false) Long classroomId,
            @RequestParam(required = false) String verdict,
            @RequestParam(required = false) Integer page,
            @RequestParam(defaultValue = "50") int size,
            HttpServletRequest servletReq) {

        Verdict v = null;
        if (verdict != null && !verdict.isBlank()) {
            try {
                v = Verdict.valueOf(verdict.toUpperCase());
            } catch (Exception ignored) {}
        }

        int pageNum = page != null ? page : 0;
        Pageable pageable = PageRequest.of(pageNum, Math.min(size, 200));
        String usernameFilter = (userId != null && !userId.isBlank()) ? userId : null;

        User caller = (User) servletReq.getAttribute(AuthInterceptor.CURRENT_USER_ATTR);
        List<SubmissionRepository.Summary> summaries;
        long totalCount = 0;
        boolean isPage = (page != null);

        if (caller != null && caller.isLecturer()) {
            if (classroomId != null) {
                if (!classroomRepository.isLecturerAssigned(classroomId, caller.getId())) {
                    return ResponseEntity.status(HttpStatus.FORBIDDEN)
                            .body(Map.of("message", "Bạn không phụ trách lớp học #" + classroomId));
                }
                summaries = submissionRepository.searchByClassroom(
                        usernameFilter, problemId, contestId, v, classroomId, pageable);
                if (isPage) {
                    totalCount = submissionRepository.countSearchByClassroom(
                            usernameFilter, problemId, contestId, v, classroomId);
                }
            } else {
                List<Long> classroomIds = classroomRepository.findByLecturerUserId(caller.getId())
                        .stream().map(com.cplusplus.backend.domain.classroom.Classroom::getId).toList();
                boolean hasClasses = !classroomIds.isEmpty();
                java.util.Collection<Long> queryClassroomIds = hasClasses ? classroomIds : java.util.List.of(-1L);

                summaries = submissionRepository.searchByLecturer(
                        usernameFilter, problemId, contestId, v, hasClasses, queryClassroomIds, caller.getId(), pageable);
                if (isPage) {
                    totalCount = submissionRepository.countSearchByLecturer(
                            usernameFilter, problemId, contestId, v, hasClasses, queryClassroomIds, caller.getId());
                }
            }
        } else if (classroomId != null) {
            summaries = submissionRepository.searchByClassroom(
                    usernameFilter, problemId, contestId, v, classroomId, pageable);
            if (isPage) {
                totalCount = submissionRepository.countSearchByClassroom(
                        usernameFilter, problemId, contestId, v, classroomId);
            }
        } else {
            summaries = submissionRepository.search(usernameFilter, problemId, contestId, v, pageable);
            if (isPage) {
                totalCount = submissionRepository.countSearch(usernameFilter, problemId, contestId, v);
            }
        }

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
            return ResponseEntity.ok(Map.of("total", totalCount, "submissions", rows));
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
            if (caller.isLecturer()) {
                boolean allowed = submissionRepository.isSubmissionVisibleToLecturer(sub.getId(), caller.getId());
                if (!allowed) {
                    return ResponseEntity.status(HttpStatus.FORBIDDEN)
                            .body(Map.of("message", "Bạn chỉ được xem bài nộp thuộc các lớp phụ trách"));
                }
            } else {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(Map.of("message", "Bạn không có quyền xem bài nộp này"));
            }
        }
        return ResponseEntity.ok(DtoMapper.toSubmissionMap(sub));
    }
}
