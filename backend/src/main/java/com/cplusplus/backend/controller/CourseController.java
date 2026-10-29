package com.cplusplus.backend.controller;

import com.cplusplus.backend.domain.course.Course;
import com.cplusplus.backend.domain.course.CourseLesson;
import com.cplusplus.backend.domain.course.CourseUnit;
import com.cplusplus.backend.domain.course.CourseUnitProblem;
import com.cplusplus.backend.domain.problem.Problem;
import com.cplusplus.backend.domain.submission.Verdict;
import com.cplusplus.backend.domain.user.User;
import com.cplusplus.backend.dto.DtoMapper;
import com.cplusplus.backend.repository.*;
import com.cplusplus.backend.security.AuthInterceptor;
import com.cplusplus.backend.service.CourseProgressService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/courses")
public class CourseController {

    private final CourseRepository courseRepository;
    private final CourseUnitRepository courseUnitRepository;
    private final CourseLessonRepository courseLessonRepository;
    private final CourseUnitProblemRepository unitProblemRepository;
    private final ProblemRepository problemRepository;
    private final SubmissionRepository submissionRepository;
    private final CourseProgressService courseProgressService;

    public CourseController(CourseRepository courseRepository,
                            CourseUnitRepository courseUnitRepository,
                            CourseLessonRepository courseLessonRepository,
                            CourseUnitProblemRepository unitProblemRepository,
                            ProblemRepository problemRepository,
                            SubmissionRepository submissionRepository,
                            CourseProgressService courseProgressService) {
        this.courseRepository = courseRepository;
        this.courseUnitRepository = courseUnitRepository;
        this.courseLessonRepository = courseLessonRepository;
        this.unitProblemRepository = unitProblemRepository;
        this.problemRepository = problemRepository;
        this.submissionRepository = submissionRepository;
        this.courseProgressService = courseProgressService;
    }

    // -------------------------------------------------------------------------
    // Course APIs
    // -------------------------------------------------------------------------

    @GetMapping
    public ResponseEntity<?> listCourses(HttpServletRequest req) {
        User user = currentUser(req);
        if (user == null) return unauthorized();

        List<Course> list = user.isAdmin()
                ? courseRepository.findAllByOrderByCreatedAtDesc()
                : courseRepository.findByPublishedTrueOrderByCreatedAtDesc();

        return ResponseEntity.ok(list.stream().map(DtoMapper::toCourseMap).toList());
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getCourse(@PathVariable Long id, HttpServletRequest req) {
        User user = currentUser(req);
        if (user == null) return unauthorized();

        Optional<Course> opt = courseRepository.findById(id);
        if (opt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Không tìm thấy khóa học"));
        }

        Course course = opt.get();
        if (!user.isAdmin() && !course.isPublished()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Khóa học chưa được công khai"));
        }

        Map<String, Object> map = new LinkedHashMap<>(DtoMapper.toCourseDetailMap(course));
        Map<String, Object> progress = courseProgressService.getCourseProgress(user, id);
        map.put("progress", progress);

        // Mark units locked/unlocked (sequential unlock; admins bypass)
        if (!user.isAdmin()) {
            @SuppressWarnings("unchecked")
            List<Long> completedIds = (List<Long>) progress.get("completedUnitIds");
            Set<Long> completedSet = completedIds != null ? new HashSet<>(completedIds) : Set.of();
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> units = (List<Map<String, Object>>) map.get("units");
            if (units != null) {
                for (int i = 0; i < units.size(); i++) {
                    boolean locked = i > 0 && !completedSet.contains((Long) units.get(i - 1).get("id"));
                    units.get(i).put("locked", locked);
                }
            }
        }

        return ResponseEntity.ok(map);
    }

    @PostMapping
    @Transactional
    public ResponseEntity<?> createCourse(@RequestBody Map<String, Object> body, HttpServletRequest req) {
        User user = currentUser(req);
        if (user == null) return unauthorized();
        if (!user.isAdmin()) return forbidden();

        String title = (String) body.get("title");
        if (title == null || title.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Tiêu đề khóa học không được để trống"));
        }

        String description = (String) body.get("description");
        Boolean published = body.get("published") instanceof Boolean b ? b : false;

        Course course = new Course(title.trim(), description, published);
        Course saved = courseRepository.save(course);

        return ResponseEntity.status(HttpStatus.CREATED).body(DtoMapper.toCourseMap(saved));
    }

    @PutMapping("/{id}")
    @Transactional
    public ResponseEntity<?> updateCourse(@PathVariable Long id,
                                          @RequestBody Map<String, Object> body,
                                          HttpServletRequest req) {
        User user = currentUser(req);
        if (user == null) return unauthorized();
        if (!user.isAdmin()) return forbidden();

        Optional<Course> opt = courseRepository.findById(id);
        if (opt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Không tìm thấy khóa học"));
        }

        Course course = opt.get();
        if (body.containsKey("title")) {
            String title = (String) body.get("title");
            if (title != null && !title.isBlank()) {
                course.setTitle(title.trim());
            }
        }
        if (body.containsKey("description")) {
            course.setDescription((String) body.get("description"));
        }
        if (body.containsKey("published") && body.get("published") instanceof Boolean b) {
            course.setPublished(b);
        }

        Course updated = courseRepository.save(course);
        return ResponseEntity.ok(DtoMapper.toCourseDetailMap(updated));
    }

    @DeleteMapping("/{id}")
    @Transactional
    public ResponseEntity<?> deleteCourse(@PathVariable Long id, HttpServletRequest req) {
        User user = currentUser(req);
        if (user == null) return unauthorized();
        if (!user.isAdmin()) return forbidden();

        if (!courseRepository.existsById(id)) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Không tìm thấy khóa học"));
        }

        courseRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    // -------------------------------------------------------------------------
    // Unit APIs
    // -------------------------------------------------------------------------

    @PostMapping("/{id}/units")
    @Transactional
    public ResponseEntity<?> addUnit(@PathVariable Long id,
                                     @RequestBody Map<String, Object> body,
                                     HttpServletRequest req) {
        User user = currentUser(req);
        if (user == null) return unauthorized();
        if (!user.isAdmin()) return forbidden();

        Optional<Course> opt = courseRepository.findById(id);
        if (opt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Không tìm thấy khóa học"));
        }

        Course course = opt.get();
        String title = (String) body.get("title");
        if (title == null || title.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Tiêu đề chủ đề không được để trống"));
        }

        int orderIndex;
        if (body.get("orderIndex") instanceof Number n) {
            orderIndex = n.intValue();
        } else {
            orderIndex = courseUnitRepository.findMaxOrderIndexByCourseId(id) + 1;
        }

        CourseUnit unit = new CourseUnit(course, title.trim(), orderIndex);
        CourseUnit saved = courseUnitRepository.save(unit);

        return ResponseEntity.status(HttpStatus.CREATED).body(DtoMapper.toCourseUnitMap(saved));
    }

    @PutMapping("/{id}/units/{uid}")
    @Transactional
    public ResponseEntity<?> updateUnit(@PathVariable Long id,
                                        @PathVariable Long uid,
                                        @RequestBody Map<String, Object> body,
                                        HttpServletRequest req) {
        User user = currentUser(req);
        if (user == null) return unauthorized();
        if (!user.isAdmin()) return forbidden();

        Optional<CourseUnit> opt = courseUnitRepository.findByIdAndCourseId(uid, id);
        if (opt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Không tìm thấy chủ đề"));
        }

        CourseUnit unit = opt.get();
        if (body.containsKey("title")) {
            String title = (String) body.get("title");
            if (title != null && !title.isBlank()) {
                unit.setTitle(title.trim());
            }
        }
        if (body.containsKey("orderIndex") && body.get("orderIndex") instanceof Number n) {
            unit.setOrderIndex(n.intValue());
        }

        CourseUnit updated = courseUnitRepository.save(unit);
        return ResponseEntity.ok(DtoMapper.toCourseUnitMap(updated));
    }

    @DeleteMapping("/{id}/units/{uid}")
    @Transactional
    public ResponseEntity<?> deleteUnit(@PathVariable Long id,
                                        @PathVariable Long uid,
                                        HttpServletRequest req) {
        User user = currentUser(req);
        if (user == null) return unauthorized();
        if (!user.isAdmin()) return forbidden();

        Optional<CourseUnit> opt = courseUnitRepository.findByIdAndCourseId(uid, id);
        if (opt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Không tìm thấy chủ đề"));
        }

        courseUnitRepository.delete(opt.get());
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/{id}/units/reorder")
    @Transactional
    public ResponseEntity<?> reorderUnits(@PathVariable Long id,
                                          @RequestBody List<Map<String, Object>> items,
                                          HttpServletRequest req) {
        User user = currentUser(req);
        if (user == null) return unauthorized();
        if (!user.isAdmin()) return forbidden();

        if (!courseRepository.existsById(id)) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Không tìm thấy khóa học"));
        }

        List<CourseUnit> currentUnits = courseUnitRepository.findByCourseIdOrderByOrderIndexAsc(id);
        Map<Long, CourseUnit> unitMap = new HashMap<>();
        for (CourseUnit u : currentUnits) {
            unitMap.put(u.getId(), u);
        }

        // Bước 1: Đặt order_index tạm thời về âm để tránh dính UNIQUE (course_id, order_index)
        for (int i = 0; i < items.size(); i++) {
            Map<String, Object> item = items.get(i);
            if (item.get("id") instanceof Number numId) {
                Long unitId = numId.longValue();
                CourseUnit u = unitMap.get(unitId);
                if (u != null) {
                    u.setOrderIndex(-(i + 1));
                    courseUnitRepository.save(u);
                }
            }
        }
        courseUnitRepository.flush();

        // Bước 2: Cập nhật order_index mới
        for (Map<String, Object> item : items) {
            if (item.get("id") instanceof Number numId && item.get("orderIndex") instanceof Number numOrder) {
                Long unitId = numId.longValue();
                int orderIndex = numOrder.intValue();
                CourseUnit u = unitMap.get(unitId);
                if (u != null) {
                    u.setOrderIndex(orderIndex);
                    courseUnitRepository.save(u);
                }
            }
        }

        List<CourseUnit> updatedUnits = courseUnitRepository.findByCourseIdOrderByOrderIndexAsc(id);
        return ResponseEntity.ok(updatedUnits.stream().map(DtoMapper::toCourseUnitMap).toList());
    }

    // -------------------------------------------------------------------------
    // Lesson APIs
    // -------------------------------------------------------------------------

    @GetMapping("/units/{unitId}/lesson")
    public ResponseEntity<?> getLesson(@PathVariable Long unitId, HttpServletRequest req) {
        User user = currentUser(req);
        if (user == null) return unauthorized();

        Optional<CourseUnit> unitOpt = courseUnitRepository.findById(unitId);
        if (unitOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Không tìm thấy chủ đề"));
        }

        CourseUnit unit = unitOpt.get();
        if (!user.isAdmin() && !unit.getCourse().isPublished()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Khóa học chưa được công khai"));
        }

        if (courseProgressService.isUnitLocked(user, unit)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "Bạn cần hoàn thành chủ đề trước để mở khóa chủ đề này"));
        }

        Optional<CourseLesson> lessonOpt = courseLessonRepository.findByUnitId(unitId);
        if (lessonOpt.isPresent()) {
            return ResponseEntity.ok(DtoMapper.toCourseLessonMap(lessonOpt.get()));
        } else {
            return ResponseEntity.ok(DtoMapper.defaultLessonMap(unit));
        }
    }

    @PutMapping("/units/{unitId}/lesson")
    @Transactional
    public ResponseEntity<?> updateLesson(@PathVariable Long unitId,
                                          @RequestBody Map<String, Object> body,
                                          HttpServletRequest req) {
        User user = currentUser(req);
        if (user == null) return unauthorized();
        if (!user.isAdmin()) return forbidden();

        Optional<CourseUnit> unitOpt = courseUnitRepository.findById(unitId);
        if (unitOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Không tìm thấy chủ đề"));
        }

        CourseUnit unit = unitOpt.get();
        String theory = body.get("theoryContent") != null ? body.get("theoryContent").toString() : "";
        String sampleCode = body.get("sampleCode") != null ? body.get("sampleCode").toString() : "";
        String sampleInput = body.get("sampleInput") != null ? body.get("sampleInput").toString() : "";

        CourseLesson lesson = courseLessonRepository.findByUnitId(unitId)
                .orElseGet(() -> new CourseLesson(unit, theory, sampleCode, sampleInput));

        lesson.setTheoryContent(theory);
        lesson.setSampleCode(sampleCode);
        lesson.setSampleInput(sampleInput);

        CourseLesson saved = courseLessonRepository.save(lesson);
        return ResponseEntity.ok(DtoMapper.toCourseLessonMap(saved));
    }

    // -------------------------------------------------------------------------
    // Unit Problem & Progress APIs (Module graded)
    // -------------------------------------------------------------------------

    @GetMapping("/units/{unitId}/problems")
    public ResponseEntity<?> getUnitProblems(@PathVariable Long unitId, HttpServletRequest req) {
        User user = currentUser(req);
        if (user == null) return unauthorized();

        Optional<CourseUnit> unitOpt = courseUnitRepository.findById(unitId);
        if (unitOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Không tìm thấy chủ đề"));
        }

        List<CourseUnitProblem> list = unitProblemRepository.findByUnitIdOrderByOrderIndexAsc(unitId);
        List<Map<String, Object>> result = new ArrayList<>();

        for (CourseUnitProblem up : list) {
            Long pid = up.getProblem().getId();
            boolean solved = submissionRepository.existsByUserIdAndProblemIdAndVerdict(user.getId(), pid, Verdict.AC);
            result.add(DtoMapper.toUnitProblemMap(up, solved));
        }

        return ResponseEntity.ok(result);
    }

    @PostMapping("/units/{unitId}/problems")
    @Transactional
    public ResponseEntity<?> assignUnitProblem(@PathVariable Long unitId,
                                               @RequestBody Map<String, Object> body,
                                               HttpServletRequest req) {
        User user = currentUser(req);
        if (user == null) return unauthorized();
        if (!user.isAdmin()) return forbidden();

        Optional<CourseUnit> unitOpt = courseUnitRepository.findById(unitId);
        if (unitOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Không tìm thấy chủ đề"));
        }

        Object pVal = body.get("problemId");
        if (pVal == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Thiếu problemId"));
        }
        Long problemId = ((Number) pVal).longValue();

        Optional<Problem> probOpt = problemRepository.findById(problemId);
        if (probOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Không tìm thấy bài tập"));
        }

        Optional<CourseUnitProblem> existing = unitProblemRepository.findByUnitIdAndProblemId(unitId, problemId);
        if (existing.isPresent()) {
            return ResponseEntity.ok(DtoMapper.toUnitProblemMap(existing.get(), false));
        }

        int nextOrder = unitProblemRepository.findByUnitIdOrderByOrderIndexAsc(unitId).size() + 1;
        CourseUnitProblem cup = new CourseUnitProblem(unitOpt.get(), probOpt.get(), nextOrder);
        CourseUnitProblem saved = unitProblemRepository.save(cup);

        return ResponseEntity.ok(DtoMapper.toUnitProblemMap(saved, false));
    }

    @DeleteMapping("/units/{unitId}/problems/{problemId}")
    @Transactional
    public ResponseEntity<?> removeUnitProblem(@PathVariable Long unitId,
                                               @PathVariable Long problemId,
                                               HttpServletRequest req) {
        User user = currentUser(req);
        if (user == null) return unauthorized();
        if (!user.isAdmin()) return forbidden();

        unitProblemRepository.deleteByUnitIdAndProblemId(unitId, problemId);
        return ResponseEntity.ok(Map.of("success", true));
    }

    @GetMapping("/{id}/progress")
    public ResponseEntity<?> getCourseProgress(@PathVariable Long id, HttpServletRequest req) {
        User user = currentUser(req);
        if (user == null) return unauthorized();

        Optional<Course> courseOpt = courseRepository.findById(id);
        if (courseOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Không tìm thấy khóa học"));
        }

        Map<String, Object> progress = courseProgressService.getCourseProgress(user, id);
        return ResponseEntity.ok(progress);
    }

    @PostMapping("/units/{unitId}/toggle-progress")
    @Transactional
    public ResponseEntity<?> toggleUnitProgress(@PathVariable Long unitId, HttpServletRequest req) {
        User user = currentUser(req);
        if (user == null) return unauthorized();

        Optional<CourseUnit> unitOpt = courseUnitRepository.findById(unitId);
        if (unitOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Không tìm thấy chủ đề"));
        }
        CourseUnit unit = unitOpt.get();
        if (courseProgressService.isUnitLocked(user, unit)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("message", "Hãy hoàn thành chủ đề trước để mở khóa chủ đề này"));
        }

        boolean completed = courseProgressService.toggleUnitProgress(user, unitId);
        return ResponseEntity.ok(Map.of("unitId", unitId, "completed", completed));
    }

    // -------------------------------------------------------------------------
    // Helper methods
    // -------------------------------------------------------------------------

    private static User currentUser(HttpServletRequest req) {
        return (User) req.getAttribute(AuthInterceptor.CURRENT_USER_ATTR);
    }

    private static ResponseEntity<?> unauthorized() {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(Map.of("error", "Yêu cầu đăng nhập"));
    }

    private static ResponseEntity<?> forbidden() {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(Map.of("error", "Chỉ quản trị viên mới có quyền thực hiện thao tác này"));
    }
}
