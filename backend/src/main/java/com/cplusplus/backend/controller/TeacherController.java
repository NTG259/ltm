package com.cplusplus.backend.controller;

import com.cplusplus.backend.domain.classroom.Classroom;
import com.cplusplus.backend.domain.classroom.ClassroomContest;
import com.cplusplus.backend.domain.classroom.ClassroomStudent;
import com.cplusplus.backend.domain.contest.Contest;
import com.cplusplus.backend.domain.contest.ContestParticipant;
import com.cplusplus.backend.domain.problem.CheckerType;
import com.cplusplus.backend.domain.problem.Difficulty;
import com.cplusplus.backend.domain.problem.Problem;
import com.cplusplus.backend.domain.problem.TestCase;
import com.cplusplus.backend.domain.user.User;
import com.cplusplus.backend.dto.DtoMapper;
import com.cplusplus.backend.master.service.JudgeMasterService;
import com.cplusplus.backend.repository.*;
import com.cplusplus.backend.security.AuthInterceptor;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.time.Instant;
import java.util.*;

@RestController
@RequestMapping("/api/teacher")
@Transactional(readOnly = true)
public class TeacherController {
    private final ProblemRepository problemRepository;
    private final ContestRepository contestRepository;
    private final ClassroomRepository classroomRepository;
    private final ClassroomStudentRepository classroomStudentRepository;
    private final ClassroomContestRepository classroomContestRepository;
    private final ContestParticipantRepository contestParticipantRepository;
    private final JudgeMasterService judgeMasterService;

    public TeacherController(ProblemRepository problemRepository,
                             ContestRepository contestRepository,
                             ClassroomRepository classroomRepository,
                             ClassroomStudentRepository classroomStudentRepository,
                             ClassroomContestRepository classroomContestRepository,
                             ContestParticipantRepository contestParticipantRepository,
                             JudgeMasterService judgeMasterService) {
        this.problemRepository = problemRepository;
        this.contestRepository = contestRepository;
        this.classroomRepository = classroomRepository;
        this.classroomStudentRepository = classroomStudentRepository;
        this.classroomContestRepository = classroomContestRepository;
        this.contestParticipantRepository = contestParticipantRepository;
        this.judgeMasterService = judgeMasterService;
    }

    public record TestCaseInput(String input, String output, Boolean sample) {}
    public record ProblemInput(Long id, String title, String statement, String inputSpec, String outputSpec,
                               String difficulty, String checker, List<String> tags,
                               Integer timeLimitMs, Integer memoryLimitMb,
                               List<TestCaseInput> samples, List<TestCaseInput> tests) {}
    public record ContestInput(String title, String description, Long startAt, Integer durationMin,
                               List<Long> problemIds, Long classroomId) {}

    @GetMapping("/problems")
    public List<Map<String, Object>> listProblems(HttpServletRequest req) {
        requireLecturer(req);
        return problemRepository.findByDeletedAtIsNullOrderById()
                .stream().map(p -> DtoMapper.toProblemMap(p, true)).toList();
    }

    @GetMapping("/problems/{id}")
    public Map<String, Object> getProblem(@PathVariable Long id, HttpServletRequest req) {
        requireLecturer(req);
        return problemRepository.findByIdAndDeletedAtIsNull(id)
                .filter(p -> !p.isDeleted())
                .map(p -> DtoMapper.toProblemMap(p, true))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    }

    @PostMapping("/problems")
    @Transactional
    public ResponseEntity<?> createProblem(@RequestBody ProblemInput req, HttpServletRequest servletReq) {
        requireLecturer(servletReq);
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Giảng viên chỉ được dùng đề trong kho chung");
    }

    @PutMapping("/problems/{id}")
    @Transactional
    public Map<String, Object> updateProblem(@PathVariable Long id, @RequestBody ProblemInput req, HttpServletRequest servletReq) {
        requireLecturer(servletReq);
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Chỉ admin được sửa đề trong kho chung");
    }

    @DeleteMapping("/problems/{id}")
    @Transactional
    public ResponseEntity<?> deleteProblem(@PathVariable Long id, HttpServletRequest req) {
        requireLecturer(req);
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Chỉ admin được xóa đề trong kho chung");
    }

    @GetMapping("/contests")
    public List<Map<String, Object>> listContests(HttpServletRequest req) {
        User user = requireLecturer(req);
        return contestRepository.findByCreatedByIdOrderByStartAtDesc(user.getId()).stream().map(c -> {
            Map<String, Object> row = new LinkedHashMap<>(DtoMapper.toContestMap(c, true, false, contestRepository.countParticipants(c.getId())));
            List<ClassroomContest> assigned = classroomContestRepository.findByContestId(c.getId());
            row.put("classroomId", assigned.isEmpty() ? null : assigned.get(0).getId().getClassroomId());
            return row;
        }).toList();
    }

    @GetMapping("/contests/problems")
    public List<Map<String, Object>> contestProblems(HttpServletRequest req) {
        requireLecturer(req);
        return problemRepository.findByDeletedAtIsNullOrderById().stream()
                .map(p -> DtoMapper.toProblemMap(p, true)).toList();
    }

    @GetMapping("/library/contests")
    public List<Map<String, Object>> availableContests(HttpServletRequest req) {
        User user = requireLecturer(req);
        return contestRepository.findAllByOrderByStartAtDesc().stream()
                .filter(contest -> contest.getCreatedBy() == null || contest.getCreatedBy().isAdmin()
                        || contest.getCreatedBy().getId().equals(user.getId()))
                .map(contest -> DtoMapper.toContestMap(contest, true, false,
                        contestRepository.countParticipants(contest.getId())))
                .toList();
    }

    @PostMapping("/contests")
    @Transactional
    public ResponseEntity<?> createContest(@RequestBody ContestInput req, HttpServletRequest servletReq) {
        User user = requireLecturer(servletReq);
        Classroom classroom = ownedClassroom(req.classroomId(), user);
        validateContest(req);
        List<Problem> problems = ownedProblems(req.problemIds(), user);
        Contest contest = new Contest(req.title().trim(), Instant.ofEpochMilli(req.startAt()),
                Duration.ofMinutes(req.durationMin() == null ? 120 : req.durationMin()));
        contest.setDescription(req.description() == null ? "" : req.description());
        contest.setCreatedBy(user);
        contest.setProblemList(problems);
        contest = contestRepository.save(contest);
        classroomContestRepository.save(new ClassroomContest(classroom, contest, Instant.now()));
        enrollClass(contest, classroom);
        judgeMasterService.broadcastContestUpdate(contest.getId());
        return ResponseEntity.status(HttpStatus.CREATED).body(DtoMapper.toContestMap(contest, true, false, contestRepository.countParticipants(contest.getId())));
    }

    @PutMapping("/contests/{id}")
    @Transactional
    public Map<String, Object> updateContest(@PathVariable Long id, @RequestBody ContestInput req, HttpServletRequest servletReq) {
        User user = requireLecturer(servletReq);
        Contest contest = contestRepository.findByIdAndCreatedById(id, user.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        validateContest(req);
        if (req.title() != null && !req.title().isBlank()) contest.setTitle(req.title().trim());
        if (req.description() != null) contest.setDescription(req.description());
        int duration = req.durationMin() == null || req.durationMin() <= 0 ? (int) contest.getDurationMinutes() : req.durationMin();
        contest.reschedule(req.startAt() == null || req.startAt() <= 0 ? contest.getStartAt() : Instant.ofEpochMilli(req.startAt()), Duration.ofMinutes(duration));
        if (req.problemIds() != null) contest.setProblemList(ownedProblems(req.problemIds(), user));
        Contest saved = contestRepository.save(contest);
        judgeMasterService.broadcastContestUpdate(saved.getId());
        return DtoMapper.toContestMap(saved, true, false, contestRepository.countParticipants(saved.getId()));
    }

    @DeleteMapping("/contests/{id}")
    @Transactional
    public ResponseEntity<?> deleteContest(@PathVariable Long id, HttpServletRequest req) {
        User user = requireLecturer(req);
        Contest contest = contestRepository.findByIdAndCreatedById(id, user.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        contestRepository.delete(contest);
        judgeMasterService.broadcastContestUpdate(id);
        return ResponseEntity.noContent().build();
    }

    private void validateContest(ContestInput req) {
        if (req.title() == null || req.title().isBlank()) throw new IllegalArgumentException("Tên kỳ thi không được để trống");
        if (req.startAt() == null || req.startAt() <= 0) throw new IllegalArgumentException("Thời gian bắt đầu không hợp lệ");
        if (req.durationMin() != null && req.durationMin() <= 0) throw new IllegalArgumentException("Thời lượng phải lớn hơn 0");
        if (req.problemIds() == null || req.problemIds().isEmpty()) throw new IllegalArgumentException("Chọn ít nhất một bài tập");
        if (req.problemIds().size() > 26) throw new IllegalArgumentException("Kỳ thi tối đa 26 bài");
    }

    private List<Problem> ownedProblems(List<Long> ids, User user) {
        List<Problem> problems = problemRepository.findAllById(ids);
        if (problems.size() != ids.stream().distinct().count() || ids.size() != ids.stream().distinct().count()
                || problems.stream().anyMatch(Problem::isDeleted)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Chỉ được chọn đề còn hoạt động trong kho chung");
        }
        Map<Long, Problem> byId = new HashMap<>();
        problems.forEach(p -> byId.put(p.getId(), p));
        return ids.stream().map(byId::get).toList();
    }

    private Classroom ownedClassroom(Long id, User user) {
        if (id == null) throw new IllegalArgumentException("Chọn lớp học");
        return classroomRepository.findById(id).filter(c -> c.getLecturer() != null && c.getLecturer().getId().equals(user.getId()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "Lớp học không thuộc quyền quản lý của bạn"));
    }

    private void enrollClass(Contest contest, Classroom classroom) {
        for (ClassroomStudent student : classroomStudentRepository.findAllWithUserByClassroomId(classroom.getId())) {
            ContestParticipant.Id id = new ContestParticipant.Id(contest.getId(), student.getUser().getId());
            if (!contestParticipantRepository.existsById(id)) {
                contestParticipantRepository.save(new ContestParticipant(contest, student.getUser(), Instant.now()));
            }
        }
    }

    private void applyProblemData(Problem problem, ProblemInput req) {
        if (req.statement() != null) problem.setStatement(req.statement());
        if (req.inputSpec() != null) problem.setInputSpec(req.inputSpec());
        if (req.outputSpec() != null) problem.setOutputSpec(req.outputSpec());
        if (req.timeLimitMs() != null && req.timeLimitMs() > 0) problem.setTimeLimitMs(req.timeLimitMs());
        if (req.memoryLimitMb() != null && req.memoryLimitMb() > 0) problem.setMemoryLimitMb(req.memoryLimitMb());
        if (req.tags() != null) problem.setTags(req.tags());
        if (req.difficulty() != null) try { problem.setDifficulty(Difficulty.valueOf(req.difficulty().toUpperCase(Locale.ROOT))); } catch (Exception ignored) {}
        if (req.checker() != null) try { problem.setChecker(CheckerType.valueOf(req.checker().toUpperCase(Locale.ROOT))); } catch (Exception ignored) {}
        List<TestCase.Data> tests = new ArrayList<>();
        if (req.samples() != null) for (TestCaseInput tc : req.samples()) {
            if (tc != null && (notBlank(tc.input()) || notBlank(tc.output()))) tests.add(new TestCase.Data(orEmpty(tc.input()), orEmpty(tc.output()), true));
        }
        if (req.tests() != null) for (TestCaseInput tc : req.tests()) {
            if (tc != null && (notBlank(tc.input()) || notBlank(tc.output()))) tests.add(new TestCase.Data(orEmpty(tc.input()), orEmpty(tc.output()), Boolean.TRUE.equals(tc.sample())));
        }
        if (!tests.isEmpty()) problem.replaceTestCases(tests);
    }

    private boolean notBlank(String value) { return value != null && !value.isBlank(); }
    private String orEmpty(String value) { return value == null ? "" : value; }

    private User requireLecturer(HttpServletRequest req) {
        User user = (User) req.getAttribute(AuthInterceptor.CURRENT_USER_ATTR);
        if (user == null || !user.isLecturer()) throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        return user;
    }
}
