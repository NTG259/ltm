package com.cplusplus.backend.dto;

import com.cplusplus.backend.domain.classroom.Classroom;
import com.cplusplus.backend.domain.classroom.ClassroomStudent;
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
        List<Map<String, Object>> hiddenTests = new ArrayList<>();

        if (p.getTestCases() != null) {
            for (TestCase tc : p.getTestCases()) {
                Map<String, Object> testMap = new LinkedHashMap<>();
                testMap.put("input", tc.getInput());
                testMap.put("output", tc.getExpectedOutput());
                testMap.put("sample", tc.isSample());
                if (tc.isSample()) {
                    samples.add(Map.of("input", tc.getInput(), "output", tc.getExpectedOutput()));
                } else {
                    hiddenTests.add(testMap);
                }
            }
        }
        map.put("publicVisible", p.isPublicVisible());
        map.put("checker", p.getChecker() != null ? p.getChecker().code() : "lines");
        map.put("samples", samples);
        map.put("testCount", p.getTestCases() != null ? p.getTestCases().size() : 0);

        if (includeTests) {
            map.put("tests", hiddenTests);
        }
        return map;
    }

    public static Map<String, Object> toContestMap(
            Contest c,
            boolean isAdmin,
            boolean isRegistered,
            long participantCount) {
        if (c == null) return null;
        Instant now = Instant.now();
        com.cplusplus.backend.domain.contest.ContestPhase phase = c.phaseAt(now);

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
            List<Long> pids = c.getProblems() != null
                    ? c.getProblems().stream().map(cp -> cp.getProblem().getId()).toList()
                    : List.of();
            map.put("problemIds", pids);
        }

        boolean showProblems = phase != com.cplusplus.backend.domain.contest.ContestPhase.UPCOMING || isAdmin;
        List<Map<String, Object>> problems = new ArrayList<>();
        if (showProblems && c.getProblems() != null) {
            for (com.cplusplus.backend.domain.contest.ContestProblem cp : c.getProblems()) {
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

    public static Map<String, Object> toClassroomMap(Classroom c) {
        if (c == null) return null;
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", c.getId());
        map.put("name", c.getName());
        map.put("semester", c.getSemester());
        map.put("createdBy", c.getCreatedBy() != null ? c.getCreatedBy().getUsername() : null);
        map.put("createdAt", c.getCreatedAt().toEpochMilli());
        return map;
    }

    public static Map<String, Object> toClassroomStudentMap(ClassroomStudent cs) {
        if (cs == null) return null;
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("userId", cs.getUser().getId());
        map.put("username", cs.getUser().getUsername());
        map.put("fullName", cs.getUser().getFullName());
        map.put("joinedAt", cs.getJoinedAt().toEpochMilli());
        map.put("importedPassword", cs.getImportedPassword());
        return map;
    }

    public static Map<String, Object> toCourseMap(com.cplusplus.backend.domain.course.Course c) {
        if (c == null) return null;
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", c.getId());
        map.put("title", c.getTitle());
        map.put("description", c.getDescription());
        map.put("published", c.isPublished());
        map.put("createdAt", c.getCreatedAt() != null ? c.getCreatedAt().toEpochMilli() : null);
        map.put("unitCount", c.getUnits() != null ? c.getUnits().size() : 0);
        return map;
    }

    public static Map<String, Object> toCourseDetailMap(com.cplusplus.backend.domain.course.Course c) {
        if (c == null) return null;
        Map<String, Object> map = toCourseMap(c);
        List<Map<String, Object>> units = new ArrayList<>();
        if (c.getUnits() != null) {
            for (com.cplusplus.backend.domain.course.CourseUnit u : c.getUnits()) {
                units.add(toCourseUnitMap(u));
            }
        }
        map.put("units", units);
        return map;
    }

    public static Map<String, Object> toCourseUnitMap(com.cplusplus.backend.domain.course.CourseUnit u) {
        if (u == null) return null;
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", u.getId());
        map.put("courseId", u.getCourse() != null ? u.getCourse().getId() : null);
        map.put("title", u.getTitle());
        map.put("orderIndex", u.getOrderIndex());
        map.put("createdAt", u.getCreatedAt() != null ? u.getCreatedAt().toEpochMilli() : null);
        return map;
    }

    public static Map<String, Object> toCourseLessonMap(com.cplusplus.backend.domain.course.CourseLesson l) {
        if (l == null) return null;
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", l.getId());
        map.put("unitId", l.getUnit() != null ? l.getUnit().getId() : null);
        map.put("theoryContent", l.getTheoryContent());
        map.put("sampleCode", l.getSampleCode());
        map.put("sampleInput", l.getSampleInput());
        map.put("updatedAt", l.getUpdatedAt() != null ? l.getUpdatedAt().toEpochMilli() : null);
        return map;
    }

    public static Map<String, Object> defaultLessonMap(com.cplusplus.backend.domain.course.CourseUnit u) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", null);
        map.put("unitId", u.getId());
        map.put("theoryContent", "### 1. Khái niệm cốt lõi\nChủ đề: **" + u.getTitle() + "**\n\nNội dung lý thuyết đang được giảng viên hoàn thiện...");
        map.put("sampleCode", "#include <iostream>\nusing namespace std;\n\nint main() {\n    // Ví dụ minh họa cho: " + u.getTitle() + "\n    cout << \"Xin chào! Bạn đang học C++ tại CodeJudge.\" << endl;\n    return 0;\n}");
        map.put("sampleInput", "");
        map.put("updatedAt", System.currentTimeMillis());
        return map;
    }

    public static Map<String, Object> toUnitProblemMap(com.cplusplus.backend.domain.course.CourseUnitProblem up, boolean solved) {
        if (up == null || up.getProblem() == null) return null;
        com.cplusplus.backend.domain.problem.Problem p = up.getProblem();
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", p.getId());
        map.put("problemId", p.getId());
        map.put("unitProblemId", up.getId());
        map.put("unitId", up.getUnit() != null ? up.getUnit().getId() : null);
        map.put("title", p.getTitle());
        map.put("difficulty", p.getDifficulty() != null ? p.getDifficulty().code() : "easy");
        map.put("orderIndex", up.getOrderIndex());
        map.put("solved", solved);
        return map;
    }
}
