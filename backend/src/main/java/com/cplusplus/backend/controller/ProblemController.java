package com.cplusplus.backend.controller;

import com.cplusplus.backend.domain.problem.Problem;
import com.cplusplus.backend.domain.user.User;
import com.cplusplus.backend.dto.DtoMapper;
import com.cplusplus.backend.repository.ProblemRepository;
import com.cplusplus.backend.security.AuthInterceptor;
import jakarta.servlet.http.HttpServletRequest;
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

    public ProblemController(ProblemRepository problemRepository) {
        this.problemRepository = problemRepository;
    }

    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> listProblems() {
        List<Problem> problems = problemRepository.findByDeletedAtIsNullAndPublicVisibleTrueOrderById();
        Map<Long, ProblemRepository.Stats> statsMap = problemRepository.findAllStats().stream()
                .collect(Collectors.toMap(ProblemRepository.Stats::getProblemId, s -> s));

        List<Map<String, Object>> result = problems.stream().map(p -> {
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
        }).toList();

        return ResponseEntity.ok(result);
    }

    @GetMapping("/{id}")
    public ResponseEntity<Map<String, Object>> getProblem(@PathVariable Long id, HttpServletRequest req) {
        User currentUser = (User) req.getAttribute(AuthInterceptor.CURRENT_USER_ATTR);
        boolean isAdmin = currentUser != null && currentUser.isAdmin();

        Problem problem = problemRepository.findWithTestCases(id)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy bài tập #" + id));

        return ResponseEntity.ok(DtoMapper.toProblemMap(problem, isAdmin));
    }
}
