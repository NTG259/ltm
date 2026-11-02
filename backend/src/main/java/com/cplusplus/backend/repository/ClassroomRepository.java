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

    /** Lớp học do giảng viên tạo hoặc được quản trị viên phân công. */
    @Query(value = """
            SELECT DISTINCT c.* FROM classrooms c
            WHERE c.created_by = :userId
               OR c.lecturer_id = :userId
               OR EXISTS (SELECT 1 FROM classroom_lecturers cl
                          WHERE cl.classroom_id = c.id AND cl.user_id = :userId)
            ORDER BY c.id
            """, nativeQuery = true)
    List<Classroom> findByLecturerUserId(Long userId);

    @Query(value = """
            SELECT EXISTS (
                SELECT 1 FROM classroom_lecturers
                WHERE classroom_id = :classroomId AND user_id = :userId
            ) OR EXISTS (
                SELECT 1 FROM classrooms
                WHERE id = :classroomId AND (created_by = :userId OR lecturer_id = :userId)
            )
            """, nativeQuery = true)
    boolean isLecturerAssigned(Long classroomId, Long userId);

    @Query(value = """
            SELECT EXISTS (
                SELECT 1 FROM classroom_contests cc
                JOIN classroom_students cs ON cs.classroom_id = cc.classroom_id
                WHERE cc.contest_id = :contestId AND cs.user_id = :userId
            )
            """, nativeQuery = true)
    boolean isStudentInContestClassroom(Long contestId, Long userId);
}
