package com.cplusplus.backend.repository;

import com.cplusplus.backend.domain.course.CourseUnit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface CourseUnitRepository extends JpaRepository<CourseUnit, Long> {

    List<CourseUnit> findByCourseIdOrderByOrderIndexAsc(Long courseId);

    Optional<CourseUnit> findByIdAndCourseId(Long id, Long courseId);

    @Query("SELECT COALESCE(MAX(u.orderIndex), 0) FROM CourseUnit u WHERE u.course.id = :courseId")
    int findMaxOrderIndexByCourseId(Long courseId);
}
