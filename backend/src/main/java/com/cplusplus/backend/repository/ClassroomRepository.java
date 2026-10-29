package com.cplusplus.backend.repository;

import com.cplusplus.backend.domain.classroom.Classroom;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface ClassroomRepository extends JpaRepository<Classroom, Long> {

    /** Lớp học mà sinh viên (userId) đang thuộc. */
    @Query("select cs.classroom from ClassroomStudent cs where cs.user.id = :userId")
    List<Classroom> findByStudentUserId(Long userId);

    /** Lớp học do giảng viên (createdBy) tạo. */
    List<Classroom> findByCreatedById(Long createdById);

    List<Classroom> findByLecturerId(Long lecturerId);

    long countByLecturerId(Long lecturerId);
}
