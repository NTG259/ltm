package com.cplusplus.backend.controller;

import com.cplusplus.backend.security.SecurityService;
import com.cplusplus.backend.domain.user.User;
import com.cplusplus.backend.security.AuthInterceptor;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final SecurityService securityService;

    public AuthController(SecurityService securityService) {
        this.securityService = securityService;
    }

    public record LoginRequest(String username, String password) {}
    public record ChangePasswordRequest(String currentPassword, String newPassword) {}

    @DeleteMapping("/logout")
    public ResponseEntity<Void> logout(HttpServletRequest request) {
        String authHeader = request.getHeader("Authorization");
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            securityService.logout(authHeader.substring(7).trim());
        }
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest req) {
        SecurityService.AuthResult res = securityService.login(req.username(), req.password());
        return ResponseEntity.ok(Map.of(
                "token", res.token(),
                "user", Map.of(
                        "id", res.user().getUsername(),
                        "name", res.user().getFullName(),
                        "role", res.user().isAdmin() ? "admin" : res.user().isLecturer() ? "lecturer" : "student"
                )
        ));
    }

    @PostMapping("/change-password")
    public ResponseEntity<?> changePassword(@RequestBody ChangePasswordRequest req, HttpServletRequest request) {
        User user = (User) request.getAttribute(AuthInterceptor.CURRENT_USER_ATTR);
        if (user == null) return ResponseEntity.status(401).body(Map.of("message", "Vui lòng đăng nhập"));
        if (user.isAdminOrLecturer()) return ResponseEntity.status(403).body(Map.of("message", "Chỉ sinh viên mới dùng chức năng này"));
        securityService.changeStudentPassword(user, req.currentPassword(), req.newPassword());
        return ResponseEntity.ok(Map.of("success", true));
    }
}
