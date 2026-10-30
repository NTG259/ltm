package com.cplusplus.backend.controller;

import com.cplusplus.backend.domain.classroom.Classroom;
import com.cplusplus.backend.domain.classroom.ClassroomContest;
import com.cplusplus.backend.domain.classroom.ClassroomCourse;
import com.cplusplus.backend.domain.classroom.ClassroomStudent;
import com.cplusplus.backend.domain.contest.Contest;
import com.cplusplus.backend.domain.contest.ContestParticipant;
import com.cplusplus.backend.domain.course.Course;
import com.cplusplus.backend.domain.course.CourseUnit;

import com.cplusplus.backend.domain.user.User;
import com.cplusplus.backend.dto.DtoMapper;
import com.cplusplus.backend.repository.*;
import com.cplusplus.backend.security.AuthInterceptor;
import com.cplusplus.backend.security.SecurityService;
import com.cplusplus.backend.service.ClassroomCsvImporter;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.time.Instant;
import java.util.*;

@RestController
@RequestMapping("/api/classrooms")
@Transactional(readOnly = true)
public class ClassroomController {

    private final ClassroomRepository classroomRepository;
    private final ClassroomStudentRepository classroomStudentRepository;
    private final ClassroomContestRepository classroomContestRepository;
    private final ClassroomCourseRepository classroomCourseRepository;
    private final ContestRepository contestRepository;
    private final ContestParticipantRepository contestParticipantRepository;
    private final CourseRepository courseRepository;
    private final CourseUnitRepository courseUnitRepository;
    private final CourseUnitProblemRepository courseUnitProblemRepository;
    private final CourseUnitFileRepository courseUnitFileRepository;
    private final ClassroomCsvImporter csvImporter;
    private final UserRepository userRepository;
    private final SecurityService securityService;
    private final JdbcTemplate jdbc;

    public ClassroomController(ClassroomRepository classroomRepository,
                               ClassroomStudentRepository classroomStudentRepository,
                               ClassroomContestRepository classroomContestRepository,
                               ClassroomCourseRepository classroomCourseRepository,
                               ContestRepository contestRepository,
                               ContestParticipantRepository contestParticipantRepository,
                               CourseRepository courseRepository,
                               CourseUnitRepository courseUnitRepository,
                               CourseUnitProblemRepository courseUnitProblemRepository,
                               CourseUnitFileRepository courseUnitFileRepository,
                               ClassroomCsvImporter csvImporter,
                               UserRepository userRepository,
                               SecurityService securityService,
                               JdbcTemplate jdbc) {
        this.classroomRepository = classroomRepository;
        this.classroomStudentRepository = classroomStudentRepository;
        this.classroomContestRepository = classroomContestRepository;
        this.classroomCourseRepository = classroomCourseRepository;
        this.contestRepository = contestRepository;
        this.contestParticipantRepository = contestParticipantRepository;
        this.courseRepository = courseRepository;
        this.courseUnitRepository = courseUnitRepository;
        this.courseUnitProblemRepository = courseUnitProblemRepository;
        this.courseUnitFileRepository = courseUnitFileRepository;
        this.csvImporter = csvImporter;
        this.userRepository = userRepository;
        this.securityService = securityService;
        this.jdbc = jdbc;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Classroom CRUD
    // ─────────────────────────────────────────────────────────────────────────

    private Map<Long, List<Map<String, Object>>> loadAssignedLecturers(List<Long> classroomIds) {
        if (classroomIds == null || classroomIds.isEmpty()) return Map.of();
        String inClause = classroomIds.stream().map(String::valueOf).collect(java.util.stream.Collectors.joining(","));
        String sql = """
                SELECT DISTINCT c.id AS classroom_id, u.id, u.username, u.full_name
                FROM classrooms c
                JOIN users u ON (
                    u.id = c.lecturer_id
                    OR (c.created_by = u.id AND u.role = 'LECTURER')
                    OR EXISTS (SELECT 1 FROM classroom_lecturers cl WHERE cl.classroom_id = c.id AND cl.user_id = u.id)
                )
                WHERE c.id IN (%s)
                ORDER BY u.full_name, u.id
                """.formatted(inClause);

        Map<Long, List<Map<String, Object>>> map = new LinkedHashMap<>();
        jdbc.query(sql, rs -> {
            Long cId = rs.getLong("classroom_id");
            map.computeIfAbsent(cId, k -> new ArrayList<>()).add(Map.of(
                    "id", rs.getLong("id"),
                    "username", rs.getString("username"),
                    "fullName", rs.getString("full_name")
            ));
        });
        return map;
    }

    private Map<String, Object> toClassroomDto(Classroom c, Map<Long, List<Map<String, Object>>> lecturersMap) {
        Map<String, Object> map = new LinkedHashMap<>(DtoMapper.toClassroomMap(c));
        List<Map<String, Object>> lecturers = lecturersMap.getOrDefault(c.getId(), List.of());
        if (!lecturers.isEmpty()) {
            map.put("lecturers", lecturers);
            if (map.get("lecturerName") == null) {
                Map<String, Object> primary = lecturers.get(0);
                map.put("lecturerId", primary.get("id"));
                map.put("lecturerName", primary.get("fullName"));
                map.put("lecturerStaffId", primary.get("username"));
            }
        } else if (c.getLecturer() != null) {
            map.put("lecturers", List.of(Map.of(
                    "id", c.getLecturer().getId(),
                    "username", c.getLecturer().getUsername(),
                    "fullName", c.getLecturer().getFullName()
            )));
        } else {
            map.put("lecturers", List.of());
        }
        return map;
    }

    @GetMapping
    public ResponseEntity<?> listClassrooms(HttpServletRequest req) {
        User user = currentUser(req);
        if (user == null) return unauthorized();

        List<Classroom> list;
        if (user.isAdmin()) {
            list = classroomRepository.findAll();
        } else if (user.isLecturer()) {
            list = classroomRepository.findByLecturerUserId(user.getId());
        } else {
            list = classroomRepository.findByStudentUserId(user.getId());
        }
        Map<Long, List<Map<String, Object>>> lecturersMap = loadAssignedLecturers(list.stream().map(Classroom::getId).toList());
        return ResponseEntity.ok(list.stream().map(c -> toClassroomDto(c, lecturersMap)).toList());
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getClassroom(@PathVariable Long id, HttpServletRequest req) {
        User user = currentUser(req);
        if (user == null) return unauthorized();

        Classroom classroom = classroomRepository.findById(id).orElse(null);
        if (classroom == null) return ResponseEntity.notFound().build();

        if (!canViewClassroom(classroom, user)) return forbidden();

        List<Map<String, Object>> contests = classroomContestRepository
                .findAllWithContestByClassroomId(id)
                .stream().map(cc -> {
                    Contest c = cc.getContest();
                    return Map.<String, Object>of(
                            "contestId", c.getId(),
                            "title", c.getTitle(),
                            "startAt", c.getStartAt().toEpochMilli(),
                            "endAt", c.getEndAt().toEpochMilli()
                    );
                }).toList();

        Map<Long, List<Map<String, Object>>> lecturersMap = loadAssignedLecturers(List.of(classroom.getId()));
        Map<String, Object> result = new LinkedHashMap<>(toClassroomDto(classroom, lecturersMap));
        result.put("contests", contests);
        return ResponseEntity.ok(result);
    }

    @PostMapping
    @Transactional
    public ResponseEntity<?> createClassroom(@RequestBody Map<String, String> body,
                                             HttpServletRequest req) {
        User user = currentUser(req);
        if (user == null) return unauthorized();
        if (!user.isAdmin()) return forbidden();

        String name = body.get("name");
        if (name == null || name.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Tên lớp không được để trống"));
        }
        Classroom classroom = classroomRepository.save(
                new Classroom(name.trim(), body.get("semester"), user));
        User lecturer = findLecturer(body.get("lecturerId"));
        classroom.setLecturer(lecturer);
        if (lecturer != null) {
            jdbc.update("INSERT INTO classroom_lecturers (classroom_id, user_id) VALUES (?, ?) ON CONFLICT DO NOTHING", classroom.getId(), lecturer.getId());
        }
        Map<Long, List<Map<String, Object>>> lecturersMap = loadAssignedLecturers(List.of(classroom.getId()));
        return ResponseEntity.status(HttpStatus.CREATED).body(toClassroomDto(classroom, lecturersMap));
    }

    @PutMapping("/{id}")
    @Transactional
    public ResponseEntity<?> updateClassroom(@PathVariable Long id,
                                             @RequestBody Map<String, String> body,
                                             HttpServletRequest req) {
        User user = currentUser(req);
        if (user == null) return unauthorized();

        Classroom classroom = classroomRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy lớp #" + id));
        if (!canManageClassroom(classroom, user)) return forbidden();

        if (body.containsKey("name") && !body.get("name").isBlank()) {
            classroom.setName(body.get("name").trim());
        }
        if (body.containsKey("semester")) {
            classroom.setSemester(body.get("semester"));
        }
        if (user.isAdmin() && body.containsKey("lecturerId")) {
            User lecturer = findLecturer(body.get("lecturerId"));
            classroom.setLecturer(lecturer);
            jdbc.update("DELETE FROM classroom_lecturers WHERE classroom_id = ?", classroom.getId());
            if (lecturer != null) {
                jdbc.update("INSERT INTO classroom_lecturers (classroom_id, user_id) VALUES (?, ?) ON CONFLICT DO NOTHING", classroom.getId(), lecturer.getId());
            }
        }
        classroom = classroomRepository.save(classroom);
        Map<Long, List<Map<String, Object>>> lecturersMap = loadAssignedLecturers(List.of(classroom.getId()));
        return ResponseEntity.ok(toClassroomDto(classroom, lecturersMap));
    }

    @DeleteMapping("/{id}")
    @Transactional
    public ResponseEntity<?> deleteClassroom(@PathVariable Long id, HttpServletRequest req) {
        User user = currentUser(req);
        if (user == null) return unauthorized();
        if (!user.isAdmin()) return forbidden();

        Classroom classroom = classroomRepository.findById(id).orElse(null);
        if (classroom == null) return ResponseEntity.notFound().build();

        classroomRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Students
    // ─────────────────────────────────────────────────────────────────────────

    @GetMapping("/{id}/students")
    public ResponseEntity<?> listStudents(@PathVariable Long id, HttpServletRequest req) {
        User user = currentUser(req);
        if (user == null) return unauthorized();

        Classroom classroom = classroomRepository.findById(id).orElse(null);
        if (classroom == null) return ResponseEntity.notFound().build();
        if (!canManageClassroom(classroom, user)) return forbidden();

        List<Map<String, Object>> students = classroomStudentRepository
                .findAllWithUserByClassroomId(id)
                .stream().map(DtoMapper::toClassroomStudentMap).toList();
        return ResponseEntity.ok(students);
    }

    @PostMapping("/{id}/students")
    @Transactional
    public ResponseEntity<?> addStudent(@PathVariable Long id,
                                        @RequestBody Map<String, Object> body,
                                        HttpServletRequest req) {
        User user = currentUser(req);
        if (user == null) return unauthorized();

        Classroom classroom = classroomRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy lớp #" + id));
        if (!canManageClassroom(classroom, user)) return forbidden();

        Object rawStudents = body.get("students");
        if (rawStudents instanceof List<?> list && !list.isEmpty()) {
            int added = 0;
            List<String> errors = new ArrayList<>();
            for (Object item : list) {
                if (item instanceof Map<?, ?> map) {
                    String sid = map.get("studentId") != null ? map.get("studentId").toString()
                            : (map.get("username") != null ? map.get("username").toString() : "");
                    String name = map.get("fullName") != null ? map.get("fullName").toString() : "";
                    try {
                        enrollSingleStudent(classroom, sid, name);
                        added++;
                    } catch (Exception e) {
                        errors.add(sid + ": " + e.getMessage());
                    }
                }
            }
            return ResponseEntity.ok(Map.of("added", added, "errors", errors));
        }

        String studentId = body.get("studentId") != null ? body.get("studentId").toString()
                : (body.get("username") != null ? body.get("username").toString() : "");
        String fullName = body.get("fullName") != null ? body.get("fullName").toString() : "";

        try {
            ClassroomStudent cs = enrollSingleStudent(classroom, studentId, fullName);
            return ResponseEntity.status(HttpStatus.CREATED).body(DtoMapper.toClassroomStudentMap(cs));
        } catch (IllegalArgumentException e) {
            return badRequest(e.getMessage());
        }
    }

    @PostMapping("/{id}/students/import")
    @Transactional
    public ResponseEntity<?> importStudents(@PathVariable Long id,
                                            @RequestParam("file") MultipartFile file,
                                            HttpServletRequest req) {
        User user = currentUser(req);
        if (user == null) return unauthorized();

        Classroom classroom = classroomRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy lớp #" + id));
        if (!canManageClassroom(classroom, user)) return forbidden();

        try {
            Map<String, Object> result = csvImporter.importTo(classroom, file);
            return ResponseEntity.ok(result);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", "Lỗi nhập CSV: " + (e.getMessage() != null ? e.getMessage() : "Dữ liệu không hợp lệ")));
        }
    }

    @DeleteMapping("/{id}/students/{userId}")
    @Transactional
    public ResponseEntity<?> removeStudent(@PathVariable Long id,
                                           @PathVariable Long userId,
                                           HttpServletRequest req) {
        User user = currentUser(req);
        if (user == null) return unauthorized();

        Classroom classroom = classroomRepository.findById(id).orElse(null);
        if (classroom == null) return ResponseEntity.notFound().build();
        if (!canManageClassroom(classroom, user)) return forbidden();

        ClassroomStudent.Id csId = new ClassroomStudent.Id(id, userId);
        if (!classroomStudentRepository.existsById(csId)) return ResponseEntity.notFound().build();
        classroomStudentRepository.deleteById(csId);
        return ResponseEntity.noContent().build();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Contests
    // ─────────────────────────────────────────────────────────────────────────

    @GetMapping("/{id}/contests")
    public ResponseEntity<?> listContests(@PathVariable Long id, HttpServletRequest req) {
        User user = currentUser(req);
        if (user == null) return unauthorized();

        Classroom classroom = classroomRepository.findById(id).orElse(null);
        if (classroom == null) return ResponseEntity.notFound().build();
        if (!canManageClassroom(classroom, user)) return forbidden();

        List<Map<String, Object>> contests = classroomContestRepository
                .findAllWithContestByClassroomId(id)
                .stream().map(cc -> {
                    Contest c = cc.getContest();
                    return Map.<String, Object>of(
                            "contestId", c.getId(),
                            "title", c.getTitle(),
                            "startAt", c.getStartAt().toEpochMilli(),
                            "endAt", c.getEndAt().toEpochMilli(),
                            "assignedAt", cc.getAssignedAt().toEpochMilli()
                    );
                }).toList();
        return ResponseEntity.ok(contests);
    }

    @PostMapping("/{id}/contests")
    @Transactional
    public ResponseEntity<?> assignContest(@PathVariable Long id,
                                           @RequestBody Map<String, Long> body,
                                           HttpServletRequest req) {
        User user = currentUser(req);
        if (user == null) return unauthorized();

        Classroom classroom = classroomRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy lớp #" + id));
        if (!canManageClassroom(classroom, user)) return forbidden();

        Long contestId = body.get("contestId");
        if (contestId == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "contestId là bắt buộc"));
        }
        Contest contest = contestRepository.findById(contestId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy kỳ thi #" + contestId));

        if (user.isLecturer() && contest.getCreatedBy() != null && !contest.getCreatedBy().isAdmin()
                && !contest.getCreatedBy().getId().equals(user.getId())) {
            return forbidden();
        }
        if (classroomContestRepository.existsByClassroomIdAndContestId(id, contestId)) {
            return ResponseEntity.ok(Map.of("message", "Kỳ thi đã được gán cho lớp này"));
        }

        classroomContestRepository.save(new ClassroomContest(classroom, contest, Instant.now()));

        Instant now = Instant.now();
        List<ClassroomStudent> students = classroomStudentRepository.findAllWithUserByClassroomId(id);
        int registered = 0;
        for (ClassroomStudent cs : students) {
            ContestParticipant.Id pid = new ContestParticipant.Id(contest.getId(), cs.getUser().getId());
            if (!contestParticipantRepository.existsById(pid)) {
                contestParticipantRepository.save(new ContestParticipant(contest, cs.getUser(), now));
                registered++;
            }
        }

        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of(
                "contestId", contest.getId(), "title", contest.getTitle(),
                "autoRegistered", registered));
    }

    @DeleteMapping("/{id}/contests/{contestId}")
    @Transactional
    public ResponseEntity<?> unassignContest(@PathVariable Long id,
                                             @PathVariable Long contestId,
                                             HttpServletRequest req) {
        User user = currentUser(req);
        if (user == null) return unauthorized();

        Classroom classroom = classroomRepository.findById(id).orElse(null);
        if (classroom == null) return ResponseEntity.notFound().build();
        if (!canManageClassroom(classroom, user)) return forbidden();

        ClassroomContest.Id ccId = new ClassroomContest.Id(id, contestId);
        if (!classroomContestRepository.existsById(ccId)) return ResponseEntity.notFound().build();
        classroomContestRepository.deleteById(ccId);
        return ResponseEntity.noContent().build();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Course (1:1 per classroom)
    // ─────────────────────────────────────────────────────────────────────────

    @GetMapping("/{id}/course")
    public ResponseEntity<?> getClassroomCourse(@PathVariable Long id, HttpServletRequest req) {
        User user = currentUser(req);
        if (user == null) return unauthorized();

        Classroom classroom = classroomRepository.findById(id).orElse(null);
        if (classroom == null) return ResponseEntity.notFound().build();

        // Admin, Lecturer (sở hữu lớp), hoặc sinh viên trong lớp
        if (!canViewClassroom(classroom, user)) return forbidden();

        ClassroomCourse cc = classroomCourseRepository.findByClassroomId(id).orElse(null);
        if (cc == null) return ResponseEntity.notFound().build();

        Course course = cc.getCourse();
        List<CourseUnit> units = courseUnitRepository.findByCourseIdOrderByOrderIndexAsc(course.getId());

        List<Map<String, Object>> unitDtos = units.stream().map(unit -> {
            List<Map<String, Object>> files = courseUnitFileRepository
                    .findByUnitIdOrderByOrderIndexAsc(unit.getId())
                    .stream().map(f -> Map.<String, Object>of(
                            "id", f.getId(),
                            "filename", f.getFilename(),
                            "fileSize", f.getFileSize() != null ? f.getFileSize() : 0L,
                            "orderIndex", f.getOrderIndex()
                    )).toList();

            List<Map<String, Object>> problems = courseUnitProblemRepository
                    .findByUnitIdOrderByOrderIndexAsc(unit.getId())
                    .stream().map(p -> {
                        var prob = p.getProblem();
                        return Map.<String, Object>of(
                                "id", prob.getId(),
                                "title", prob.getTitle(),
                                "difficulty", prob.getDifficulty().name(),
                                "orderIndex", p.getOrderIndex()
                        );
                    }).toList();

            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", unit.getId());
            m.put("title", unit.getTitle());
            m.put("orderIndex", unit.getOrderIndex());
            m.put("files", files);
            m.put("problems", problems);
            return m;
        }).toList();

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("courseId", course.getId());
        result.put("title", course.getTitle());
        result.put("description", course.getDescription());
        result.put("units", unitDtos);
        return ResponseEntity.ok(result);
    }

    @PutMapping("/{id}/course/{courseId}")
    @Transactional
    public ResponseEntity<?> assignCourse(@PathVariable Long id,
                                          @PathVariable Long courseId,
                                          HttpServletRequest req) {
        User user = currentUser(req);
        if (user == null) return unauthorized();

        Classroom classroom = classroomRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy lớp #" + id));
        if (!canManageClassroom(classroom, user)) return forbidden();

        Course course = courseRepository.findById(courseId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy khóa học #" + courseId));
        if (user.isLecturer() && course.getCreatedBy() != null && !course.getCreatedBy().isAdmin()
                && !course.getCreatedBy().getId().equals(user.getId())) {
            return forbidden();
        }

        classroomCourseRepository.findByClassroomId(id).ifPresentOrElse(
                existing -> existing.setCourse(course),
                () -> classroomCourseRepository.save(new ClassroomCourse(classroom, course))
        );

        return ResponseEntity.ok(Map.of("courseId", course.getId(), "title", course.getTitle()));
    }

    @DeleteMapping("/{id}/course")
    @Transactional
    public ResponseEntity<?> unassignCourse(@PathVariable Long id, HttpServletRequest req) {
        User user = currentUser(req);
        if (user == null) return unauthorized();

        Classroom classroom = classroomRepository.findById(id).orElse(null);
        if (classroom == null) return ResponseEntity.notFound().build();
        if (!canManageClassroom(classroom, user)) return forbidden();

        classroomCourseRepository.deleteByClassroomId(id);
        return ResponseEntity.noContent().build();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────────────────

    /** Admin thấy tất cả; Lecturer thấy lớp của mình; Sinh viên thấy lớp mình thuộc về. */
    private boolean canViewClassroom(Classroom classroom, User user) {
        if (user.isAdmin()) return true;
        if (user.isLecturer()) return isOwner(classroom, user)
                || classroomRepository.isLecturerAssigned(classroom.getId(), user.getId());
        return classroomStudentRepository.existsByClassroomIdAndUserId(classroom.getId(), user.getId());
    }

    /** Admin hoặc Lecturer sở hữu lớp mới được chỉnh sửa. */
    private boolean canManageClassroom(Classroom classroom, User user) {
        if (user.isAdmin()) return true;
        if (user.isLecturer()) return isOwner(classroom, user)
                || classroomRepository.isLecturerAssigned(classroom.getId(), user.getId());
        return false;
    }

    private boolean isOwner(Classroom classroom, User user) {
        return classroom.getLecturer() != null && classroom.getLecturer().getId().equals(user.getId());
    }

    private User findLecturer(String lecturerId) {
        if (lecturerId == null || lecturerId.isBlank()) return null;
        try {
            return userRepository.findById(Long.parseLong(lecturerId))
                    .filter(User::isLecturer)
                    .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy giảng viên được chọn"));
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("Mã giảng viên không hợp lệ");
        }
    }

    private User currentUser(HttpServletRequest req) {
        return (User) req.getAttribute(AuthInterceptor.CURRENT_USER_ATTR);
    }

    private ResponseEntity<Map<String, String>> unauthorized() {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Bạn chưa đăng nhập"));
    }

    private ResponseEntity<Map<String, String>> forbidden() {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "Bạn không có quyền thực hiện thao tác này"));
    }

    private ResponseEntity<Map<String, String>> badRequest(String message) {
        return ResponseEntity.badRequest().body(Map.of("message", message));
    }

    private ClassroomStudent enrollSingleStudent(Classroom classroom, String studentId, String fullName) {
        if (studentId == null || studentId.isBlank()) {
            throw new IllegalArgumentException("Vui lòng nhập mã sinh viên (MSSV)");
        }
        studentId = studentId.trim().toUpperCase();
        if (!studentId.matches("^[A-Za-z0-9._-]{3,32}$")) {
            throw new IllegalArgumentException("Mã sinh viên chỉ gồm chữ, số, dấu chấm, gạch ngang (3-32 ký tự)");
        }
        if (fullName == null || fullName.isBlank()) {
            fullName = studentId;
        } else {
            fullName = fullName.trim();
        }

        String defaultPassword = studentId.length() >= 8 ? studentId : (studentId + "12345678").substring(0, 8);
        User studentUser = userRepository.findByUsernameIgnoreCase(studentId).orElse(null);
        if (studentUser == null) {
            studentUser = User.student(studentId, fullName);
            studentUser.setPasswordHash(securityService.hashPassword(defaultPassword));
            studentUser.setInitialPassword(defaultPassword);
            studentUser = userRepository.save(studentUser);
        } else {
            if (studentUser.getPasswordHash() == null) {
                studentUser.setPasswordHash(securityService.hashPassword(defaultPassword));
                studentUser.setInitialPassword(defaultPassword);
            }
            if (!fullName.equals(studentId) && (studentUser.getFullName() == null || studentUser.getFullName().equals(studentId))) {
                studentUser.setFullName(fullName);
            }
            studentUser = userRepository.save(studentUser);
        }

        if (classroomStudentRepository.existsByClassroomIdAndUserId(classroom.getId(), studentUser.getId())) {
            throw new IllegalArgumentException("Sinh viên " + studentId + " đã có trong lớp này rồi");
        }

        ClassroomStudent cs = new ClassroomStudent(classroom, studentUser, Instant.now());
        cs.setImportedPassword(studentUser.getInitialPassword() != null ? studentUser.getInitialPassword() : defaultPassword);
        ClassroomStudent saved = classroomStudentRepository.save(cs);

        List<ClassroomContest> contests = classroomContestRepository.findAllWithContestByClassroomId(classroom.getId());
        Instant now = Instant.now();
        for (ClassroomContest cc : contests) {
            ContestParticipant.Id pid = new ContestParticipant.Id(cc.getContest().getId(), studentUser.getId());
            if (!contestParticipantRepository.existsById(pid)) {
                contestParticipantRepository.save(new ContestParticipant(cc.getContest(), studentUser, now));
            }
        }

        return saved;
    }

    @PostMapping("/{id}/students/{userId}/reset-password")
    @Transactional
    public ResponseEntity<?> resetStudentPassword(
            @PathVariable Long id,
            @PathVariable Long userId,
            @RequestBody(required = false) Map<String, String> body,
            HttpServletRequest req) {
        User caller = currentUser(req);
        if (caller == null) return unauthorized();
        Classroom classroom = classroomRepository.findById(id).orElse(null);
        if (classroom == null) return ResponseEntity.notFound().build();
        if (!canManageClassroom(classroom, caller)) return forbidden();

        User student = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy người dùng #" + userId));
        if (student.isAdmin() || student.isLecturer()) {
            return forbidden();
        }
        if (!classroomStudentRepository.existsByClassroomIdAndUserId(id, userId)) {
            return ResponseEntity.badRequest().body(Map.of("message", "Sinh viên không thuộc lớp này"));
        }

        String newPassword = body != null ? body.get("password") : null;
        if (newPassword == null || newPassword.isBlank()) {
            newPassword = student.getUsername().length() >= 8 ? student.getUsername() : (student.getUsername() + "12345678").substring(0, 8);
        } else if (newPassword.length() < 8) {
            return ResponseEntity.badRequest().body(Map.of("message", "Mật khẩu phải có ít nhất 8 ký tự"));
        }

        final String finalPassword = newPassword;
        student.setPasswordHash(securityService.hashPassword(finalPassword));
        student.setInitialPassword(finalPassword);
        userRepository.save(student);

        classroomStudentRepository.findById(new ClassroomStudent.Id(id, userId))
                .ifPresent(cs -> {
                    cs.setImportedPassword(finalPassword);
                    classroomStudentRepository.save(cs);
                });

        return ResponseEntity.ok(Map.of("message", "Đã đặt lại mật khẩu thành công", "password", finalPassword));
    }
}
