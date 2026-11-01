package com.cplusplus.backend.repository;

import com.cplusplus.backend.domain.course.CourseUnitFile;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.time.Instant;

public interface CourseUnitFileRepository extends JpaRepository<CourseUnitFile, Long> {
    List<CourseUnitFile> findByUnitIdOrderByOrderIndexAsc(Long unitId);
    List<CourseUnitFile> findByUnitIdAndStatusOrderByOrderIndexAsc(Long unitId, CourseUnitFile.Status status);
    List<CourseUnitFile> findTop50ByStatusAndExpiresAtBeforeOrderByIdAsc(CourseUnitFile.Status status, Instant cutoff);
    List<CourseUnitFile> findTop50ByStatusOrderByIdAsc(CourseUnitFile.Status status);
    List<CourseUnitFile> findTop50ByStorageBucketIsNullAndStatusOrderByIdAsc(CourseUnitFile.Status status);
    int countByUnitId(Long unitId);
}
