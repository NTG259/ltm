package com.cplusplus.backend.security;

import com.cplusplus.backend.domain.user.User;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.util.Optional;

@Component
public class AuthInterceptor implements HandlerInterceptor {

    public static final String CURRENT_USER_ATTR = "currentUser";
    private final SecurityService securityService;

    public AuthInterceptor(SecurityService securityService) {
        this.securityService = securityService;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            return true;
        }

        String authHeader = request.getHeader("Authorization");
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7).trim();
            Optional<User> user = securityService.authenticate(token);
            user.ifPresent(u -> request.setAttribute(CURRENT_USER_ATTR, u));
        }
        return true;
    }
}
