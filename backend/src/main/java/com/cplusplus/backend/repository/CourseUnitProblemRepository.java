package com.cplusplus.backend.repository;

import com.cplusplus.backend.domain.course.CourseUnitProblem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CourseUnitProblemRepository extends JpaRepository<CourseUnitProblem, Long> {

    List<CourseUnitProblem> findByUnitIdOrderByOrderIndexAsc(Long unitId);

    Optional<CourseUnitProblem> findByUnitIdAndProblemId(Long unitId, Long problemId);

    List<CourseUnitProblem> findByProblemId(Long problemId);

    void deleteByUnitIdAndProblemId(Long unitId, Long problemId);
}
