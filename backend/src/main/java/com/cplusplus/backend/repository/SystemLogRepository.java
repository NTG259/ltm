package com.cplusplus.backend.repository;

import com.cplusplus.backend.domain.worker.SystemLog;
import java.time.Instant;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface SystemLogRepository extends JpaRepository<SystemLog, Long> {

    /** Nhật ký mới nhất cho trang Admin. */
    List<SystemLog> findTop200ByOrderByCreatedAtDesc();

    @Modifying
    @Query("delete from SystemLog l where l.createdAt < :before")
    int deleteOlderThan(Instant before);
}
