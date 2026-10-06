package com.cplusplus.backend.controller;

import com.cplusplus.backend.domain.contest.Contest;
import com.cplusplus.backend.domain.problem.Difficulty;
import com.cplusplus.backend.domain.problem.Problem;
import com.cplusplus.backend.domain.problem.TestCase;
import com.cplusplus.backend.domain.user.User;
import com.cplusplus.backend.domain.worker.SystemLog;
import com.cplusplus.backend.dto.DtoMapper;
import com.cplusplus.backend.master.service.JudgeMasterService;
import com.cplusplus.backend.repository.ContestRepository;
import com.cplusplus.backend.repository.ProblemRepository;
import com.cplusplus.backend.repository.SubmissionRepository;
import com.cplusplus.backend.repository.SystemLogRepository;
import com.cplusplus.backend.security.AuthInterceptor;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;
import java.time.Instant;
import java.util.*;

@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private final JudgeMasterService judgeMasterService;
    private final SubmissionRepository submissionRepository;
    private final ProblemRepository problemRepository;
    private final ContestRepository contestRepository;
    private final SystemLogRepository systemLogRepository;

    public AdminController(
            JudgeMasterService judgeMasterService,
            SubmissionRepository submissionRepository,
            ProblemRepository problemRepository,
            ContestRepository contestRepository,
            SystemLogRepository systemLogRepository) {
        this.judgeMasterService = judgeMasterService;
        this.submissionRepository = submissionRepository;
        this.problemRepository = problemRepository;
        this.contestRepository = contestRepository;
        this.systemLogRepository = systemLogRepository;
    }

    private void requireAdmin(HttpServletRequest req) {
        User user = (User) req.getAttribute(AuthInterceptor.CURRENT_USER_ATTR);
        if (user == null || !user.isAdmin()) {
            throw new IllegalArgumentException("Yêu cầu quyền quản trị viên");
        }
    }

    @GetMapping("/overview")
    public ResponseEntity<?> overview(HttpServletRequest req) {
        requireAdmin(req);

        List<Map<String, Object>> workers = judgeMasterService.getWorkerSummaries();
        List<Long> queue = judgeMasterService.getQueue();
        long subCount = submissionRepository.count();

        List<SystemLog> dbLogs = systemLogRepository.findTop200ByOrderByCreatedAtDesc();
        List<Map<String, Object>> logs = dbLogs.stream().map(l -> {
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("id", l.getId());
            map.put("time", l.getCreatedAt().toEpochMilli());
            map.put("level", l.getLevel().code());
            map.put("message", l.getMessage());
            return map;
        }).toList();

        return ResponseEntity.ok(Map.of(
                "workers", workers,
                "queue", queue,
                "submissions", subCount,
                "logs", logs
        ));
    }

    @PostMapping("/workers/{id}/disconnect")
    public ResponseEntity<?> disconnectWorker(@PathVariable String id, HttpServletRequest req) {
        requireAdmin(req);
        judgeMasterService.disconnectWorker(id);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/problems/{id}")
    @Transactional
    public ResponseEntity<?> deleteProblem(@PathVariable Long id, HttpServletRequest req) {
        requireAdmin(req);
        Problem p = problemRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy bài tập #" + id));
        p.softDelete(Instant.now());
        problemRepository.save(p);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/contests/{id}")
    @Transactional
    public ResponseEntity<?> deleteContest(@PathVariable Long id, HttpServletRequest req) {
        requireAdmin(req);
        contestRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}
