package com.cplusplus.backend.repository;

import com.cplusplus.backend.domain.course.UserUnitProgress;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserUnitProgressRepository extends JpaRepository<UserUnitProgress, Long> {

    Optional<UserUnitProgress> findByUserIdAndUnitId(Long userId, Long unitId);

    @Query("SELECT p FROM UserUnitProgress p WHERE p.user.id = :userId AND p.unit.course.id = :courseId AND p.completed = true")
    List<UserUnitProgress> findCompletedByUserIdAndCourseId(Long userId, Long courseId);

    @Query(value = """
            SELECT DISTINCT u.id FROM course_units u
            WHERE u.course_id = :courseId
              AND (
                EXISTS (
                  SELECT 1 FROM user_unit_progress p
                  WHERE p.unit_id = u.id AND p.user_id = :userId AND p.completed = true
                )
                OR EXISTS (
                  SELECT 1 FROM course_unit_problems cup
                  JOIN submissions s ON s.problem_id = cup.problem_id
                  WHERE cup.unit_id = u.id AND s.user_id = :userId AND s.verdict = 'AC'
                )
              )
            """, nativeQuery = true)
    List<Long> findCompletedUnitIdsNative(Long userId, Long courseId);
}
