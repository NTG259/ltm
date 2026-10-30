package com.cplusplus.backend.controller;

import com.cplusplus.backend.domain.problem.Problem;
import com.cplusplus.backend.domain.user.User;
import com.cplusplus.backend.dto.DtoMapper;
import com.cplusplus.backend.repository.ProblemRepository;
import com.cplusplus.backend.repository.ContestProblemRepository;
import com.cplusplus.backend.security.AuthInterceptor;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

import org.springframework.transaction.annotation.Transactional;

@RestController
@RequestMapping("/api/problems")
@Transactional(readOnly = true)
public class ProblemController {

    private final ProblemRepository problemRepository;
    private final ContestProblemRepository contestProblemRepository;

    public ProblemController(ProblemRepository problemRepository, ContestProblemRepository contestProblemRepository) {
        this.problemRepository = problemRepository;
        this.contestProblemRepository = contestProblemRepository;
    }

    @GetMapping
    public ResponseEntity<?> listProblems(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String difficulty,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false, defaultValue = "20") int size,
            HttpServletRequest req) {
        User currentUser = req != null ? (User) req.getAttribute(AuthInterceptor.CURRENT_USER_ATTR) : null;
        boolean isAdmin = currentUser != null && currentUser.isAdminOrLecturer();

        Map<Long, ProblemRepository.Stats> statsMap = problemRepository.findAllStats().stream()
                .collect(Collectors.toMap(ProblemRepository.Stats::getProblemId, s -> s));

        // Paginated mode: client sent a page number (1-indexed)
        if (page != null) {
            String qParam = (q != null && !q.isBlank()) ? q.trim() : null;
            String diffParam = (difficulty != null && !difficulty.isBlank()) ? difficulty : null;
            Page<Problem> paged = problemRepository.searchProblems(
                    isAdmin, qParam, diffParam, PageRequest.of(Math.max(page - 1, 0), Math.min(size, 100)));
            List<Map<String, Object>> rows = paged.getContent().stream().map(p -> buildProblemRow(p, statsMap)).toList();
            return ResponseEntity.ok(Map.of("total", paged.getTotalElements(), "problems", rows));
        }

        // Legacy full-list mode (for admin selectors, contest config, etc.)
        List<Problem> problems = isAdmin
                ? problemRepository.findByDeletedAtIsNullOrderById()
                : problemRepository.findByDeletedAtIsNullAndPublicVisibleTrueOrderById();
        List<Map<String, Object>> result = problems.stream().map(p -> buildProblemRow(p, statsMap)).toList();
        return ResponseEntity.ok(result);
    }

    private Map<String, Object> buildProblemRow(Problem p, Map<Long, ProblemRepository.Stats> statsMap) {
        Map<String, Object> map = DtoMapper.toProblemMap(p, false);
        ProblemRepository.Stats st = statsMap.get(p.getId());
        if (st != null) {
            map.put("totalSubmissions", st.getTotalSubmissions());
            map.put("acceptedSubmissions", st.getAcceptedSubmissions());
            map.put("testCount", st.getTestCount());
        } else {
            map.put("totalSubmissions", 0);
            map.put("acceptedSubmissions", 0);
        }
        return map;
    }

    @GetMapping("/{id}")
    public ResponseEntity<Map<String, Object>> getProblem(@PathVariable Long id, HttpServletRequest req) {
        User currentUser = (User) req.getAttribute(AuthInterceptor.CURRENT_USER_ATTR);
        boolean isAdmin = currentUser != null && currentUser.isAdminOrLecturer();

        Problem problem = problemRepository.findWithTestCases(id)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy bài tập #" + id));

        boolean owner = currentUser != null && problem.getCreatedBy() != null
                && problem.getCreatedBy().getId().equals(currentUser.getId());
        boolean participant = currentUser != null
                && contestProblemRepository.isUsedByParticipatingContest(id, currentUser.getId());
        if (!problem.isPublicVisible() && !isAdmin && !owner && !participant) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(DtoMapper.toProblemMap(problem, isAdmin || owner));
    }
}
