package com.cplusplus.backend.controller;

import com.cplusplus.backend.domain.classroom.ClassroomStudent;
import com.cplusplus.backend.domain.problem.Problem;
import com.cplusplus.backend.repository.ClassroomRepository;
import com.cplusplus.backend.repository.ClassroomStudentRepository;
import com.cplusplus.backend.repository.ProblemRepository;
import com.cplusplus.backend.repository.SubmissionRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/leaderboard")
public class LeaderboardController {

    private final SubmissionRepository submissionRepository;
    private final ProblemRepository problemRepository;
    private final ClassroomStudentRepository classroomStudentRepository;
    private final ClassroomRepository classroomRepository;

    public LeaderboardController(SubmissionRepository submissionRepository,
                                 ProblemRepository problemRepository,
                                 ClassroomStudentRepository classroomStudentRepository,
                                 ClassroomRepository classroomRepository) {
        this.submissionRepository = submissionRepository;
        this.problemRepository = problemRepository;
        this.classroomStudentRepository = classroomStudentRepository;
        this.classroomRepository = classroomRepository;
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> getLeaderboard(
            @RequestParam(required = false) Long classroomId) {

        List<Problem> problems = problemRepository.findByDeletedAtIsNullAndPublicVisibleTrueOrderById();
        List<Map<String, Object>> problemList = problems.stream()
                .map(p -> Map.<String, Object>of("id", p.getId(), "title", p.getTitle()))
                .toList();

        List<SubmissionRepository.LeaderboardRow> rawRows = submissionRepository.findLeaderboard();
        List<SubmissionRepository.BestCell> rawCells = submissionRepository.findBestCells();

        // Optionally filter to classroom members
        Set<Long> allowedUserIds = null;
        if (classroomId != null && classroomRepository.existsById(classroomId)) {
            allowedUserIds = classroomStudentRepository.findAllWithUserByClassroomId(classroomId)
                    .stream()
                    .map(cs -> cs.getUser().getId())
                    .collect(Collectors.toSet());
        }

        final Set<Long> filter = allowedUserIds;

        // Gom cells theo userId (filtered)
        Map<Long, Map<String, Object>> cellsByUser = new HashMap<>();
        for (SubmissionRepository.BestCell c : rawCells) {
            if (filter != null && !filter.contains(c.getUserId())) continue;
            cellsByUser.computeIfAbsent(c.getUserId(), k -> new HashMap<>())
                    .put(String.valueOf(c.getProblemId()), Map.of(
                            "best", c.getBestScore(),
                            "tries", c.getTries(),
                            "solved", c.isSolved()
                    ));
        }

        // Re-rank within the filtered set
        long rank = 1;
        List<Map<String, Object>> rows = new ArrayList<>();
        for (SubmissionRepository.LeaderboardRow r : rawRows) {
            if (filter != null && !filter.contains(r.getUserId())) continue;
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("rank", filter != null ? rank++ : r.getRank());
            map.put("userId", r.getUsername());
            map.put("userName", r.getFullName());
            map.put("solved", r.getSolved());
            map.put("score", r.getScore());
            map.put("attempts", r.getAttempts());
            map.put("cells", cellsByUser.getOrDefault(r.getUserId(), Map.of()));
            rows.add(map);
        }

        return ResponseEntity.ok(Map.of(
                "problems", problemList,
                "rows", rows
        ));
    }
}
