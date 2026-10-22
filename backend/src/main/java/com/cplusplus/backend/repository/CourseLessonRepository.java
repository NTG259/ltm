package com.cplusplus.backend.repository;

import com.cplusplus.backend.domain.course.CourseLesson;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface CourseLessonRepository extends JpaRepository<CourseLesson, Long> {
    Optional<CourseLesson> findByUnitId(Long unitId);
}
