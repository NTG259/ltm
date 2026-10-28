package com.cplusplus.backend.repository;

import com.cplusplus.backend.domain.worker.LogLevel;
import com.cplusplus.backend.domain.worker.SystemLog;
import java.time.Instant;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SystemLogRepository extends JpaRepository<SystemLog, Long> {

    /** Nhật ký mới nhất cho trang Admin. */
    List<SystemLog> findTop200ByOrderByCreatedAtDesc();

    /** Nhật ký mới nhất lọc theo level. */
    @Query("select l from SystemLog l where l.level = :level order by l.createdAt desc")
    List<SystemLog> findTop200ByLevelOrderByCreatedAtDesc(@Param("level") LogLevel level,
            org.springframework.data.domain.Pageable pageable);

    @Modifying
    @Query("delete from SystemLog l where l.createdAt < :before")
    int deleteOlderThan(Instant before);
}
