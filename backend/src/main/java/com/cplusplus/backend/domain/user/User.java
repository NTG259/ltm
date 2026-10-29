package com.cplusplus.backend.domain.user;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.Objects;
import org.hibernate.annotations.CreationTimestamp;

/** Thí sinh (đăng nhập bằng MSSV + họ tên) hoặc quản trị viên (mật khẩu). */
@Entity
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** MSSV viết hoa với thí sinh, {@code admin} với quản trị viên; đây là {@code userId} của API. */
    @Column(nullable = false, length = 32)
    private String username;

    @Column(name = "full_name", nullable = false, length = 100)
    private String fullName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private Role role;

    /** bcrypt; chỉ quản trị viên có. */
    @Column(name = "password_hash", length = 100)
    private String passwordHash;

    /** Mật khẩu khởi tạo/đặt lại để quản trị viên phân phối; xóa khi người dùng tự đổi mật khẩu. */
    @Column(name = "initial_password")
    private String initialPassword;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "last_login_at")
    private Instant lastLoginAt;

    protected User() {
    }

    public static User student(String studentCode, String fullName) {
        User u = new User();
        u.username = studentCode.trim().toUpperCase();
        u.fullName = fullName.trim();
        u.role = Role.STUDENT;
        return u;
    }

    public static User lecturer(String staffId, String fullName, String passwordHash) {
        User u = new User();
        u.username = staffId.trim().toUpperCase();
        u.fullName = fullName.trim();
        u.role = Role.LECTURER;
        u.passwordHash = Objects.requireNonNull(passwordHash);
        return u;
    }

    public static User admin(String username, String fullName, String passwordHash) {
        User u = new User();
        u.username = username;
        u.fullName = fullName;
        u.role = Role.ADMIN;
        u.passwordHash = Objects.requireNonNull(passwordHash);
        return u;
    }

    public boolean isAdmin() {
        return role == Role.ADMIN;
    }

    public boolean isLecturer() {
        return role == Role.LECTURER;
    }

    public boolean isAdminOrLecturer() {
        return role == Role.ADMIN || role == Role.LECTURER;
    }

    public Long getId() {
        return id;
    }

    public String getUsername() {
        return username;
    }

    public String getFullName() {
        return fullName;
    }

    public void setFullName(String fullName) {
        this.fullName = fullName;
    }

    public Role getRole() {
        return role;
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    public void setPasswordHash(String passwordHash) {
        this.passwordHash = passwordHash;
    }

    public String getInitialPassword() {
        return initialPassword;
    }

    public void setInitialPassword(String initialPassword) {
        this.initialPassword = initialPassword;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getLastLoginAt() {
        return lastLoginAt;
    }

    public void setLastLoginAt(Instant lastLoginAt) {
        this.lastLoginAt = lastLoginAt;
    }

    @Override
    public boolean equals(Object o) {
        return this == o || (o instanceof User other && id != null && id.equals(other.id));
    }

    @Override
    public int hashCode() {
        return User.class.hashCode();
    }
}
