package com.cplusplus.backend.controller;

import com.cplusplus.backend.domain.contest.Contest;
import com.cplusplus.backend.domain.contest.ContestPhase;
import com.cplusplus.backend.domain.contest.ContestProblem;
import com.cplusplus.backend.domain.problem.Problem;
import com.cplusplus.backend.domain.user.User;
import com.cplusplus.backend.repository.ContestRepository;
import com.cplusplus.backend.repository.ProblemRepository;
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
@RequestMapping("/api/contests")
@Transactional(readOnly = true)
public class ContestController {

    private final ContestRepository contestRepository;
    private final ProblemRepository problemRepository;

    public ContestController(ContestRepository contestRepository, ProblemRepository problemRepository) {
        this.contestRepository = contestRepository;
        this.problemRepository = problemRepository;
    }

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
        Instant now = Instant.now();
        ContestPhase phase = c.phaseAt(now);
        boolean isAdmin = user != null && user.isAdmin();
        boolean isRegistered = user != null && contestRepository.isRegistered(c.getId(), user.getId());
        long participantCount = contestRepository.countParticipants(c.getId());

        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", c.getId());
        map.put("title", c.getTitle());
        map.put("description", c.getDescription());
        map.put("startAt", c.getStartAt().toEpochMilli());
        map.put("endAt", c.getEndAt().toEpochMilli());
        map.put("durationMin", c.getDurationMinutes());
        map.put("status", phase.name());
        map.put("participantCount", participantCount);
        map.put("registered", isRegistered);

        if (isAdmin) {
            List<Long> pids = c.getProblems().stream().map(cp -> cp.getProblem().getId()).toList();
            map.put("problemIds", pids);
        }

        boolean showProblems = phase != ContestPhase.UPCOMING || isAdmin;
        List<Map<String, Object>> problems = new ArrayList<>();
        if (showProblems && c.getProblems() != null) {
            for (ContestProblem cp : c.getProblems()) {
                Problem p = cp.getProblem();
                Map<String, Object> pm = new LinkedHashMap<>();
                pm.put("label", cp.getLabel());
                pm.put("problemId", p.getId());
                pm.put("title", p.getTitle());
                pm.put("timeLimitMs", p.getTimeLimitMs());
                pm.put("memoryLimitMb", p.getMemoryLimitMb());
                pm.put("solvedCount", 0);
                pm.put("attemptCount", 0);
                problems.add(pm);
            }
        }
        map.put("problems", problems);

        return map;
    }
}
