package com.cplusplus.backend.controller;


import com.cplusplus.backend.domain.user.User;
import com.cplusplus.backend.repository.UserRepository;
import com.cplusplus.backend.security.AuthInterceptor;

import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/admin/lecturers")
public class LecturerAdminController {
    private final UserRepository users;
    private final JdbcTemplate jdbc;

    public LecturerAdminController(UserRepository users, JdbcTemplate jdbc) {
        this.users = users;
        this.jdbc = jdbc;
    }

    @GetMapping("/classrooms/{classroomId}")
    public List<Map<String, Object>> assigned(@PathVariable Long classroomId, HttpServletRequest request) {
        requireAdmin(request);
        return jdbc.query("""
                SELECT DISTINCT u.id, u.username, u.full_name FROM users u
                WHERE u.id IN (
                    SELECT user_id FROM classroom_lecturers WHERE classroom_id = ?
                    UNION
                    SELECT lecturer_id FROM classrooms WHERE id = ? AND lecturer_id IS NOT NULL
                    UNION
                    SELECT c.created_by FROM classrooms c
                    JOIN users cu ON cu.id = c.created_by
                    WHERE c.id = ? AND c.created_by IS NOT NULL AND cu.role = 'LECTURER'
                )
                ORDER BY u.full_name, u.id
                """, (rs, row) -> Map.of("id", rs.getLong("id"), "username", rs.getString("username"),
                        "fullName", rs.getString("full_name")), classroomId, classroomId, classroomId);
    }

    @PostMapping("/classrooms/{classroomId}/{lecturerId}")
    @Transactional
    public void assign(@PathVariable Long classroomId, @PathVariable Long lecturerId, HttpServletRequest request) {
        requireAdmin(request);
        User lecturer = users.findById(lecturerId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy giảng viên"));
        if (!lecturer.isLecturer()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Tài khoản này không phải giảng viên");
        int added = jdbc.update("""
                INSERT INTO classroom_lecturers (classroom_id, user_id)
                SELECT id, ? FROM classrooms WHERE id = ?
                ON CONFLICT DO NOTHING
                """, lecturerId, classroomId);
        if (added == 0 && Boolean.FALSE.equals(jdbc.queryForObject(
                "SELECT EXISTS (SELECT 1 FROM classrooms WHERE id = ?)", Boolean.class, classroomId)))
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy lớp");
        jdbc.update("UPDATE classrooms SET lecturer_id = ? WHERE id = ? AND lecturer_id IS NULL", lecturerId, classroomId);
    }

    @DeleteMapping("/classrooms/{classroomId}/{lecturerId}")
    @Transactional
    public void unassign(@PathVariable Long classroomId, @PathVariable Long lecturerId, HttpServletRequest request) {
        requireAdmin(request);
        jdbc.update("DELETE FROM classroom_lecturers WHERE classroom_id = ? AND user_id = ?", classroomId, lecturerId);
        jdbc.update("UPDATE classrooms SET lecturer_id = (SELECT user_id FROM classroom_lecturers WHERE classroom_id = ? LIMIT 1) WHERE id = ? AND lecturer_id = ?", classroomId, classroomId, lecturerId);
    }

    private void requireAdmin(HttpServletRequest request) {
        User user = (User) request.getAttribute(AuthInterceptor.CURRENT_USER_ATTR);
        if (user == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Vui lòng đăng nhập");
        if (!user.isAdmin()) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Cần quyền quản trị viên");
    }
}
