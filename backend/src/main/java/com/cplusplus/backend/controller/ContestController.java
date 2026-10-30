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
    private final com.cplusplus.backend.repository.ClassroomRepository classroomRepository;
    private final com.cplusplus.backend.repository.ClassroomContestRepository classroomContestRepository;

    public ContestController(
            ContestRepository contestRepository,
            ContestParticipantRepository contestParticipantRepository,
            ContestViolationRepository contestViolationRepository,
            JudgeMasterService judgeMasterService,
            PlagiarismService plagiarismService,
            com.cplusplus.backend.repository.ClassroomRepository classroomRepository,
            com.cplusplus.backend.repository.ClassroomContestRepository classroomContestRepository) {
        this.contestRepository = contestRepository;
        this.contestParticipantRepository = contestParticipantRepository;
        this.contestViolationRepository = contestViolationRepository;
        this.judgeMasterService = judgeMasterService;
        this.plagiarismService = plagiarismService;
        this.classroomRepository = classroomRepository;
        this.classroomContestRepository = classroomContestRepository;
    }

    private boolean isContestManager(Contest contest, User user) {
        if (user == null) return false;
        if (user.isAdmin()) return true;
        if (user.isLecturer()) {
            if (contest.getCreatedBy() != null && contest.getCreatedBy().getId().equals(user.getId())) {
                return true;
            }
            var assigned = classroomContestRepository.findByContestId(contest.getId());
            for (var cc : assigned) {
                if (classroomRepository.isLecturerAssigned(cc.getId().getClassroomId(), user.getId())) {
                    return true;
                }
            }
        }
        return false;
    }

    public record ViolationRequest(String violationType, String details) {}

    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> listContests(HttpServletRequest req) {
        User currentUser = (User) req.getAttribute(AuthInterceptor.CURRENT_USER_ATTR);
        List<Contest> list = contestRepository.findAllByOrderByStartAtDesc();

        List<Map<String, Object>> result = list.stream()
                .filter(c -> canViewContest(c, currentUser))
                .map(c -> toContestMap(c, currentUser)).toList();
        return ResponseEntity.ok(result);
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getContest(@PathVariable Long id, HttpServletRequest req) {
        User currentUser = (User) req.getAttribute(AuthInterceptor.CURRENT_USER_ATTR);
        Contest contest = contestRepository.findWithProblems(id)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy kỳ thi #" + id));

        if (!canViewContest(contest, currentUser)) return ResponseEntity.notFound().build();
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

        if (!canViewContest(contest, currentUser)) return ResponseEntity.notFound().build();
        contest.register(currentUser, Instant.now());
        contestRepository.save(contest);

        return ResponseEntity.ok(toContestMap(contest, currentUser));
    }

    @DeleteMapping("/{id}/register")
    @Transactional
    public ResponseEntity<?> unregisterContest(@PathVariable Long id, HttpServletRequest req) {
        User currentUser = (User) req.getAttribute(AuthInterceptor.CURRENT_USER_ATTR);
        if (currentUser == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", "Vui lòng đăng nhập"));
        }

        Contest contest = contestRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy kỳ thi #" + id));

        if (contest.getCreatedBy() != null && contest.getCreatedBy().isLecturer()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Ká»³ thi nÃ y Ä‘Æ°á»£c gÃ¡n theo lá»›p, khÃ´ng thá»ƒ há»§y Ä‘Äƒng kÃ½"));
        }
        if (contest.phaseAt(Instant.now()) != com.cplusplus.backend.domain.contest.ContestPhase.UPCOMING) {
            return ResponseEntity.badRequest().body(Map.of("message", "Chỉ có thể hủy đăng ký khi kỳ thi chưa bắt đầu"));
        }

        contestParticipantRepository.findByContestIdAndUserId(id, currentUser.getId())
                .ifPresent(contestParticipantRepository::delete);

        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/standings")
    public ResponseEntity<?> getStandings(@PathVariable Long id, HttpServletRequest req) {
        Contest contest = contestRepository.findWithProblems(id)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy kỳ thi #" + id));

        User currentUser = (User) req.getAttribute(AuthInterceptor.CURRENT_USER_ATTR);
        if (!canViewContest(contest, currentUser)) return ResponseEntity.notFound().build();
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

    private boolean canViewContest(Contest contest, User user) {
        User owner = contest.getCreatedBy();
        if (owner == null || owner.isAdmin()) return true;
        if (user == null) return false;
        if (user.isAdmin() || owner.getId().equals(user.getId())) return true;
        if (isContestManager(contest, user)) return true;
        return contestRepository.isRegistered(contest.getId(), user.getId());
    }

    private Map<String, Object> toContestMap(Contest c, User user) {
        boolean isStaff = user != null && (user.isAdmin() || isContestManager(c, user));
        boolean isRegistered = user != null && contestRepository.isRegistered(c.getId(), user.getId());
        long participantCount = contestRepository.countParticipants(c.getId());
        return com.cplusplus.backend.dto.DtoMapper.toContestMap(c, isStaff, isRegistered, participantCount);
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

        Contest contest = contestRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy kỳ thi #" + id));
        boolean isManager = isContestManager(contest, currentUser);

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
            if (!isManager && !p.getUser().getId().equals(currentUser.getId())) {
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

        List<Map<String, Object>> recentViolationList = isManager
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
    public ResponseEntity<?> runPlagiarismCheck(@PathVariable Long id, HttpServletRequest servletReq) {
        User currentUser = (User) servletReq.getAttribute(AuthInterceptor.CURRENT_USER_ATTR);
        Contest contest = contestRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy kỳ thi #" + id));
        if (!isContestManager(contest, currentUser)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("message", "Chỉ giảng viên phụ trách hoặc quản trị viên mới có quyền quét đạo văn"));
        }
        // Tạo report RUNNING ngay lập tức, trả về frontend — không chặn HTTP thread
        plagiarismService.runPlagiarismCheck(id);
        return ResponseEntity.ok(plagiarismService.getLatestReportDto(id));
    }

    @GetMapping("/{id}/plagiarism/status")
    public ResponseEntity<?> getPlagiarismStatus(@PathVariable Long id, HttpServletRequest servletReq) {
        User currentUser = (User) servletReq.getAttribute(AuthInterceptor.CURRENT_USER_ATTR);
        Contest contest = contestRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy kỳ thi #" + id));
        if (!isContestManager(contest, currentUser)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("message", "Chỉ giảng viên phụ trách hoặc quản trị viên mới có quyền xem báo cáo đạo văn"));
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
        Contest contest = contestRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy kỳ thi #" + id));
        if (!isContestManager(contest, currentUser)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("message", "Chỉ giảng viên phụ trách hoặc quản trị viên mới có quyền so sánh mã nguồn"));
        }

        return ResponseEntity.ok(plagiarismService.compareSubmissions(subA, subB));
    }
}
