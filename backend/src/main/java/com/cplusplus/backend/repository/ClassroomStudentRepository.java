package com.cplusplus.backend.repository;

import com.cplusplus.backend.domain.classroom.ClassroomStudent;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface ClassroomStudentRepository extends JpaRepository<ClassroomStudent, ClassroomStudent.Id> {

    @Query("select cs from ClassroomStudent cs join fetch cs.user where cs.classroom.id = :classroomId")
    List<ClassroomStudent> findAllWithUserByClassroomId(Long classroomId);

    boolean existsByClassroomIdAndUserId(Long classroomId, Long userId);

    Optional<ClassroomStudent> findByClassroomIdAndUserId(Long classroomId, Long userId);

    boolean existsByUserId(Long userId);

    Optional<ClassroomStudent> findByUserId(Long userId);
}
