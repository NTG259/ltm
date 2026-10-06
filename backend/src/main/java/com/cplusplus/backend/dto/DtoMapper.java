package com.cplusplus.backend.dto;

import com.cplusplus.backend.domain.contest.Contest;
import com.cplusplus.backend.domain.problem.Problem;
import com.cplusplus.backend.domain.problem.TestCase;
import com.cplusplus.backend.domain.submission.Submission;
import com.cplusplus.backend.domain.submission.SubmissionEvent;
import com.cplusplus.backend.domain.submission.SubmissionTestResult;

import java.time.Instant;
import java.util.*;

public final class DtoMapper {

    private DtoMapper() {}

    public static Map<String, Object> toSubmissionMap(Submission s) {
        if (s == null) return null;
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", s.getId());
        map.put("contestId", s.getContest() != null ? s.getContest().getId() : null);
        map.put("problemId", s.getProblem().getId());
        map.put("problemTitle", s.getProblem().getTitle());
        map.put("userId", s.getUser().getUsername());
        map.put("userName", s.getUser().getFullName());
        map.put("language", s.getLanguage().code());
        map.put("sourceCode", s.getSourceCode());
        map.put("status", s.getStatus().name());
        map.put("verdict", s.getVerdict() != null ? s.getVerdict().name() : null);
        map.put("score", s.getScore() != null ? s.getScore().intValue() : 0);
        map.put("timeMs", s.getTimeMs());
        map.put("memoryKb", s.getMemoryKb());
        map.put("workerId", s.getWorker() != null ? s.getWorker().getId() : null);
        map.put("attempts", (int) s.getAttempts());
        map.put("createdAt", s.getCreatedAt().toEpochMilli());

        Map<String, Object> progress = new HashMap<>();
        progress.put("current", s.getPassedTests() != null ? s.getPassedTests().intValue() : 0);
        progress.put("total", s.getTotalTests() != null ? s.getTotalTests().intValue() : 0);
        map.put("progress", progress);

        List<Map<String, Object>> tests = new ArrayList<>();
        if (s.getTestResults() != null) {
            for (SubmissionTestResult tr : s.getTestResults()) {
                Map<String, Object> tm = new LinkedHashMap<>();
                tm.put("index", (int) tr.getTestIndex());
                tm.put("status", tr.getStatus() != null ? tr.getStatus().name() : "SKIPPED");
                tm.put("timeMs", tr.getTimeMs());
                tm.put("memoryKb", tr.getMemoryKb());
                tm.put("output", tr.getOutputPreview());
                tm.put("stderr", tr.getStderrPreview());
                if (tr.getTestCase() != null) {
                    tm.put("input", tr.getTestCase().getInput());
                    tm.put("expected", tr.getTestCase().getExpectedOutput());
                }
                tests.add(tm);
            }
        }
        map.put("tests", tests);

        map.put("compileLog", s.getCompileLog());
        map.put("securityMessage", s.getSecurityMessage());

        List<Map<String, Object>> history = new ArrayList<>();
        if (s.getEvents() != null) {
            for (SubmissionEvent ev : s.getEvents()) {
                Map<String, Object> em = new LinkedHashMap<>();
                em.put("time", ev.getCreatedAt().toEpochMilli());
                em.put("status", ev.getEvent().name());
                em.put("workerId", ev.getWorker() != null ? ev.getWorker().getId() : null);
                em.put("note", ev.getNote());
                history.add(em);
            }
        }
        map.put("history", history);

        return map;
    }

    public static Map<String, Object> toSubmissionSummaryMap(Submission s) {
        if (s == null) return null;
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", s.getId());
        map.put("contestId", s.getContest() != null ? s.getContest().getId() : null);
        map.put("problemId", s.getProblem().getId());
        map.put("problemTitle", s.getProblem().getTitle());
        map.put("userId", s.getUser().getUsername());
        map.put("userName", s.getUser().getFullName());
        map.put("status", s.getStatus().name());
        map.put("verdict", s.getVerdict() != null ? s.getVerdict().name() : null);
        map.put("score", s.getScore() != null ? s.getScore().intValue() : 0);
        map.put("timeMs", s.getTimeMs());
        map.put("memoryKb", s.getMemoryKb());
        map.put("workerId", s.getWorker() != null ? s.getWorker().getId() : null);
        map.put("attempts", (int) s.getAttempts());
        map.put("createdAt", s.getCreatedAt().toEpochMilli());
        return map;
    }

    public static Map<String, Object> toProblemMap(Problem p, boolean includeTests) {
        if (p == null) return null;
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", p.getId());
        map.put("title", p.getTitle());
        map.put("difficulty", p.getDifficulty().code());
        map.put("tags", p.getTags() != null ? p.getTags() : List.of());
        map.put("timeLimitMs", p.getTimeLimitMs());
        map.put("memoryLimitMb", p.getMemoryLimitMb());
        map.put("statement", p.getStatement());
        map.put("inputSpec", p.getInputSpec());
        map.put("outputSpec", p.getOutputSpec());

        List<Map<String, Object>> samples = new ArrayList<>();
        List<Map<String, Object>> allTests = new ArrayList<>();

        if (p.getTestCases() != null) {
            for (TestCase tc : p.getTestCases()) {
                Map<String, Object> testMap = new LinkedHashMap<>();
                testMap.put("input", tc.getInput());
                testMap.put("output", tc.getExpectedOutput());
                testMap.put("sample", tc.isSample());
                if (tc.isSample()) {
                    samples.add(Map.of("input", tc.getInput(), "output", tc.getExpectedOutput()));
                }
                allTests.add(testMap);
            }
        }
        map.put("samples", samples);
        map.put("testCount", p.getTestCases() != null ? p.getTestCases().size() : 0);

        if (includeTests) {
            map.put("tests", allTests);
        }
        return map;
    }
}
