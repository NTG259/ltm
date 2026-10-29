package com.cplusplus.backend.controller;

import com.cplusplus.backend.domain.classroom.Classroom;
import com.cplusplus.backend.domain.classroom.ClassroomContest;
import com.cplusplus.backend.domain.classroom.ClassroomCourse;
import com.cplusplus.backend.domain.classroom.ClassroomStudent;
import com.cplusplus.backend.domain.contest.Contest;
import com.cplusplus.backend.domain.contest.ContestParticipant;
import com.cplusplus.backend.domain.course.Course;
import com.cplusplus.backend.domain.course.CourseUnit;
import com.cplusplus.backend.domain.course.CourseUnitFile;
import com.cplusplus.backend.domain.user.User;
import com.cplusplus.backend.dto.DtoMapper;
import com.cplusplus.backend.repository.*;
import com.cplusplus.backend.security.AuthInterceptor;
import com.cplusplus.backend.service.ClassroomCsvImporter;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
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
                               UserRepository userRepository) {
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
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Classroom CRUD
    // ─────────────────────────────────────────────────────────────────────────

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
        return ResponseEntity.ok(list.stream().map(DtoMapper::toClassroomMap).toList());
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

        Map<String, Object> result = new LinkedHashMap<>(DtoMapper.toClassroomMap(classroom));
        result.put("contests", contests);
        return ResponseEntity.ok(result);
    }

    @PostMapping
    @Transactional
    public ResponseEntity<?> createClassroom(@RequestBody Map<String, String> body,
                                             HttpServletRequest req) {
        User user = currentUser(req);
        if (user == null) return unauthorized();
        if (!user.isAdminOrLecturer()) return forbidden();

        String name = body.get("name");
        if (name == null || name.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Tên lớp không được để trống"));
        }
        Classroom classroom = classroomRepository.save(
                new Classroom(name.trim(), body.get("semester"), user));
        return ResponseEntity.status(HttpStatus.CREATED).body(DtoMapper.toClassroomMap(classroom));
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
        return ResponseEntity.ok(DtoMapper.toClassroomMap(classroom));
    }

    @DeleteMapping("/{id}")
    @Transactional
    public ResponseEntity<?> deleteClassroom(@PathVariable Long id, HttpServletRequest req) {
        User user = currentUser(req);
        if (user == null) return unauthorized();

        Classroom classroom = classroomRepository.findById(id).orElse(null);
        if (classroom == null) return ResponseEntity.notFound().build();
        if (!canManageClassroom(classroom, user)) return forbidden();

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

        Map<String, Object> result = csvImporter.importTo(classroom, file);
        return ResponseEntity.ok(result);
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
        return classroom.getCreatedBy() != null && classroom.getCreatedBy().getId().equals(user.getId());
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
        if (!studentId.matches("^[A-Z][0-9]{2}[A-Z]{4}[0-9]{3}$")) {
            throw new IllegalArgumentException("Mã sinh viên không đúng định dạng (VD: B20DCCN001)");
        }
        if (fullName == null || fullName.isBlank()) {
            fullName = studentId;
        } else {
            fullName = fullName.trim();
        }

        User studentUser = userRepository.findByUsernameIgnoreCase(studentId).orElse(null);
        if (studentUser == null) {
            studentUser = userRepository.save(User.student(studentId, fullName));
        } else if (!fullName.equals(studentId) && (studentUser.getFullName() == null || studentUser.getFullName().equals(studentId))) {
            studentUser.setFullName(fullName);
            userRepository.save(studentUser);
        }

        if (classroomStudentRepository.existsByClassroomIdAndUserId(classroom.getId(), studentUser.getId())) {
            throw new IllegalArgumentException("Sinh viên " + studentId + " đã có trong lớp này rồi");
        }

        List<Classroom> otherClasses = classroomRepository.findByStudentUserId(studentUser.getId());
        if (!otherClasses.isEmpty()) {
            throw new IllegalArgumentException("Sinh viên " + studentId + " hiện đã thuộc lớp '" + otherClasses.get(0).getName() + "'. Mỗi sinh viên chỉ được thuộc 1 lớp.");
        }

        return classroomStudentRepository.save(new ClassroomStudent(classroom, studentUser, Instant.now()));
    }
}
