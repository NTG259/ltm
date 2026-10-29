package com.cplusplus.backend.repository;

import com.cplusplus.backend.domain.classroom.ClassroomCourse;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ClassroomCourseRepository extends JpaRepository<ClassroomCourse, Long> {
    Optional<ClassroomCourse> findByClassroomId(Long classroomId);
    void deleteByClassroomId(Long classroomId);
}
