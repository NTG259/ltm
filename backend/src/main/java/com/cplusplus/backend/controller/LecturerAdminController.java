package com.cplusplus.backend.controller;

import com.cplusplus.backend.domain.user.Role;
import com.cplusplus.backend.domain.user.User;
import com.cplusplus.backend.repository.UserRepository;
import com.cplusplus.backend.security.AuthInterceptor;
import com.cplusplus.backend.security.SecurityService;
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
    private final SecurityService security;
    private final JdbcTemplate jdbc;

    public LecturerAdminController(UserRepository users, SecurityService security, JdbcTemplate jdbc) {
        this.users = users;
        this.security = security;
        this.jdbc = jdbc;
    }

    @GetMapping("/classrooms/{classroomId}")
    public List<Map<String, Object>> assigned(@PathVariable Long classroomId, HttpServletRequest request) {
        requireAdmin(request);
        return jdbc.query("""
                SELECT u.id, u.username, u.full_name FROM classroom_lecturers cl
                JOIN users u ON u.id = cl.user_id WHERE cl.classroom_id = ?
                ORDER BY u.full_name, u.id
                """, (rs, row) -> Map.of("id", rs.getLong("id"), "username", rs.getString("username"),
                        "fullName", rs.getString("full_name")), classroomId);
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
    }

    @DeleteMapping("/classrooms/{classroomId}/{lecturerId}")
    @Transactional
    public void unassign(@PathVariable Long classroomId, @PathVariable Long lecturerId, HttpServletRequest request) {
        requireAdmin(request);
        jdbc.update("DELETE FROM classroom_lecturers WHERE classroom_id = ? AND user_id = ?", classroomId, lecturerId);
    }

    private void requireAdmin(HttpServletRequest request) {
        User user = (User) request.getAttribute(AuthInterceptor.CURRENT_USER_ATTR);
        if (user == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Vui lòng đăng nhập");
        if (!user.isAdmin()) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Cần quyền quản trị viên");
    }
}
