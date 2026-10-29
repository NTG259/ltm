package com.cplusplus.backend.controller;

import com.cplusplus.backend.domain.contest.Contest;
import com.cplusplus.backend.domain.problem.CheckerType;
import com.cplusplus.backend.domain.problem.Difficulty;
import com.cplusplus.backend.domain.problem.Problem;
import com.cplusplus.backend.domain.problem.TestCase;
import com.cplusplus.backend.domain.user.User;
import com.cplusplus.backend.domain.worker.LogLevel;
import com.cplusplus.backend.domain.worker.SystemLog;
import com.cplusplus.backend.dto.DtoMapper;
import com.cplusplus.backend.master.service.JudgeMasterService;
import com.cplusplus.backend.repository.ContestRepository;
import com.cplusplus.backend.repository.ClassroomRepository;
import com.cplusplus.backend.repository.ProblemRepository;
import com.cplusplus.backend.repository.SubmissionRepository;
import com.cplusplus.backend.repository.SystemLogRepository;
import com.cplusplus.backend.repository.UserRepository;
import com.cplusplus.backend.security.AuthInterceptor;
import com.cplusplus.backend.security.SecurityService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.http.MediaType;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import com.cplusplus.backend.service.TestCaseZipImporter;
import com.cplusplus.backend.service.LecturerCsvImporter;

import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private final JudgeMasterService judgeMasterService;
    private final SubmissionRepository submissionRepository;
    private final ProblemRepository problemRepository;
    private final ContestRepository contestRepository;
    private final ClassroomRepository classroomRepository;
    private final SystemLogRepository systemLogRepository;
    private final TestCaseZipImporter testCaseZipImporter;
    private final UserRepository userRepository;
    private final SecurityService securityService;
    private final LecturerCsvImporter lecturerCsvImporter;

    public AdminController(
            JudgeMasterService judgeMasterService,
            SubmissionRepository submissionRepository,
            ProblemRepository problemRepository,
            ContestRepository contestRepository,
            ClassroomRepository classroomRepository,
            SystemLogRepository systemLogRepository,
            TestCaseZipImporter testCaseZipImporter,
            UserRepository userRepository,
            SecurityService securityService,
            LecturerCsvImporter lecturerCsvImporter) {
        this.judgeMasterService = judgeMasterService;
        this.submissionRepository = submissionRepository;
        this.problemRepository = problemRepository;
        this.contestRepository = contestRepository;
        this.classroomRepository = classroomRepository;
        this.systemLogRepository = systemLogRepository;
        this.testCaseZipImporter = testCaseZipImporter;
        this.userRepository = userRepository;
        this.securityService = securityService;
        this.lecturerCsvImporter = lecturerCsvImporter;
    }

    public record TestCaseRequest(String input, String output, Boolean sample) {}

    public record ProblemSaveRequest(
            Long id,
            String title,
            String difficulty,
            List<String> tags,
            Integer timeLimitMs,
            Integer memoryLimitMb,
            String statement,
            String inputSpec,
            String outputSpec,
            List<TestCaseRequest> samples,
            List<TestCaseRequest> tests,
            String checker
    ) {}

    public record ContestSaveRequest(
            Long id,
            String title,
            String description,
            Long startAt,
            Integer durationMin,
            List<Long> problemIds
    ) {}

    public record LecturerCreateRequest(String staffId, String username, String fullName, String password) {}

    private void requireAdmin(HttpServletRequest req) {
        User user = (User) req.getAttribute(AuthInterceptor.CURRENT_USER_ATTR);
        if (user == null || !user.isAdmin()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Yêu cầu quyền quản trị viên");
        }
    }

    @GetMapping("/overview")
    public ResponseEntity<?> overview(HttpServletRequest req) {
        requireAdmin(req);

        List<Map<String, Object>> workers = judgeMasterService.getWorkerSummaries();
        List<Long> queue = judgeMasterService.getQueue();
        long subCount = submissionRepository.count();

        List<SystemLog> dbLogs = systemLogRepository.findTop200ByOrderByCreatedAtDesc();
        List<Map<String, Object>> logs = dbLogs.stream().map(AdminController::logToMap).toList();

        // Throughput: last 60 minutes, 5-min buckets
        Instant since = Instant.now().minus(Duration.ofHours(1));
        List<Map<String, Object>> throughput = submissionRepository.findThroughput(since).stream().map(b -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("bucket", b.getBucket());
            m.put("total", b.getTotal());
            m.put("accepted", b.getAccepted());
            return m;
        }).toList();

        return ResponseEntity.ok(Map.of(
                "workers", workers,
                "queue", queue,
                "submissions", subCount,
                "logs", logs,
                "throughput", throughput
        ));
    }

    @GetMapping("/lecturers")
    public ResponseEntity<?> listLecturers(HttpServletRequest req) {
        requireAdmin(req);
        List<Map<String, Object>> result = userRepository.findAll().stream()
                .filter(User::isLecturer)
                .sorted(Comparator.comparing(User::getUsername, String.CASE_INSENSITIVE_ORDER))
                .map(user -> {
                    Map<String, Object> map = new LinkedHashMap<>();
                    map.put("id", user.getId());
                    map.put("username", user.getUsername());
                    map.put("staffId", user.getUsername());
                    map.put("fullName", user.getFullName());
                    map.put("initialPassword", user.getInitialPassword() == null ? "" : user.getInitialPassword());
                    List<com.cplusplus.backend.domain.classroom.Classroom> classrooms = classroomRepository.findByLecturerUserId(user.getId());
                    List<Map<String, Object>> classroomDtos = classrooms.stream().map(cls -> {
                        Map<String, Object> cmap = new LinkedHashMap<>();
                        cmap.put("id", cls.getId());
                        cmap.put("name", cls.getName());
                        cmap.put("semester", cls.getSemester() != null ? cls.getSemester() : "");
                        return cmap;
                    }).toList();
                    map.put("classroomCount", classroomDtos.size());
                    map.put("classrooms", classroomDtos);
                    map.put("createdAt", user.getCreatedAt().toEpochMilli());
                    return map;
                })
                .toList();
        return ResponseEntity.ok(result);
    }

    @PostMapping("/lecturers")
    @Transactional
    public ResponseEntity<?> createLecturer(@RequestBody LecturerCreateRequest body, HttpServletRequest req) {
        requireAdmin(req);
        String staffId = body.staffId() != null && !body.staffId().isBlank()
                ? body.staffId().trim()
                : body.username() != null ? body.username().trim() : "";
        String fullName = body.fullName() == null ? "" : body.fullName().trim();
        if (!staffId.matches("^[A-Za-z0-9._-]{3,32}$")) {
            throw new IllegalArgumentException("Mã giảng viên chỉ gồm chữ, số, dấu chấm, gạch ngang hoặc gạch dưới (3–32 ký tự)");
        }
        if (fullName.isBlank() || fullName.length() > 100) throw new IllegalArgumentException("Nhập họ tên giảng viên (tối đa 100 ký tự)");
        if (body.password() == null || body.password().length() < 8) throw new IllegalArgumentException("Mật khẩu phải có ít nhất 8 ký tự");
        if (userRepository.findByUsernameIgnoreCase(staffId).isPresent()) throw new IllegalArgumentException("Mã giảng viên đã tồn tại");
        User lecturer = userRepository.save(User.lecturer(staffId, fullName, securityService.hashPassword(body.password())));
        lecturer.setInitialPassword(body.password());
        lecturer = userRepository.save(lecturer);
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of(
                "id", lecturer.getId(), "staffId", lecturer.getUsername(), "fullName", lecturer.getFullName(),
                "createdAt", lecturer.getCreatedAt().toEpochMilli()));
    }

    @PostMapping(value = "/lecturers/import", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> importLecturers(@RequestParam("file") MultipartFile file, HttpServletRequest req) {
        requireAdmin(req);
        return ResponseEntity.ok(lecturerCsvImporter.importFile(file));
    }

    @DeleteMapping("/lecturers")
    @Transactional
    public ResponseEntity<?> deleteLecturers(@RequestBody Map<String, List<Long>> body, HttpServletRequest req) {
        requireAdmin(req);
        List<Long> ids = body.getOrDefault("ids", List.of()).stream().filter(Objects::nonNull).distinct().toList();
        List<User> lecturers = userRepository.findAllById(ids).stream().filter(User::isLecturer).toList();
        userRepository.deleteAll(lecturers);
        return ResponseEntity.ok(Map.of("deleted", lecturers.size()));
    }

    @PostMapping("/lecturers/{id}/reset-password")
    @Transactional
    public ResponseEntity<?> resetLecturerPassword(@PathVariable Long id,
                                                   @RequestBody Map<String, String> body,
                                                   HttpServletRequest req) {
        requireAdmin(req);
        User lecturer = userRepository.findById(id)
                .filter(User::isLecturer)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy tài khoản giảng viên #" + id));
        String newPassword = body.get("password");
        if (newPassword == null || newPassword.length() < 8) {
            return ResponseEntity.badRequest().body(Map.of("message", "Mật khẩu phải có ít nhất 8 ký tự"));
        }
        lecturer.setPasswordHash(securityService.hashPassword(newPassword));
        lecturer.setInitialPassword(newPassword);
        userRepository.save(lecturer);
        return ResponseEntity.ok(Map.of("message", "Đã đặt lại mật khẩu thành công"));
    }

    @GetMapping("/logs")
    public ResponseEntity<?> getLogs(@RequestParam(required = false) String level, HttpServletRequest req) {
        requireAdmin(req);
        List<SystemLog> dbLogs;
        if (level != null && !level.isBlank()) {
            try {
                LogLevel lv = LogLevel.valueOf(level.toUpperCase(java.util.Locale.ROOT));
                dbLogs = systemLogRepository.findTop200ByLevelOrderByCreatedAtDesc(lv, PageRequest.of(0, 200));
            } catch (IllegalArgumentException e) {
                return ResponseEntity.badRequest().body(Map.of("error", "level không hợp lệ"));
            }
        } else {
            dbLogs = systemLogRepository.findTop200ByOrderByCreatedAtDesc();
        }
        return ResponseEntity.ok(dbLogs.stream().map(AdminController::logToMap).toList());
    }

    private static Map<String, Object> logToMap(SystemLog l) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", l.getId());
        map.put("time", l.getCreatedAt().toEpochMilli());
        map.put("level", l.getLevel().code());
        map.put("message", l.getMessage());
        return map;
    }

    @PostMapping("/workers/{id}/disconnect")
    public ResponseEntity<?> disconnectWorker(@PathVariable String id, HttpServletRequest req) {
        requireAdmin(req);
        judgeMasterService.disconnectWorker(id);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/workers/disconnected")
    public ResponseEntity<?> removeDisconnectedWorkers(HttpServletRequest req) {
        requireAdmin(req);
        int removed = judgeMasterService.removeDisconnectedWorkers();
        return ResponseEntity.ok(Map.of("removed", removed));
    }

    // ---------------------------------------------------- Problem CRUD
    @PostMapping("/problems")
    @Transactional
    public ResponseEntity<?> createProblem(@RequestBody ProblemSaveRequest req, HttpServletRequest servletReq) {
        requireAdmin(servletReq);
        User user = (User) servletReq.getAttribute(AuthInterceptor.CURRENT_USER_ATTR);

        if (req.title() == null || req.title().isBlank()) {
            throw new IllegalArgumentException("Tên đề bài không được để trống");
        }

        Problem problem = new Problem(req.title().trim(), req.statement() != null ? req.statement() : "");
        problem.setCreatedBy(user);
        applyProblemData(problem, req);

        problem = problemRepository.save(problem);
        return ResponseEntity.status(HttpStatus.CREATED).body(DtoMapper.toProblemMap(problem, true));
    }

    @PutMapping("/problems/{id}")
    @Transactional
    public ResponseEntity<?> updateProblem(@PathVariable Long id, @RequestBody ProblemSaveRequest req, HttpServletRequest servletReq) {
        requireAdmin(servletReq);

        Problem problem = problemRepository.findWithTestCases(id)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy bài tập #" + id));

        if (req.title() != null && !req.title().isBlank()) {
            problem.setTitle(req.title().trim());
        }
        applyProblemData(problem, req);

        problem = problemRepository.save(problem);
        return ResponseEntity.ok(DtoMapper.toProblemMap(problem, true));
    }

    @PatchMapping("/problems/{id}/visibility")
    @Transactional
    public ResponseEntity<?> toggleProblemVisibility(@PathVariable Long id, @RequestBody Map<String, Boolean> body, HttpServletRequest req) {
        requireAdmin(req);
        Problem problem = problemRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy bài tập #" + id));
        Boolean visible = body.get("publicVisible");
        if (visible != null) {
            problem.setPublicVisible(visible);
            problemRepository.save(problem);
        }
        return ResponseEntity.ok(Map.of("publicVisible", problem.isPublicVisible()));
    }

    @DeleteMapping("/problems/{id}")
    @Transactional
    public ResponseEntity<?> deleteProblem(@PathVariable Long id, HttpServletRequest req) {
        requireAdmin(req);
        Problem p = problemRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy bài tập #" + id));
        p.softDelete(Instant.now());
        problemRepository.save(p);
        return ResponseEntity.noContent().build();
    }

    @PostMapping(value = "/problems/{id}/testcases/zip", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Transactional
    public ResponseEntity<?> uploadTestCasesZip(
            @PathVariable Long id,
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "keepSamples", defaultValue = "true") boolean keepSamples,
            HttpServletRequest req) {
        requireAdmin(req);

        Problem problem = problemRepository.findWithTestCases(id)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy bài tập #" + id));

        TestCaseZipImporter.ImportResult result = testCaseZipImporter.importToProblem(problem, file, keepSamples);
        problem = problemRepository.save(problem);

        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("success", true);
        resp.put("message", "Đã nhập thành công " + result.importedCount() + " test case từ file ZIP");
        resp.put("importedCount", result.importedCount());
        resp.put("totalTestCount", problem.getTestCases().size());
        resp.put("testKeys", result.testKeys());
        resp.put("unpairedInputs", result.unpairedInputs());
        resp.put("unpairedOutputs", result.unpairedOutputs());
        resp.put("problem", DtoMapper.toProblemMap(problem, true));
        return ResponseEntity.ok(resp);
    }

    @PostMapping(value = "/problems/parse-zip", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> parseTestCasesZip(
            @RequestParam("file") MultipartFile file,
            HttpServletRequest req) {
        requireAdmin(req);

        TestCaseZipImporter.ParseResult result = testCaseZipImporter.parse(file);
        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("success", true);
        resp.put("message", "Giải nén thành công " + result.tests().size() + " test case từ file ZIP");
        resp.put("count", result.tests().size());
        resp.put("tests", result.tests());
        resp.put("unpairedInputs", result.unpairedInputs());
        resp.put("unpairedOutputs", result.unpairedOutputs());
        return ResponseEntity.ok(resp);
    }

    private void applyProblemData(Problem problem, ProblemSaveRequest req) {
        if (req.statement() != null) {
            problem.setStatement(req.statement());
        }
        if (req.inputSpec() != null) {
            problem.setInputSpec(req.inputSpec());
        }
        if (req.outputSpec() != null) {
            problem.setOutputSpec(req.outputSpec());
        }
        if (req.timeLimitMs() != null && req.timeLimitMs() > 0) {
            problem.setTimeLimitMs(req.timeLimitMs());
        }
        if (req.memoryLimitMb() != null && req.memoryLimitMb() > 0) {
            problem.setMemoryLimitMb(req.memoryLimitMb());
        }
        if (req.tags() != null) {
            problem.setTags(req.tags());
        }
        if (req.difficulty() != null) {
            try {
                problem.setDifficulty(Difficulty.valueOf(req.difficulty().toUpperCase(Locale.ROOT)));
            } catch (Exception ignored) {
            }
        }
        if (req.checker() != null) {
            try {
                problem.setChecker(CheckerType.valueOf(req.checker().toUpperCase(Locale.ROOT)));
            } catch (Exception ignored) {
            }
        }

        List<TestCase.Data> testData = new ArrayList<>();
        if (req.samples() != null) {
            for (TestCaseRequest tc : req.samples()) {
                if (tc != null && ((tc.input() != null && !tc.input().isBlank()) || (tc.output() != null && !tc.output().isBlank()))) {
                    testData.add(new TestCase.Data(
                            tc.input() != null ? tc.input() : "",
                            tc.output() != null ? tc.output() : "",
                            true
                    ));
                }
            }
        }
        if (req.tests() != null) {
            for (TestCaseRequest tc : req.tests()) {
                if (tc != null && ((tc.input() != null && !tc.input().isBlank()) || (tc.output() != null && !tc.output().isBlank()))) {
                    boolean isSample = Boolean.TRUE.equals(tc.sample());
                    testData.add(new TestCase.Data(
                            tc.input() != null ? tc.input() : "",
                            tc.output() != null ? tc.output() : "",
                            isSample
                    ));
                }
            }
        }
        if (!testData.isEmpty()) {
            problem.replaceTestCases(testData);
        }
    }

    // ---------------------------------------------------- Contest CRUD
    @PostMapping("/contests")
    @Transactional
    public ResponseEntity<?> createContest(@RequestBody ContestSaveRequest req, HttpServletRequest servletReq) {
        requireAdmin(servletReq);
        User user = (User) servletReq.getAttribute(AuthInterceptor.CURRENT_USER_ATTR);

        if (req.title() == null || req.title().isBlank()) {
            throw new IllegalArgumentException("Tên kỳ thi không được để trống");
        }
        if (req.startAt() == null || req.startAt() <= 0) {
            throw new IllegalArgumentException("Thời gian bắt đầu không hợp lệ");
        }
        int durationMin = (req.durationMin() != null && req.durationMin() > 0) ? req.durationMin() : 120;

        Instant startAt = Instant.ofEpochMilli(req.startAt());
        Contest contest = new Contest(req.title().trim(), startAt, Duration.ofMinutes(durationMin));
        contest.setDescription(req.description() != null ? req.description() : "");
        contest.setCreatedBy(user);

        // Save contest first so ID is generated for ContestProblem
        contest = contestRepository.save(contest);

        if (req.problemIds() != null && !req.problemIds().isEmpty()) {
            List<Problem> problems = problemRepository.findAllById(req.problemIds());
            Map<Long, Problem> pMap = problems.stream().collect(Collectors.toMap(Problem::getId, p -> p));
            List<Problem> ordered = req.problemIds().stream()
                    .map(pMap::get)
                    .filter(Objects::nonNull)
                    .toList();
            contest.setProblemList(ordered);
            contest = contestRepository.save(contest);
        }

        judgeMasterService.broadcastContestUpdate(contest.getId());
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(DtoMapper.toContestMap(contest, true, false, 0));
    }

    @PutMapping("/contests/{id}")
    @Transactional
    public ResponseEntity<?> updateContest(@PathVariable Long id, @RequestBody ContestSaveRequest req, HttpServletRequest servletReq) {
        requireAdmin(servletReq);

        Contest contest = contestRepository.findWithProblems(id)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy kỳ thi #" + id));

        if (req.title() != null && !req.title().isBlank()) {
            contest.setTitle(req.title().trim());
        }
        if (req.description() != null) {
            contest.setDescription(req.description());
        }

        Instant startAt = (req.startAt() != null && req.startAt() > 0)
                ? Instant.ofEpochMilli(req.startAt())
                : contest.getStartAt();
        int durationMin = (req.durationMin() != null && req.durationMin() > 0)
                ? req.durationMin()
                : (int) contest.getDurationMinutes();
        contest.reschedule(startAt, Duration.ofMinutes(durationMin));

        if (req.problemIds() != null) {
            List<Problem> problems = problemRepository.findAllById(req.problemIds());
            Map<Long, Problem> pMap = problems.stream().collect(Collectors.toMap(Problem::getId, p -> p));
            List<Problem> ordered = req.problemIds().stream()
                    .map(pMap::get)
                    .filter(Objects::nonNull)
                    .toList();
            contest.setProblemList(ordered);
        }

        contest = contestRepository.save(contest);
        judgeMasterService.broadcastContestUpdate(contest.getId());

        long participantCount = contestRepository.countParticipants(contest.getId());
        return ResponseEntity.ok(DtoMapper.toContestMap(contest, true, false, participantCount));
    }

    @DeleteMapping("/contests/{id}")
    @Transactional
    public ResponseEntity<?> deleteContest(@PathVariable Long id, HttpServletRequest req) {
        requireAdmin(req);
        contestRepository.deleteById(id);
        judgeMasterService.broadcastContestUpdate(id);
        return ResponseEntity.noContent().build();
    }

    // ---------------------------------------------------- Student management
    @PostMapping("/students/{id}/reset-password")
    @Transactional
    public ResponseEntity<?> resetStudentPassword(@PathVariable Long id,
                                                  @RequestBody Map<String, String> body,
                                                  HttpServletRequest req) {
        requireAdmin(req);
        User student = userRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy người dùng #" + id));
        if (student.isAdmin()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Không thể reset mật khẩu admin qua API này"));
        }
        String newPassword = body.get("password");
        if (newPassword == null || newPassword.length() < 8) {
            return ResponseEntity.badRequest().body(Map.of("message", "Mật khẩu phải có ít nhất 8 ký tự"));
        }
        student.setPasswordHash(securityService.hashPassword(newPassword));
        userRepository.save(student);
        return ResponseEntity.ok(Map.of("message", "Đã đặt lại mật khẩu thành công"));
    }
}
