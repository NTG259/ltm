package com.cplusplus.backend.security;

import com.cplusplus.backend.domain.user.User;
import com.cplusplus.backend.domain.user.UserSession;
import com.cplusplus.backend.repository.UserRepository;
import com.cplusplus.backend.repository.UserSessionRepository;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HexFormat;
import java.util.Optional;
import java.util.regex.Pattern;

@Service
public class SecurityService {

    private static final Pattern STUDENT_CODE_PATTERN = Pattern.compile("^[A-Z][0-9]{2}[A-Z]{4}[0-9]{3}$");
    private final UserRepository userRepository;
    private final UserSessionRepository userSessionRepository;
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder(12);
    private final SecureRandom secureRandom = new SecureRandom();

    public SecurityService(UserRepository userRepository, UserSessionRepository userSessionRepository) {
        this.userRepository = userRepository;
        this.userSessionRepository = userSessionRepository;
    }

    public record AuthResult(String token, User user) {}

    @Transactional
    public AuthResult login(String username, String password) {
        if (username == null || username.isBlank() || password == null || password.isBlank()) {
            throw new IllegalArgumentException("Vui lòng nhập tài khoản và mật khẩu");
        }

        User user = userRepository.findByUsernameIgnoreCase(username.trim()).orElse(null);
        if (user == null || user.getPasswordHash() == null ||
                !passwordEncoder.matches(password, user.getPasswordHash())) {
            throw new IllegalArgumentException("Tài khoản hoặc mật khẩu không chính xác");
        }

        user.setLastLoginAt(Instant.now());
        String token = generateToken();
        createSession(token, user);
        return new AuthResult(token, user);
    }

    @Transactional
    public AuthResult loginStudent(String studentCode, String password) {
        if (studentCode == null || !STUDENT_CODE_PATTERN.matcher(studentCode.toUpperCase().trim()).matches()) {
            throw new IllegalArgumentException("MSSV không đúng định dạng (ví dụ: B20DCCN001)");
        }
        if (password == null || password.isBlank()) {
            throw new IllegalArgumentException("Vui lòng nhập mật khẩu");
        }
        String normalizedCode = studentCode.toUpperCase().trim();
        User user = userRepository.findByUsernameIgnoreCase(normalizedCode).orElse(null);
        if (user == null || user.isAdmin() || user.getPasswordHash() == null ||
                !passwordEncoder.matches(password, user.getPasswordHash())) {
            throw new IllegalArgumentException("MSSV hoặc mật khẩu không chính xác");
        }

        user.setLastLoginAt(Instant.now());
        String token = generateToken();
        createSession(token, user);
        return new AuthResult(token, user);
    }

    public String hashPassword(String password) {
        if (password == null || password.length() < 8) {
            throw new IllegalArgumentException("Mật khẩu phải có ít nhất 8 ký tự");
        }
        return passwordEncoder.encode(password);
    }

    @Transactional
    public AuthResult loginAdmin(String password) {
        User admin = userRepository.findByUsernameIgnoreCase("admin")
                .orElseThrow(() -> new IllegalArgumentException("Tài khoản admin chưa tồn tại trong hệ thống"));

        if (password == null || admin.getPasswordHash() == null ||
                !passwordEncoder.matches(password, admin.getPasswordHash())) {
            throw new IllegalArgumentException("Mật khẩu quản trị viên không chính xác");
        }

        admin.setLastLoginAt(Instant.now());
        String token = generateToken();
        createSession(token, admin);
        return new AuthResult(token, admin);
    }

    @Transactional(readOnly = true)
    public Optional<User> authenticate(String bearerToken) {
        if (bearerToken == null || bearerToken.isBlank()) {
            return Optional.empty();
        }
        byte[] tokenHash = sha256(bearerToken);
        return userSessionRepository.findActive(tokenHash, Instant.now())
                .map(UserSession::getUser);
    }

    private void createSession(String token, User user) {
        byte[] hash = sha256(token);
        Instant expiresAt = Instant.now().plus(7, ChronoUnit.DAYS);
        UserSession session = new UserSession(hash, user, expiresAt);
        userSessionRepository.save(session);
    }

    private String generateToken() {
        byte[] bytes = new byte[32];
        secureRandom.nextBytes(bytes);
        return HexFormat.of().formatHex(bytes);
    }

    public static byte[] sha256(String input) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return digest.digest(input.getBytes(StandardCharsets.UTF_8));
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 không được hỗ trợ", e);
        }
    }
}
