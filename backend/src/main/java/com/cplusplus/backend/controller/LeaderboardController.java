package com.cplusplus.backend.controller;

import com.cplusplus.backend.domain.problem.Problem;
import com.cplusplus.backend.repository.ProblemRepository;
import com.cplusplus.backend.repository.SubmissionRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.*;

@RestController
@RequestMapping("/api/leaderboard")
public class LeaderboardController {

    private final SubmissionRepository submissionRepository;
    private final ProblemRepository problemRepository;

    public LeaderboardController(SubmissionRepository submissionRepository, ProblemRepository problemRepository) {
        this.submissionRepository = submissionRepository;
        this.problemRepository = problemRepository;
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> getLeaderboard() {
        List<Problem> problems = problemRepository.findByDeletedAtIsNullAndPublicVisibleTrueOrderById();
        List<Map<String, Object>> problemList = problems.stream()
                .map(p -> Map.<String, Object>of("id", p.getId(), "title", p.getTitle()))
                .toList();

        List<SubmissionRepository.LeaderboardRow> rawRows = submissionRepository.findLeaderboard();
        List<SubmissionRepository.BestCell> rawCells = submissionRepository.findBestCells();

        // Gom cells theo userId
        Map<Long, Map<String, Object>> cellsByUser = new HashMap<>();
        for (SubmissionRepository.BestCell c : rawCells) {
            cellsByUser.computeIfAbsent(c.getUserId(), k -> new HashMap<>())
                    .put(String.valueOf(c.getProblemId()), Map.of(
                            "best", c.getBestScore(),
                            "tries", c.getTries(),
                            "solved", c.isSolved()
                    ));
        }

        List<Map<String, Object>> rows = rawRows.stream().map(r -> {
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("rank", r.getRank());
            map.put("userId", r.getUsername());
            map.put("userName", r.getFullName());
            map.put("solved", r.getSolved());
            map.put("score", r.getScore());
            map.put("attempts", r.getAttempts());
            map.put("cells", cellsByUser.getOrDefault(r.getUserId(), Map.of()));
            return map;
        }).toList();

        return ResponseEntity.ok(Map.of(
                "problems", problemList,
                "rows", rows
        ));
    }
}
