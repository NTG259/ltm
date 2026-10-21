package com.cplusplus.backend.repository;

import com.cplusplus.backend.domain.classroom.ClassroomContest;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface ClassroomContestRepository extends JpaRepository<ClassroomContest, ClassroomContest.Id> {

    @Query("select cc from ClassroomContest cc join fetch cc.contest where cc.classroom.id = :classroomId")
    List<ClassroomContest> findAllWithContestByClassroomId(Long classroomId);

    boolean existsByClassroomIdAndContestId(Long classroomId, Long contestId);
}
