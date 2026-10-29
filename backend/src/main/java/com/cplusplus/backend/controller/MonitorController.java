package com.cplusplus.backend.controller;

import com.cplusplus.backend.domain.contest.Contest;
import com.cplusplus.backend.domain.contest.ContestProblem;
import com.cplusplus.backend.domain.classroom.ClassroomStudent;
import com.cplusplus.backend.domain.submission.Submission;
import com.cplusplus.backend.domain.submission.Verdict;
import com.cplusplus.backend.domain.user.Role;
import com.cplusplus.backend.domain.user.User;
import com.cplusplus.backend.master.service.JudgeMasterService;
import com.cplusplus.backend.repository.ClassroomStudentRepository;
import com.cplusplus.backend.repository.ClassroomRepository;
import com.cplusplus.backend.repository.ClassroomContestRepository;
import com.cplusplus.backend.repository.ContestProblemRepository;
import com.cplusplus.backend.repository.ContestRepository;
import com.cplusplus.backend.repository.SubmissionRepository;
import com.cplusplus.backend.security.AuthInterceptor;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/classrooms")
public class MonitorController {

    private final ClassroomStudentRepository classroomStudentRepository;
    private final ClassroomRepository classroomRepository;
    private final ClassroomContestRepository classroomContestRepository;
    private final ContestRepository contestRepository;
    private final ContestProblemRepository contestProblemRepository;
    private final SubmissionRepository submissionRepository;
    private final JudgeMasterService judgeMasterService;

    public MonitorController(
            ClassroomStudentRepository classroomStudentRepository,
            ClassroomRepository classroomRepository,
            ClassroomContestRepository classroomContestRepository,
            ContestRepository contestRepository,
            ContestProblemRepository contestProblemRepository,
            SubmissionRepository submissionRepository,
            JudgeMasterService judgeMasterService) {
        this.classroomStudentRepository = classroomStudentRepository;
        this.classroomRepository = classroomRepository;
        this.classroomContestRepository = classroomContestRepository;
        this.contestRepository = contestRepository;
        this.contestProblemRepository = contestProblemRepository;
        this.submissionRepository = submissionRepository;
        this.judgeMasterService = judgeMasterService;
    }

    /** Snapshot online/offline của sinh viên trong lớp. */
    @GetMapping("/{id}/presence")
    public List<Map<String, Object>> getPresence(@PathVariable Long id, HttpServletRequest req) {
        requireClassroomManager(req, id, null);
        List<ClassroomStudent> students = classroomStudentRepository.findAllWithUserByClassroomId(id);
        Set<Long> onlineIds = judgeMasterService.getOnlineUserIds();

        return students.stream().map(cs -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("userId", cs.getUser().getId());
            m.put("username", cs.getUser().getUsername());
            m.put("fullName", cs.getUser().getFullName());
            m.put("online", onlineIds.contains(cs.getUser().getId()));
            return m;
        }).toList();
    }

    /** Snapshot trạng thái thi ICPC của từng sinh viên trong lớp. */
    @GetMapping("/{cid}/contests/{kid}/monitor")
    public List<Map<String, Object>> getContestMonitor(
            @PathVariable Long cid, @PathVariable Long kid, HttpServletRequest req) {
        requireClassroomManager(req, cid, kid);

        List<ClassroomStudent> students = classroomStudentRepository.findAllWithUserByClassroomId(cid);
        Set<Long> studentIds = students.stream()
                .map(cs -> cs.getUser().getId())
                .collect(Collectors.toSet());

        Contest contest = contestRepository.findById(kid)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Contest not found"));

        List<ContestProblem> contestProblems = contestProblemRepository.findByContestIdOrderByLabel(kid);
        Map<Long, String> problemLabels = contestProblems.stream()
                .collect(Collectors.toMap(cp -> cp.getId().getProblemId(), ContestProblem::getLabel));
        List<String> labels = contestProblems.stream().map(ContestProblem::getLabel).toList();

        List<Submission> allSubs = submissionRepository.findAllByContestIdWithDetails(kid).stream()
                .filter(s -> studentIds.contains(s.getUser().getId()))
                .toList();

        Map<Long, List<Submission>> byUser = allSubs.stream()
                .collect(Collectors.groupingBy(s -> s.getUser().getId()));

        Set<Long> onlineIds = judgeMasterService.getOnlineUserIds();

        return students.stream().map(cs -> {
            User user = cs.getUser();
            List<Submission> userSubs = byUser.getOrDefault(user.getId(), List.of());

            // Khởi tạo cell cho mỗi bài
            Map<String, Map<String, Object>> cells = new LinkedHashMap<>();
            for (String label : labels) {
                Map<String, Object> cell = new LinkedHashMap<>();
                cell.put("label", label);
                cell.put("verdict", null);
                cell.put("attempts", 0);
                cell.put("acAt", null);
                cells.put(label, cell);
            }

            // Sắp xếp theo thời gian nộp để tính đúng thứ tự
            List<Submission> sorted = userSubs.stream()
                    .sorted(Comparator.comparing(Submission::getCreatedAt))
                    .toList();

            int acCount = 0;
            long penaltyMinutes = 0;
            int totalSubmissions = userSubs.size();
            Instant lastSubmitAt = null;
            Map<String, Integer> wrongBefore = new HashMap<>();
            Map<String, Boolean> acced = new HashMap<>();

            for (Submission s : sorted) {
                String label = problemLabels.get(s.getProblem().getId());
                if (label == null) continue;

                if (lastSubmitAt == null || s.getCreatedAt().isAfter(lastSubmitAt)) {
                    lastSubmitAt = s.getCreatedAt();
                }

                if (Boolean.TRUE.equals(acced.get(label))) continue;

                Verdict v = s.getVerdict();
                if (v == Verdict.AC) {
                    acced.put(label, true);
                    acCount++;
                    long minutesSinceStart = Duration.between(contest.getStartAt(), s.getCreatedAt()).toMinutes();
                    int wrong = wrongBefore.getOrDefault(label, 0);
                    penaltyMinutes += minutesSinceStart + (long) wrong * contest.getPenaltyMinutes();

                    Map<String, Object> cell = cells.get(label);
                    cell.put("verdict", "AC");
                    cell.put("attempts", wrong + 1);
                    cell.put("acAt", s.getCreatedAt().toString());
                } else if (v != null && v != Verdict.CE && v != Verdict.SEC) {
                    wrongBefore.merge(label, 1, Integer::sum);
                    Map<String, Object> cell = cells.get(label);
                    cell.put("verdict", v.name());
                    cell.put("attempts", wrongBefore.get(label));
                }
            }

            Map<String, Object> row = new LinkedHashMap<>();
            row.put("userId", user.getId());
            row.put("username", user.getUsername());
            row.put("fullName", user.getFullName());
            row.put("online", onlineIds.contains(user.getId()));
            row.put("acCount", acCount);
            row.put("totalSubmissions", totalSubmissions);
            row.put("penaltyMinutes", penaltyMinutes);
            row.put("lastSubmitAt", lastSubmitAt != null ? lastSubmitAt.toString() : null);
            row.put("problems", new ArrayList<>(cells.values()));
            return row;
        }).toList();
    }

    private void requireClassroomManager(HttpServletRequest req, Long classroomId, Long contestId) {
        User caller = (User) req.getAttribute(AuthInterceptor.CURRENT_USER_ATTR);
        if (caller == null || (caller.getRole() != Role.ADMIN && caller.getRole() != Role.LECTURER)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        }
        if (caller.getRole() == Role.LECTURER) {
            boolean ownsClass = classroomRepository.findById(classroomId)
                    .map(c -> c.getCreatedBy() != null && c.getCreatedBy().getId().equals(caller.getId()))
                    .orElse(false);
            if (!ownsClass || (contestId != null && !classroomContestRepository.existsByClassroomIdAndContestId(classroomId, contestId))) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN);
            }
        }
    }
}
