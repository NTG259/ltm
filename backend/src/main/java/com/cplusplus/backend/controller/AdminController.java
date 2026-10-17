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
import java.util.stream.Collectors;

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

    public record TestCaseRequest(String input, String output, Boolean sample) {}

    public record ProblemSaveRequest(
            Long id,
            String title,
            String difficulty,
            List<String> tags,
            Integer timeLimitMs,
            Integer memoryLimitMb,
            String statement,
            String inputSpec,
            String outputSpec,
            List<TestCaseRequest> samples,
            List<TestCaseRequest> tests
    ) {}

    public record ContestSaveRequest(
            Long id,
            String title,
            String description,
            Long startAt,
            Integer durationMin,
            List<Long> problemIds
    ) {}

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

    // ---------------------------------------------------- Problem CRUD
    @PostMapping("/problems")
    @Transactional
    public ResponseEntity<?> createProblem(@RequestBody ProblemSaveRequest req, HttpServletRequest servletReq) {
        requireAdmin(servletReq);
        User user = (User) servletReq.getAttribute(AuthInterceptor.CURRENT_USER_ATTR);

        if (req.title() == null || req.title().isBlank()) {
            throw new IllegalArgumentException("Tên đề bài không được để trống");
        }

        Problem problem = new Problem(req.title().trim(), req.statement() != null ? req.statement() : "");
        problem.setCreatedBy(user);
        applyProblemData(problem, req);

        problem = problemRepository.save(problem);
        return ResponseEntity.status(HttpStatus.CREATED).body(DtoMapper.toProblemMap(problem, true));
    }

    @PutMapping("/problems/{id}")
    @Transactional
    public ResponseEntity<?> updateProblem(@PathVariable Long id, @RequestBody ProblemSaveRequest req, HttpServletRequest servletReq) {
        requireAdmin(servletReq);

        Problem problem = problemRepository.findWithTestCases(id)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy bài tập #" + id));

        if (req.title() != null && !req.title().isBlank()) {
            problem.setTitle(req.title().trim());
        }
        applyProblemData(problem, req);

        problem = problemRepository.save(problem);
        return ResponseEntity.ok(DtoMapper.toProblemMap(problem, true));
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

    private void applyProblemData(Problem problem, ProblemSaveRequest req) {
        if (req.statement() != null) {
            problem.setStatement(req.statement());
        }
        if (req.inputSpec() != null) {
            problem.setInputSpec(req.inputSpec());
        }
        if (req.outputSpec() != null) {
            problem.setOutputSpec(req.outputSpec());
        }
        if (req.timeLimitMs() != null && req.timeLimitMs() > 0) {
            problem.setTimeLimitMs(req.timeLimitMs());
        }
        if (req.memoryLimitMb() != null && req.memoryLimitMb() > 0) {
            problem.setMemoryLimitMb(req.memoryLimitMb());
        }
        if (req.tags() != null) {
            problem.setTags(req.tags());
        }
        if (req.difficulty() != null) {
            try {
                problem.setDifficulty(Difficulty.valueOf(req.difficulty().toUpperCase(Locale.ROOT)));
            } catch (Exception ignored) {
            }
        }

        List<TestCase.Data> testData = new ArrayList<>();
        if (req.samples() != null) {
            for (TestCaseRequest tc : req.samples()) {
                if (tc != null && ((tc.input() != null && !tc.input().isBlank()) || (tc.output() != null && !tc.output().isBlank()))) {
                    testData.add(new TestCase.Data(
                            tc.input() != null ? tc.input() : "",
                            tc.output() != null ? tc.output() : "",
                            true
                    ));
                }
            }
        }
        if (req.tests() != null) {
            for (TestCaseRequest tc : req.tests()) {
                if (tc != null && ((tc.input() != null && !tc.input().isBlank()) || (tc.output() != null && !tc.output().isBlank()))) {
                    boolean isSample = Boolean.TRUE.equals(tc.sample());
                    testData.add(new TestCase.Data(
                            tc.input() != null ? tc.input() : "",
                            tc.output() != null ? tc.output() : "",
                            isSample
                    ));
                }
            }
        }
        if (!testData.isEmpty()) {
            problem.replaceTestCases(testData);
        }
    }

    // ---------------------------------------------------- Contest CRUD
    @PostMapping("/contests")
    @Transactional
    public ResponseEntity<?> createContest(@RequestBody ContestSaveRequest req, HttpServletRequest servletReq) {
        requireAdmin(servletReq);
        User user = (User) servletReq.getAttribute(AuthInterceptor.CURRENT_USER_ATTR);

        if (req.title() == null || req.title().isBlank()) {
            throw new IllegalArgumentException("Tên kỳ thi không được để trống");
        }
        if (req.startAt() == null || req.startAt() <= 0) {
            throw new IllegalArgumentException("Thời gian bắt đầu không hợp lệ");
        }
        int durationMin = (req.durationMin() != null && req.durationMin() > 0) ? req.durationMin() : 120;

        Instant startAt = Instant.ofEpochMilli(req.startAt());
        Contest contest = new Contest(req.title().trim(), startAt, Duration.ofMinutes(durationMin));
        contest.setDescription(req.description() != null ? req.description() : "");
        contest.setCreatedBy(user);

        // Save contest first so ID is generated for ContestProblem
        contest = contestRepository.save(contest);

        if (req.problemIds() != null && !req.problemIds().isEmpty()) {
            List<Problem> problems = problemRepository.findAllById(req.problemIds());
            Map<Long, Problem> pMap = problems.stream().collect(Collectors.toMap(Problem::getId, p -> p));
            List<Problem> ordered = req.problemIds().stream()
                    .map(pMap::get)
                    .filter(Objects::nonNull)
                    .toList();
            contest.setProblemList(ordered);
            contest = contestRepository.save(contest);
        }

        judgeMasterService.broadcastContestUpdate(contest.getId());
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(DtoMapper.toContestMap(contest, true, false, 0));
    }

    @PutMapping("/contests/{id}")
    @Transactional
    public ResponseEntity<?> updateContest(@PathVariable Long id, @RequestBody ContestSaveRequest req, HttpServletRequest servletReq) {
        requireAdmin(servletReq);

        Contest contest = contestRepository.findWithProblems(id)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy kỳ thi #" + id));

        if (req.title() != null && !req.title().isBlank()) {
            contest.setTitle(req.title().trim());
        }
        if (req.description() != null) {
            contest.setDescription(req.description());
        }

        Instant startAt = (req.startAt() != null && req.startAt() > 0)
                ? Instant.ofEpochMilli(req.startAt())
                : contest.getStartAt();
        int durationMin = (req.durationMin() != null && req.durationMin() > 0)
                ? req.durationMin()
                : (int) contest.getDurationMinutes();
        contest.reschedule(startAt, Duration.ofMinutes(durationMin));

        if (req.problemIds() != null) {
            List<Problem> problems = problemRepository.findAllById(req.problemIds());
            Map<Long, Problem> pMap = problems.stream().collect(Collectors.toMap(Problem::getId, p -> p));
            List<Problem> ordered = req.problemIds().stream()
                    .map(pMap::get)
                    .filter(Objects::nonNull)
                    .toList();
            contest.setProblemList(ordered);
        }

        contest = contestRepository.save(contest);
        judgeMasterService.broadcastContestUpdate(contest.getId());

        long participantCount = contestRepository.countParticipants(contest.getId());
        return ResponseEntity.ok(DtoMapper.toContestMap(contest, true, false, participantCount));
    }

    @DeleteMapping("/contests/{id}")
    @Transactional
    public ResponseEntity<?> deleteContest(@PathVariable Long id, HttpServletRequest req) {
        requireAdmin(req);
        contestRepository.deleteById(id);
        judgeMasterService.broadcastContestUpdate(id);
        return ResponseEntity.noContent().build();
    }
}
