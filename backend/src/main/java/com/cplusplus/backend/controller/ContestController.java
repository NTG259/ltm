package com.cplusplus.backend.controller;

import com.cplusplus.backend.domain.contest.Contest;
import com.cplusplus.backend.domain.contest.ContestProblem;
import com.cplusplus.backend.domain.user.User;
import com.cplusplus.backend.repository.ContestRepository;
import com.cplusplus.backend.security.AuthInterceptor;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import com.cplusplus.backend.domain.contest.ContestParticipant;
import com.cplusplus.backend.domain.contest.ContestViolation;
import com.cplusplus.backend.domain.worker.LogLevel;
import com.cplusplus.backend.master.service.JudgeMasterService;
import com.cplusplus.backend.repository.ContestParticipantRepository;
import com.cplusplus.backend.repository.ContestViolationRepository;
import com.cplusplus.backend.service.plagiarism.PlagiarismService;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.*;

@RestController
@RequestMapping("/api/contests")
@Transactional(readOnly = true)
public class ContestController {

    private final ContestRepository contestRepository;
    private final ContestParticipantRepository contestParticipantRepository;
    private final ContestViolationRepository contestViolationRepository;
    private final JudgeMasterService judgeMasterService;
    private final PlagiarismService plagiarismService;

    public ContestController(
            ContestRepository contestRepository,
            ContestParticipantRepository contestParticipantRepository,
            ContestViolationRepository contestViolationRepository,
            JudgeMasterService judgeMasterService,
            PlagiarismService plagiarismService) {
        this.contestRepository = contestRepository;
        this.contestParticipantRepository = contestParticipantRepository;
        this.contestViolationRepository = contestViolationRepository;
        this.judgeMasterService = judgeMasterService;
        this.plagiarismService = plagiarismService;
    }

    public record ViolationRequest(String violationType, String details) {}

    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> listContests(HttpServletRequest req) {
        User currentUser = (User) req.getAttribute(AuthInterceptor.CURRENT_USER_ATTR);
        List<Contest> list = contestRepository.findAllByOrderByStartAtDesc();

        List<Map<String, Object>> result = list.stream().map(c -> toContestMap(c, currentUser)).toList();
        return ResponseEntity.ok(result);
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getContest(@PathVariable Long id, HttpServletRequest req) {
        User currentUser = (User) req.getAttribute(AuthInterceptor.CURRENT_USER_ATTR);
        Contest contest = contestRepository.findWithProblems(id)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy kỳ thi #" + id));

        return ResponseEntity.ok(toContestMap(contest, currentUser));
    }

    @PostMapping("/{id}/register")
    @Transactional
    public ResponseEntity<?> registerContest(@PathVariable Long id, HttpServletRequest req) {
        User currentUser = (User) req.getAttribute(AuthInterceptor.CURRENT_USER_ATTR);
        if (currentUser == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", "Vui lòng đăng nhập trước khi đăng ký thi"));
        }

        Contest contest = contestRepository.findWithProblems(id)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy kỳ thi #" + id));

        contest.register(currentUser, Instant.now());
        contestRepository.save(contest);

        return ResponseEntity.ok(toContestMap(contest, currentUser));
    }

    @GetMapping("/{id}/standings")
    public ResponseEntity<?> getStandings(@PathVariable Long id) {
        Contest contest = contestRepository.findWithProblems(id)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy kỳ thi #" + id));

        List<String> labels = contest.getProblems().stream().map(ContestProblem::getLabel).toList();
        List<ContestRepository.StandingRow> rows = contestRepository.findStandings(id);
        List<ContestRepository.StandingCell> cells = contestRepository.findStandingCells(id);

        Map<Long, Map<String, Object>> cellMapByUser = new HashMap<>();
        for (ContestRepository.StandingCell c : cells) {
            cellMapByUser.computeIfAbsent(c.getUserId(), k -> new HashMap<>())
                    .put(c.getLabel(), Map.of(
                            "solved", c.isSolved(),
                            "wrong", c.getWrong(),
                            "pending", c.getPending(),
                            "minute", c.getSolveMinute() != null ? c.getSolveMinute() : 0,
                            "first", c.isFirstSolve()
                    ));
        }

        List<Map<String, Object>> standingRows = rows.stream().map(r -> {
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("rank", r.getRank());
            map.put("userId", r.getUsername());
            map.put("userName", r.getFullName());
            map.put("solved", r.getSolved());
            map.put("penalty", r.getPenalty());
            map.put("cells", cellMapByUser.getOrDefault(r.getUserId(), Map.of()));
            return map;
        }).toList();

        return ResponseEntity.ok(Map.of(
                "labels", labels,
                "penaltyPerWrong", 20,
                "rows", standingRows
        ));
    }

    private Map<String, Object> toContestMap(Contest c, User user) {
        boolean isAdmin = user != null && user.isAdmin();
        boolean isRegistered = user != null && contestRepository.isRegistered(c.getId(), user.getId());
        long participantCount = contestRepository.countParticipants(c.getId());
        return com.cplusplus.backend.dto.DtoMapper.toContestMap(c, isAdmin, isRegistered, participantCount);
    }

    @PostMapping("/{id}/proctor/violation")
    @Transactional
    public ResponseEntity<?> reportViolation(
            @PathVariable Long id,
            @RequestBody(required = false) ViolationRequest req,
            HttpServletRequest servletReq) {
        User currentUser = (User) servletReq.getAttribute(AuthInterceptor.CURRENT_USER_ATTR);
        if (currentUser == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", "Vui lòng đăng nhập"));
        }

        Contest contest = contestRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy kỳ thi #" + id));

        ContestParticipant participant = contestParticipantRepository.findByContestIdAndUserId(id, currentUser.getId())
                .orElseThrow(() -> new IllegalStateException("Bạn chưa đăng ký kỳ thi này"));

        Instant now = Instant.now();
        int count = participant.incrementTabSwitch(now);
        contestParticipantRepository.save(participant);

        String type = req != null && req.violationType() != null ? req.violationType() : "TAB_SWITCH";
        String details = req != null && req.details() != null ? req.details() : "Rời màn hình làm bài thi (lần " + count + ")";

        ContestViolation violation = new ContestViolation(contest, currentUser, type, details, now);
        contestViolationRepository.save(violation);

        judgeMasterService.broadcastProctorAlert(
                id,
                currentUser.getUsername(),
                currentUser.getFullName(),
                type,
                count,
                details
        );

        judgeMasterService.addLog(
                LogLevel.WARNING,
                "[Giám sát thi] " + currentUser.getUsername() + " (" + currentUser.getFullName() + ") vi phạm: " + type + " (lần " + count + ")",
                null,
                null
        );

        return ResponseEntity.ok(Map.of(
                "success", true,
                "violationCount", count,
                "violationType", type,
                "timestamp", now.toEpochMilli()
        ));
    }

    @GetMapping("/{id}/proctor/status")
    public ResponseEntity<?> getProctorStatus(@PathVariable Long id, HttpServletRequest servletReq) {
        User currentUser = (User) servletReq.getAttribute(AuthInterceptor.CURRENT_USER_ATTR);
        if (currentUser == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", "Vui lòng đăng nhập"));
        }

        if (!contestRepository.existsById(id)) {
            throw new IllegalArgumentException("Không tìm thấy kỳ thi #" + id);
        }

        boolean isAdmin = currentUser.isAdmin();

        List<ContestParticipant> participants = contestParticipantRepository.findAllWithUserByContestId(id);
        List<ContestViolation> recentViolations = contestViolationRepository.findAllByContestIdWithUser(id);

        Map<Long, List<Map<String, Object>>> violationsByUser = new HashMap<>();
        for (ContestViolation v : recentViolations) {
            violationsByUser.computeIfAbsent(v.getUser().getId(), k -> new ArrayList<>())
                    .add(Map.of(
                            "id", v.getId(),
                            "type", v.getViolationType(),
                            "details", v.getDetails() != null ? v.getDetails() : "",
                            "createdAt", v.getCreatedAt().toEpochMilli()
                    ));
        }

        Set<Long> onlineIds = judgeMasterService.getOnlineUserIds();

        List<Map<String, Object>> participantList = new ArrayList<>();
        for (ContestParticipant p : participants) {
            if (!isAdmin && !p.getUser().getId().equals(currentUser.getId())) {
                continue;
            }
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("userId", p.getUser().getId());
            map.put("username", p.getUser().getUsername());
            map.put("fullName", p.getUser().getFullName());
            map.put("online", onlineIds != null && onlineIds.contains(p.getUser().getId()));
            map.put("tabSwitchCount", p.getTabSwitchCount());
            map.put("lastViolationAt", p.getLastViolationAt() != null ? p.getLastViolationAt().toEpochMilli() : null);
            map.put("registeredAt", p.getRegisteredAt().toEpochMilli());
            map.put("violations", violationsByUser.getOrDefault(p.getUser().getId(), List.of()));
            participantList.add(map);
        }

        List<Map<String, Object>> recentViolationList = isAdmin
                ? recentViolations.stream().limit(50).map(v -> {
                    Map<String, Object> vm = new LinkedHashMap<>();
                    vm.put("id", v.getId());
                    vm.put("username", v.getUser().getUsername());
                    vm.put("fullName", v.getUser().getFullName());
                    vm.put("type", v.getViolationType());
                    vm.put("details", v.getDetails() != null ? v.getDetails() : "");
                    vm.put("createdAt", v.getCreatedAt().toEpochMilli());
                    return vm;
                }).toList()
                : List.of();

        long onlineCount = participantList.stream().filter(p -> Boolean.TRUE.equals(p.get("online"))).count();

        return ResponseEntity.ok(Map.of(
                "contestId", id,
                "participants", participantList,
                "recentViolations", recentViolationList,
                "onlineCount", onlineCount
        ));
    }

    @PostMapping("/{id}/plagiarism/run")
    @Transactional
    public ResponseEntity<?> runPlagiarismCheck(@PathVariable Long id, HttpServletRequest servletReq) {
        User currentUser = (User) servletReq.getAttribute(AuthInterceptor.CURRENT_USER_ATTR);
        if (currentUser == null || !currentUser.isAdmin()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("message", "Chỉ quản trị viên mới có quyền quét đạo văn"));
        }

        plagiarismService.runPlagiarismCheck(id);
        return ResponseEntity.ok(plagiarismService.getLatestReportDto(id));
    }

    @GetMapping("/{id}/plagiarism/status")
    public ResponseEntity<?> getPlagiarismStatus(@PathVariable Long id, HttpServletRequest servletReq) {
        User currentUser = (User) servletReq.getAttribute(AuthInterceptor.CURRENT_USER_ATTR);
        if (currentUser == null || !currentUser.isAdmin()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("message", "Chỉ quản trị viên mới có quyền xem báo cáo đạo văn"));
        }

        return ResponseEntity.ok(plagiarismService.getLatestReportDto(id));
    }

    @GetMapping("/{id}/plagiarism/compare")
    public ResponseEntity<?> compareSubmissions(
            @PathVariable Long id,
            @RequestParam Long subA,
            @RequestParam Long subB,
            HttpServletRequest servletReq) {
        User currentUser = (User) servletReq.getAttribute(AuthInterceptor.CURRENT_USER_ATTR);
        if (currentUser == null || !currentUser.isAdmin()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("message", "Chỉ quản trị viên mới có quyền so sánh mã nguồn"));
        }

        return ResponseEntity.ok(plagiarismService.compareSubmissions(subA, subB));
    }
}
