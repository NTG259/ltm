package com.cplusplus.backend.repository;

import com.cplusplus.backend.domain.course.CourseUnitFile;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CourseUnitFileRepository extends JpaRepository<CourseUnitFile, Long> {
    List<CourseUnitFile> findByUnitIdOrderByOrderIndexAsc(Long unitId);
    int countByUnitId(Long unitId);
}
