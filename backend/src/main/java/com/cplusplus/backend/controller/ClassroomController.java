package com.cplusplus.backend.controller;

import com.cplusplus.backend.domain.classroom.Classroom;
import com.cplusplus.backend.domain.classroom.ClassroomContest;
import com.cplusplus.backend.domain.classroom.ClassroomStudent;
import com.cplusplus.backend.domain.contest.Contest;
import com.cplusplus.backend.domain.contest.ContestParticipant;
import com.cplusplus.backend.domain.user.User;
import com.cplusplus.backend.dto.DtoMapper;
import com.cplusplus.backend.repository.ClassroomContestRepository;
import com.cplusplus.backend.repository.ClassroomRepository;
import com.cplusplus.backend.repository.ClassroomStudentRepository;
import com.cplusplus.backend.repository.ContestParticipantRepository;
import com.cplusplus.backend.repository.ContestRepository;
import com.cplusplus.backend.security.AuthInterceptor;
import com.cplusplus.backend.service.ClassroomCsvImporter;
import com.cplusplus.backend.repository.UserRepository;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.time.Instant;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/classrooms")
@Transactional(readOnly = true)
public class ClassroomController {

    private final ClassroomRepository classroomRepository;
    private final ClassroomStudentRepository classroomStudentRepository;
    private final ClassroomContestRepository classroomContestRepository;
    private final ContestRepository contestRepository;
    private final ContestParticipantRepository contestParticipantRepository;
    private final ClassroomCsvImporter csvImporter;
    private final UserRepository userRepository;

    public ClassroomController(ClassroomRepository classroomRepository,
                               ClassroomStudentRepository classroomStudentRepository,
                               ClassroomContestRepository classroomContestRepository,
                               ContestRepository contestRepository,
                               ContestParticipantRepository contestParticipantRepository,
                               ClassroomCsvImporter csvImporter,
                               UserRepository userRepository) {
        this.classroomRepository = classroomRepository;
        this.classroomStudentRepository = classroomStudentRepository;
        this.classroomContestRepository = classroomContestRepository;
        this.contestRepository = contestRepository;
        this.contestParticipantRepository = contestParticipantRepository;
        this.csvImporter = csvImporter;
        this.userRepository = userRepository;
    }

    // -------------------------------------------------------------------------
    // Classroom CRUD
    // -------------------------------------------------------------------------

    @GetMapping
    public ResponseEntity<?> listClassrooms(HttpServletRequest req) {
        User user = currentUser(req);
        if (user == null) return unauthorized();

        List<Classroom> list = user.isAdmin()
                ? classroomRepository.findAll()
                : classroomRepository.findByStudentUserId(user.getId());

        return ResponseEntity.ok(list.stream().map(DtoMapper::toClassroomMap).toList());
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
        return ResponseEntity.status(HttpStatus.CREATED).body(DtoMapper.toClassroomMap(classroom));
    }

    @PutMapping("/{id}")
    @Transactional
    public ResponseEntity<?> updateClassroom(@PathVariable Long id,
                                             @RequestBody Map<String, String> body,
                                             HttpServletRequest req) {
        User user = currentUser(req);
        if (user == null) return unauthorized();
        if (!user.isAdmin()) return forbidden();

        Classroom classroom = classroomRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy lớp #" + id));

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
        if (!user.isAdmin()) return forbidden();

        if (!classroomRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        classroomRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    // -------------------------------------------------------------------------
    // Students
    // -------------------------------------------------------------------------

    @GetMapping("/{id}/students")
    public ResponseEntity<?> listStudents(@PathVariable Long id, HttpServletRequest req) {
        User user = currentUser(req);
        if (user == null) return unauthorized();
        if (!user.isAdmin()) return forbidden();

        if (!classroomRepository.existsById(id)) return ResponseEntity.notFound().build();

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
        if (!user.isAdmin()) return forbidden();

        Classroom classroom = classroomRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy lớp #" + id));

        Object rawStudents = body.get("students");
        if (rawStudents instanceof List<?> list && !list.isEmpty()) {
            int added = 0;
            List<String> errors = new java.util.ArrayList<>();
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
        if (!user.isAdmin()) return forbidden();

        Classroom classroom = classroomRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy lớp #" + id));

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
        if (!user.isAdmin()) return forbidden();

        ClassroomStudent.Id csId = new ClassroomStudent.Id(id, userId);
        if (!classroomStudentRepository.existsById(csId)) return ResponseEntity.notFound().build();
        classroomStudentRepository.deleteById(csId);
        return ResponseEntity.noContent().build();
    }

    // -------------------------------------------------------------------------
    // Contests
    // -------------------------------------------------------------------------

    @GetMapping("/{id}/contests")
    public ResponseEntity<?> listContests(@PathVariable Long id, HttpServletRequest req) {
        User user = currentUser(req);
        if (user == null) return unauthorized();
        if (!user.isAdmin()) return forbidden();

        if (!classroomRepository.existsById(id)) return ResponseEntity.notFound().build();

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
        if (!user.isAdmin()) return forbidden();

        Classroom classroom = classroomRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy lớp #" + id));

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

        // Auto-register tất cả sinh viên trong lớp vào contest
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
        if (!user.isAdmin()) return forbidden();

        ClassroomContest.Id ccId = new ClassroomContest.Id(id, contestId);
        if (!classroomContestRepository.existsById(ccId)) return ResponseEntity.notFound().build();
        classroomContestRepository.deleteById(ccId);
        return ResponseEntity.noContent().build();
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    private User currentUser(HttpServletRequest req) {
        return (User) req.getAttribute(AuthInterceptor.CURRENT_USER_ATTR);
    }

    private ResponseEntity<Map<String, String>> unauthorized() {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(Map.of("error", "Bạn chưa đăng nhập"));
    }

    private ResponseEntity<Map<String, String>> forbidden() {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(Map.of("error", "Chỉ quản trị viên mới có quyền thực hiện thao tác này"));
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

    private ResponseEntity<Map<String, String>> badRequest(String message) {
        return ResponseEntity.badRequest().body(Map.of("message", message));
    }
}
