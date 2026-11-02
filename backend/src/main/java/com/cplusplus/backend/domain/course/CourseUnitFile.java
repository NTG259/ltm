package com.cplusplus.backend.domain.course;

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

    @Column(name = "order_index", nullable = false)
    private int orderIndex = 1;

    @Column(name = "uploaded_at", nullable = false)
    private Instant uploadedAt = Instant.now();

    protected CourseUnitFile() {}

    public CourseUnitFile(CourseUnit unit, String filename, String fileKey, long fileSize, int orderIndex) {
        this.unit = unit;
        this.filename = filename;
        this.fileKey = fileKey;
        this.fileSize = fileSize;
        this.orderIndex = orderIndex;
    }

    public Long getId() { return id; }
    public CourseUnit getUnit() { return unit; }
    public String getFilename() { return filename; }
    public String getFileKey() { return fileKey; }
    public Long getFileSize() { return fileSize; }
    public int getOrderIndex() { return orderIndex; }
    public Instant getUploadedAt() { return uploadedAt; }
    public Instant getCreatedAt() { return uploadedAt; }
}
