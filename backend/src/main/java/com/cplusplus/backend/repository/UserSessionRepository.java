package com.cplusplus.backend.repository;

import com.cplusplus.backend.domain.user.UserSession;
import java.time.Instant;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface UserSessionRepository extends JpaRepository<UserSession, byte[]> {

    /** Phiên còn hiệu lực theo SHA-256 của Bearer token, nạp sẵn user. */
    @Query("""
            select s from UserSession s join fetch s.user
            where s.tokenHash = :tokenHash and s.revokedAt is null and s.expiresAt > :now
            """)
    Optional<UserSession> findActive(byte[] tokenHash, Instant now);

    @Modifying
    @Query("delete from UserSession s where s.expiresAt < :before")
    int deleteExpired(Instant before);
}
