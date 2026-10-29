package com.cplusplus.backend.service;

import com.cplusplus.backend.domain.course.CourseUnit;
import com.cplusplus.backend.domain.course.CourseUnitProblem;
import com.cplusplus.backend.domain.course.UserUnitProgress;
import com.cplusplus.backend.domain.user.User;
import com.cplusplus.backend.repository.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;

@Service
public class CourseProgressService {

    private static final Logger log = LoggerFactory.getLogger(CourseProgressService.class);

    private final CourseUnitProblemRepository unitProblemRepository;
    private final UserUnitProgressRepository progressRepository;
    private final CourseUnitRepository courseUnitRepository;

    public CourseProgressService(CourseUnitProblemRepository unitProblemRepository,
                                 UserUnitProgressRepository progressRepository,
                                 CourseUnitRepository courseUnitRepository) {
        this.unitProblemRepository = unitProblemRepository;
        this.progressRepository = progressRepository;
        this.courseUnitRepository = courseUnitRepository;
    }

    /**
     * Tự động đánh dấu hoàn thành các chủ đề có chứa bài tập vừa giải AC.
     */
    @Transactional
    public void recordProblemSolved(User user, Long problemId) {
        if (user == null || problemId == null) return;

        List<CourseUnitProblem> unitProblems = unitProblemRepository.findByProblemId(problemId);
        if (unitProblems.isEmpty()) return;

        for (CourseUnitProblem up : unitProblems) {
            CourseUnit unit = up.getUnit();
            if (unit == null) continue;

            Optional<UserUnitProgress> existing = progressRepository.findByUserIdAndUnitId(user.getId(), unit.getId());
            if (existing.isPresent()) {
                UserUnitProgress prog = existing.get();
                if (!prog.isCompleted()) {
                    prog.setCompleted(true);
                    prog.setCompletedAt(Instant.now());
                    progressRepository.save(prog);
                    log.info("Cập nhật tiến độ hoàn thành: User #{} hoàn thành Unit #{} qua bài tập #{}",
                            user.getId(), unit.getId(), problemId);
                }
            } else {
                UserUnitProgress prog = new UserUnitProgress(user, unit, true);
                progressRepository.save(prog);
                log.info("Tạo mới tiến độ: User #{} hoàn thành Unit #{} qua bài tập #{}",
                        user.getId(), unit.getId(), problemId);
            }
        }
    }

    /**
     * Cho phép học viên tự chuyển đổi trạng thái hoàn thành chủ đề.
     */
    @Transactional
    public boolean toggleUnitProgress(User user, Long unitId) {
        Optional<CourseUnit> unitOpt = courseUnitRepository.findById(unitId);
        if (unitOpt.isEmpty()) return false;

        CourseUnit unit = unitOpt.get();
        Optional<UserUnitProgress> existing = progressRepository.findByUserIdAndUnitId(user.getId(), unit.getId());
        if (existing.isPresent()) {
            UserUnitProgress prog = existing.get();
            boolean nextState = !prog.isCompleted();
            prog.setCompleted(nextState);
            progressRepository.save(prog);
            return nextState;
        } else {
            UserUnitProgress prog = new UserUnitProgress(user, unit, true);
            progressRepository.save(prog);
            return true;
        }
    }

    /**
     * Kiểm tra unit có bị khóa với user không (unit đầu tiên trong khóa luôn mở).
     * Unit bị khóa nếu unit trước nó (theo orderIndex) chưa được hoàn thành.
     */
    @Transactional(readOnly = true)
    public boolean isUnitLocked(User user, CourseUnit unit) {
        if (user.isAdmin()) return false;
        List<CourseUnit> siblings = courseUnitRepository.findByCourseIdOrderByOrderIndexAsc(unit.getCourse().getId());
        int idx = -1;
        for (int i = 0; i < siblings.size(); i++) {
            if (siblings.get(i).getId().equals(unit.getId())) {
                idx = i;
                break;
            }
        }
        if (idx <= 0) return false; // first unit or not found → always unlocked
        CourseUnit prev = siblings.get(idx - 1);
        return progressRepository.findByUserIdAndUnitId(user.getId(), prev.getId())
                .map(p -> !p.isCompleted())
                .orElse(true); // no progress record → locked
    }

    /**
     * Lấy dữ liệu tiến độ của một học viên trong khóa học.
     */
    @Transactional(readOnly = true)
    public Map<String, Object> getCourseProgress(User user, Long courseId) {
        List<CourseUnit> units = courseUnitRepository.findByCourseIdOrderByOrderIndexAsc(courseId);
        List<Long> completedRaw = progressRepository.findCompletedUnitIdsNative(user.getId(), courseId);
        Set<Long> completedUnitIds = new HashSet<>(completedRaw != null ? completedRaw : List.of());

        int total = units.size();
        int completed = completedUnitIds.size();
        int percent = total > 0 ? (int) Math.round(((double) completed / total) * 100) : 0;

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("courseId", courseId);
        res.put("completedUnitIds", new ArrayList<>(completedUnitIds));
        res.put("completedCount", completed);
        res.put("totalUnits", total);
        res.put("percent", percent);
        return res;
    }
}
