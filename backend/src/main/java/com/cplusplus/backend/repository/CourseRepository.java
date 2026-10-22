package com.cplusplus.backend.repository;

import com.cplusplus.backend.domain.course.Course;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CourseRepository extends JpaRepository<Course, Long> {

    List<Course> findAllByOrderByCreatedAtDesc();

    List<Course> findByPublishedTrueOrderByCreatedAtDesc();

    Optional<Course> findByIdAndPublishedTrue(Long id);
}
