package com.cplusplus.backend.domain.user;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.net.InetAddress;
import java.time.Instant;
import java.util.Arrays;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/** Phiên đăng nhập (Bearer token). Chỉ lưu SHA-256 của token. */
@Entity
@Table(name = "sessions")
public class UserSession {

    @Id
    @Column(name = "token_hash", nullable = false, length = 32)
    private byte[] tokenHash;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "revoked_at")
    private Instant revokedAt;

    @JdbcTypeCode(SqlTypes.INET)
    @Column(name = "client_ip")
    private InetAddress clientIp;

    @Column(name = "user_agent")
    private String userAgent;

    protected UserSession() {
    }

    public UserSession(byte[] tokenHash, User user, Instant expiresAt) {
        if (tokenHash == null || tokenHash.length != 32) {
            throw new IllegalArgumentException("tokenHash phải là SHA-256 (32 byte)");
        }
        this.tokenHash = tokenHash.clone();
        this.user = user;
        this.expiresAt = expiresAt;
    }

    public boolean isActive(Instant now) {
        return revokedAt == null && now.isBefore(expiresAt);
    }

    public void revoke(Instant now) {
        if (revokedAt == null) {
            revokedAt = now;
        }
    }

    public byte[] getTokenHash() {
        return tokenHash.clone();
    }

    public User getUser() {
        return user;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getExpiresAt() {
        return expiresAt;
    }

    public Instant getRevokedAt() {
        return revokedAt;
    }

    public InetAddress getClientIp() {
        return clientIp;
    }

    public void setClientIp(InetAddress clientIp) {
        this.clientIp = clientIp;
    }

    public String getUserAgent() {
        return userAgent;
    }

    public void setUserAgent(String userAgent) {
        this.userAgent = userAgent;
    }

    @Override
    public boolean equals(Object o) {
        return this == o || (o instanceof UserSession other && Arrays.equals(tokenHash, other.tokenHash));
    }

    @Override
    public int hashCode() {
        return Arrays.hashCode(tokenHash);
    }
}
