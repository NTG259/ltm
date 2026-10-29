package com.cplusplus.backend.controller;

import com.cplusplus.backend.security.SecurityService;
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
}
