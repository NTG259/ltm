package com.cplusplus.backend.controller;

import com.cplusplus.backend.domain.user.User;
import com.cplusplus.backend.security.AuthInterceptor;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/leaderboard")
public class LeaderboardController {
    private final NamedParameterJdbcTemplate jdbc;

    public LeaderboardController(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @GetMapping("/classrooms")
    public List<Map<String, Object>> classrooms(HttpServletRequest request) {
        User user = requireUser(request);
        String sql = """
                SELECT c.id, c.name, c.semester FROM classrooms c
                WHERE :isAdmin
                   OR (:isLecturer AND (c.created_by = :userId OR c.lecturer_id = :userId OR EXISTS (
                        SELECT 1 FROM classroom_lecturers cl
                        WHERE cl.classroom_id = c.id AND cl.user_id = :userId)))
                   OR (:isStudent AND EXISTS (SELECT 1 FROM classroom_students cs
                                              WHERE cs.classroom_id = c.id AND cs.user_id = :userId))
                ORDER BY c.name, c.id
                """;
        var params = new MapSqlParameterSource()
                .addValue("isAdmin", user.isAdmin())
                .addValue("isLecturer", user.isLecturer())
                .addValue("isStudent", !user.isAdmin() && !user.isLecturer())
                .addValue("userId", user.getId());
        return jdbc.query(sql, params, (rs, row) -> Map.of(
                "id", rs.getLong("id"), "name", rs.getString("name"),
                "semester", rs.getString("semester") == null ? "" : rs.getString("semester")));
    }

    @GetMapping("/students")
    public Map<String, Object> students(@RequestParam(required = false) Long classroomId,
                                        HttpServletRequest request) {
        User user = requireUser(request);
        checkScope(user, classroomId);
        var params = parameters(classroomId);
        String sql = """
                WITH eligible AS (
                    SELECT DISTINCT u.id, u.username, u.full_name
                    FROM users u
                    WHERE u.role = 'STUDENT'
                """ + (classroomId == null ? "" : " AND EXISTS (SELECT 1 FROM classroom_students cs WHERE cs.user_id = u.id AND cs.classroom_id = :classroomId)\n") + """
                ), scoped AS (
                """ + scopedSubmissions(classroomId) + """
                ), first_ac AS (
                    SELECT DISTINCT ON (user_id, problem_id) user_id, problem_id, created_at AS ac_at, id AS ac_id
                    FROM scoped WHERE verdict = 'AC' ORDER BY user_id, problem_id, created_at, id
                ), per_problem AS (
                    SELECT s.user_id, s.problem_id, fa.ac_at,
                           count(*) FILTER (WHERE fa.ac_at IS NOT NULL AND (s.created_at, s.id) <= (fa.ac_at, fa.ac_id)) AS tries
                    FROM scoped s LEFT JOIN first_ac fa ON fa.user_id = s.user_id AND fa.problem_id = s.problem_id
                    GROUP BY s.user_id, s.problem_id, fa.ac_at
                ), totals AS (
                    SELECT user_id, count(ac_at) AS solved, sum(tries) AS attempts, max(ac_at) AS completed_at
                    FROM per_problem GROUP BY user_id
                ), ranked AS (
                    SELECT e.id, e.username, e.full_name,
                           coalesce(t.solved, 0) AS solved, coalesce(t.attempts, 0) AS attempts,
                           rank() OVER (ORDER BY coalesce(t.solved, 0) DESC,
                                                  coalesce(t.attempts, 0) ASC,
                                                  t.completed_at ASC NULLS LAST) AS rank
                    FROM eligible e LEFT JOIN totals t ON t.user_id = e.id
                ) SELECT * FROM ranked ORDER BY rank, username
                """;
        List<Map<String, Object>> rows = jdbc.query(sql, params, (rs, rowNum) -> {
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("rank", rs.getLong("rank"));
            result.put("userId", rs.getString("username"));
            result.put("userName", rs.getString("full_name"));
            result.put("solved", rs.getLong("solved"));
            result.put("attempts", rs.getLong("attempts"));
            return result;
        });
        return Map.of("rows", rows, "updatedAt", Instant.now().toEpochMilli());
    }

    @GetMapping("/problems")
    public Map<String, Object> problems(@RequestParam(required = false) Long classroomId,
                                        HttpServletRequest request) {
        User user = requireUser(request);
        if (!user.isAdmin() && !user.isLecturer())
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Chỉ giảng viên và quản trị viên được xem xếp hạng bài");
        checkScope(user, classroomId);
        var params = parameters(classroomId);
        String sql = """
                WITH scoped AS (
                """ + scopedSubmissions(classroomId) + """
                ) SELECT p.id, p.title, p.difficulty,
                         count(s.problem_id) AS submissions,
                         count(DISTINCT s.user_id) AS attempted_users,
                         count(DISTINCT s.user_id) FILTER (WHERE s.verdict = 'AC') AS accepted_users
                FROM problems p LEFT JOIN scoped s ON s.problem_id = p.id
                WHERE p.is_public = true AND p.deleted_at IS NULL
                GROUP BY p.id, p.title, p.difficulty
                ORDER BY submissions DESC, p.id
                """;
        List<Map<String, Object>> rows = jdbc.query(sql, params, (rs, rowNum) -> {
            long tried = rs.getLong("attempted_users");
            long accepted = rs.getLong("accepted_users");
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("problemId", rs.getLong("id"));
            result.put("title", rs.getString("title"));
            result.put("difficulty", rs.getString("difficulty"));
            result.put("submissions", rs.getLong("submissions"));
            result.put("attemptedUsers", tried);
            result.put("acceptedUsers", accepted);
            result.put("acceptanceRate", tried == 0 ? null : Math.round(accepted * 1000.0 / tried) / 10.0);
            return result;
        });
        return Map.of("rows", rows, "updatedAt", Instant.now().toEpochMilli());
    }

    @GetMapping("/problems/{problemId}/details")
    public Map<String, Object> problemDetails(@PathVariable Long problemId,
                                              @RequestParam(required = false) Long classroomId,
                                              HttpServletRequest request) {
        User user = requireUser(request);
        if (!user.isAdmin() && !user.isLecturer())
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Chỉ giảng viên và quản trị viên được xem chi tiết bài");
        checkScope(user, classroomId);
        var params = parameters(classroomId).addValue("problemId", problemId);
        String sql = """
                WITH scoped AS (
                """ + scopedSubmissions(classroomId) + """
                ) SELECT u.username, u.full_name, count(*) AS submissions,
                         bool_or(s.verdict = 'AC') AS solved, max(s.created_at) AS last_submitted_at
                FROM scoped s JOIN users u ON u.id = s.user_id
                WHERE s.problem_id = :problemId
                GROUP BY u.id, u.username, u.full_name
                ORDER BY solved ASC, submissions DESC, u.username
                """;
        List<Map<String, Object>> rows = jdbc.query(sql, params, (rs, rowNum) -> Map.of(
                "userId", rs.getString("username"), "userName", rs.getString("full_name"),
                "submissions", rs.getLong("submissions"), "solved", rs.getBoolean("solved"),
                "lastSubmittedAt", rs.getTimestamp("last_submitted_at").toInstant().toEpochMilli()));
        return Map.of("rows", rows);
    }

    private String scopedSubmissions(Long classroomId) {
        StringBuilder sql = new StringBuilder("""
                SELECT s.id, s.user_id, s.problem_id, s.verdict, s.created_at
                FROM submissions s
                JOIN users u ON u.id = s.user_id AND u.role = 'STUDENT'
                JOIN problems p ON p.id = s.problem_id AND p.is_public = true AND p.deleted_at IS NULL
                WHERE s.contest_id IS NULL AND s.status = 'FINISHED'
                """);
        if (classroomId != null) sql.append(" AND EXISTS (SELECT 1 FROM classroom_students cs WHERE cs.user_id = s.user_id AND cs.classroom_id = :classroomId)\n");
        return sql.toString();
    }

    private MapSqlParameterSource parameters(Long classroomId) {
        var params = new MapSqlParameterSource();
        if (classroomId != null) params.addValue("classroomId", classroomId);
        return params;
    }

    private User requireUser(HttpServletRequest request) {
        User user = (User) request.getAttribute(AuthInterceptor.CURRENT_USER_ATTR);
        if (user == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Vui lòng đăng nhập");
        return user;
    }

    private void checkScope(User user, Long classroomId) {
        if (classroomId == null) {
            if (user.isAdmin()) return;
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cần chọn lớp học");
        }
        if (user.isAdmin()) {
            Boolean exists = jdbc.getJdbcTemplate().queryForObject(
                    "SELECT EXISTS (SELECT 1 FROM classrooms WHERE id = ?)", Boolean.class, classroomId);
            if (!Boolean.TRUE.equals(exists)) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy lớp");
            return;
        }
        String sql = user.isLecturer()
                ? """
                  SELECT EXISTS (SELECT 1 FROM classrooms c WHERE c.id = ? AND
                    (c.created_by = ? OR c.lecturer_id = ? OR EXISTS (SELECT 1 FROM classroom_lecturers cl
                     WHERE cl.classroom_id = c.id AND cl.user_id = ?)))
                  """
                : "SELECT EXISTS (SELECT 1 FROM classroom_students WHERE classroom_id = ? AND user_id = ?)";
        Boolean permitted = user.isLecturer()
                ? jdbc.getJdbcTemplate().queryForObject(sql, Boolean.class, classroomId, user.getId(), user.getId(), user.getId())
                : jdbc.getJdbcTemplate().queryForObject(sql, Boolean.class, classroomId, user.getId());
        if (!Boolean.TRUE.equals(permitted)) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Bạn không thuộc lớp này");
    }
}
