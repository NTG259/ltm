package com.cplusplus.backend.domain.course;

import com.cplusplus.backend.domain.user.User;
import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "course_unit_files")
public class CourseUnitFile {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "unit_id", nullable = false)
    private CourseUnit unit;

    /** Tên file hiển thị cho người dùng. */
    @Column(nullable = false, length = 255)
    private String filename;

    /** Đường dẫn lưu trữ trên server (tương đối với upload-dir). */
    @Column(name = "file_key", nullable = false, length = 512)
    private String fileKey;

    @Column(name = "file_size")
    private Long fileSize;

    @Column(name = "storage_bucket", length = 255)
    private String storageBucket;

    @Column(name = "content_type", nullable = false, length = 100)
    private String contentType = "application/pdf";

    @Column(length = 255)
    private String checksum;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private Status status = Status.READY;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "uploaded_by")
    private User uploadedBy;

    @Column(name = "expires_at")
    private Instant expiresAt;

    @Column(name = "order_index", nullable = false)
    private int orderIndex = 1;

    @Column(name = "uploaded_at", nullable = false)
    private Instant uploadedAt = Instant.now();

    protected CourseUnitFile() {}

    public enum Status { PENDING, READY, DELETING, FAILED }

    public CourseUnitFile(CourseUnit unit, String filename, String fileKey, long fileSize, int orderIndex) {
        this.unit = unit;
        this.filename = filename;
        this.fileKey = fileKey;
        this.fileSize = fileSize;
        this.orderIndex = orderIndex;
    }

    public static CourseUnitFile pending(CourseUnit unit, User uploadedBy, String filename,
                                         String bucket, String stagingKey, long fileSize,
                                         int orderIndex, Instant expiresAt) {
        CourseUnitFile file = new CourseUnitFile(unit, filename, stagingKey, fileSize, orderIndex);
        file.storageBucket = bucket;
        file.uploadedBy = uploadedBy;
        file.contentType = "application/pdf";
        file.status = Status.PENDING;
        file.expiresAt = expiresAt;
        return file;
    }

    public void markReady(String finalKey, String checksum) {
        this.fileKey = finalKey;
        this.checksum = checksum;
        this.status = Status.READY;
        this.expiresAt = null;
    }

    public void markDeleting() { this.status = Status.DELETING; }
    public void markFailed() { this.status = Status.FAILED; }

    public void migrateToStorage(String bucket, String key, String checksum) {
        this.storageBucket = bucket;
        this.fileKey = key;
        this.checksum = checksum;
        this.status = Status.READY;
    }

    public Long getId() { return id; }
    public CourseUnit getUnit() { return unit; }
    public String getFilename() { return filename; }
    public String getFileKey() { return fileKey; }
    public Long getFileSize() { return fileSize; }
    public String getStorageBucket() { return storageBucket; }
    public String getContentType() { return contentType; }
    public String getChecksum() { return checksum; }
    public Status getStatus() { return status; }
    public User getUploadedBy() { return uploadedBy; }
    public Instant getExpiresAt() { return expiresAt; }
    public int getOrderIndex() { return orderIndex; }
    public Instant getUploadedAt() { return uploadedAt; }
    public Instant getCreatedAt() { return uploadedAt; }
}
