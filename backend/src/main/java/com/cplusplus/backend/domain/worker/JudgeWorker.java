package com.cplusplus.backend.domain.worker;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * Danh bạ máy chấm. Trạng thái "sống" theo heartbeat 5s nằm trong RAM của Master; entity
 * này chỉ được ghi khi Worker đăng ký, mất kết nối hoặc chấm xong một bài.
 */
@Entity
@Table(name = "workers")
public class JudgeWorker {

    /** {@code workerId} trong OP_WORKER_REGISTER, vd. {@code worker-1}. */
    @Id
    @Column(length = 64)
    private String id;

    @Column(length = 64)
    private String address;

    private String hostname;

    @Column(length = 32)
    private String version;

    private String compiler;

    @Column(length = 32)
    private String sandbox;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 8)
    private WorkerStatus status = WorkerStatus.DEAD;

    @Column(name = "completed_count", nullable = false)
    private int completedCount;

    /** Nguyên văn payload REGISTER (JSON). */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "register_payload")
    private String registerPayload;

    @Column(name = "first_seen_at", nullable = false, updatable = false)
    private Instant firstSeenAt;

    @Column(name = "connected_at")
    private Instant connectedAt;

    @Column(name = "disconnected_at")
    private Instant disconnectedAt;

    @Column(name = "last_heartbeat_at")
    private Instant lastHeartbeatAt;

    protected JudgeWorker() {
    }

    public JudgeWorker(String id, Instant now) {
        this.id = id;
        this.firstSeenAt = now;
    }

    /** Worker gửi OP_WORKER_REGISTER (lần đầu hoặc kết nối lại). */
    public void onRegister(String address, String hostname, String version, String compiler, String sandbox,
                           String registerPayloadJson, Instant now) {
        this.address = address;
        this.hostname = hostname;
        this.version = version;
        this.compiler = compiler;
        this.sandbox = sandbox;
        this.registerPayload = registerPayloadJson;
        this.status = WorkerStatus.IDLE;
        this.connectedAt = now;
        this.disconnectedAt = null;
        this.lastHeartbeatAt = now;
    }

    /** Mất kết nối (FIN/RST) hoặc quá 15s không PONG. */
    public void onDisconnect(Instant now) {
        this.status = WorkerStatus.DEAD;
        this.disconnectedAt = now;
    }

    public void markBusy() {
        this.status = WorkerStatus.BUSY;
    }

    public void onTaskFinished() {
        this.status = WorkerStatus.IDLE;
        this.completedCount++;
    }

    public void setLastHeartbeatAt(Instant lastHeartbeatAt) {
        this.lastHeartbeatAt = lastHeartbeatAt;
    }

    public String getId() {
        return id;
    }

    public String getAddress() {
        return address;
    }

    public String getHostname() {
        return hostname;
    }

    public String getVersion() {
        return version;
    }

    public String getCompiler() {
        return compiler;
    }

    public String getSandbox() {
        return sandbox;
    }

    public WorkerStatus getStatus() {
        return status;
    }

    public int getCompletedCount() {
        return completedCount;
    }

    public String getRegisterPayload() {
        return registerPayload;
    }

    public Instant getFirstSeenAt() {
        return firstSeenAt;
    }

    public Instant getConnectedAt() {
        return connectedAt;
    }

    public Instant getDisconnectedAt() {
        return disconnectedAt;
    }

    public Instant getLastHeartbeatAt() {
        return lastHeartbeatAt;
    }

    @Override
    public boolean equals(Object o) {
        return this == o || (o instanceof JudgeWorker other && id.equals(other.id));
    }

    @Override
    public int hashCode() {
        return id.hashCode();
    }
}
