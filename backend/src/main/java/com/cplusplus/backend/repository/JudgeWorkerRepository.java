package com.cplusplus.backend.repository;

import com.cplusplus.backend.domain.worker.JudgeWorker;
import com.cplusplus.backend.domain.worker.WorkerStatus;
import java.time.Instant;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface JudgeWorkerRepository extends JpaRepository<JudgeWorker, String> {

    List<JudgeWorker> findAllByOrderById();

    /** Master khởi động: mọi kết nối cũ đều đã mất, đánh dấu DEAD tới khi Worker đăng ký lại. */
    @Modifying
    @Query("update JudgeWorker w set w.status = :dead, w.disconnectedAt = :now where w.status <> :dead")
    int markAllDead(Instant now, WorkerStatus dead);
}
