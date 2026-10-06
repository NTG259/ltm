package com.cplusplus.backend.controller;

import com.cplusplus.backend.domain.user.Role;
import com.cplusplus.backend.security.SecurityService;
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

    public record LoginRequest(String role, String studentId, String fullName, String password) {}

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest req) {
        if ("admin".equalsIgnoreCase(req.role())) {
            SecurityService.AuthResult res = securityService.loginAdmin(req.password());
            return ResponseEntity.ok(Map.of(
                    "token", res.token(),
                    "user", Map.of(
                            "id", res.user().getUsername(),
                            "name", res.user().getFullName(),
                            "role", "admin"
                    )
            ));
        } else {
            SecurityService.AuthResult res = securityService.loginStudent(req.studentId(), req.fullName());
            return ResponseEntity.ok(Map.of(
                    "token", res.token(),
                    "user", Map.of(
                            "id", res.user().getUsername(),
                            "name", res.user().getFullName(),
                            "role", "student"
                    )
            ));
        }
    }
}
