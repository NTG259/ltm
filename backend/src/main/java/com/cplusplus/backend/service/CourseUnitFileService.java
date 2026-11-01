package com.cplusplus.backend.service;

import com.cplusplus.backend.domain.course.CourseUnit;
import com.cplusplus.backend.domain.course.CourseUnitFile;
import com.cplusplus.backend.domain.user.User;
import com.cplusplus.backend.repository.CourseUnitFileRepository;
import com.cplusplus.backend.storage.ObjectStorage;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.time.Instant;
import java.util.*;

@Service
public class CourseUnitFileService {
    public static final long MAX_FILE_SIZE = 100L * 1024 * 1024;
    private static final Duration UPLOAD_TTL = Duration.ofMinutes(15);
    private static final Duration DOWNLOAD_TTL = Duration.ofMinutes(5);

    private final CourseUnitFileRepository files;
    private final ObjectStorage storage;
    private final Path legacyUploadDir;

    public CourseUnitFileService(CourseUnitFileRepository files, ObjectStorage storage,
            @Value("${app.upload-dir:./uploads/course-files}") String legacyUploadDir) {
        this.files = files;
        this.storage = storage;
        this.legacyUploadDir = Path.of(legacyUploadDir).toAbsolutePath().normalize();
    }

    public record UploadRequest(String filename, long fileSize, String contentType) {}
    public record UploadSession(Long id, String uploadUrl, Map<String, String> fields, long expiresAt) {}

    @Transactional
    public UploadSession createUpload(CourseUnit unit, User user, UploadRequest request) {
        validateRequest(request);
        Instant expiresAt = Instant.now().plus(UPLOAD_TTL);
        String nonce = UUID.randomUUID().toString();
        String stagingKey = "staging/" + user.getId() + "/" + nonce + ".pdf";
        CourseUnitFile record = files.save(CourseUnitFile.pending(unit, user,
                safeFilename(request.filename()), storage.bucket(), stagingKey,
                request.fileSize(), files.countByUnitId(unit.getId()) + 1, expiresAt));
        ObjectStorage.UploadForm form = storage.createPdfUploadForm(stagingKey, MAX_FILE_SIZE, UPLOAD_TTL);
        Map<String, String> fields = new LinkedHashMap<>(form.fields());
        fields.put("key", stagingKey);
        fields.put("Content-Type", "application/pdf");
        return new UploadSession(record.getId(), form.url(), fields, expiresAt.toEpochMilli());
    }

    @Transactional
    public CourseUnitFile complete(Long fileId, User user) {
        CourseUnitFile record = owned(fileId, user);
        if (record.getStatus() == CourseUnitFile.Status.READY) return record;
        if (record.getStatus() != CourseUnitFile.Status.PENDING || record.getExpiresAt() == null
                || record.getExpiresAt().isBefore(Instant.now())) {
            throw new IllegalArgumentException("Phiên upload đã hết hạn hoặc không còn hợp lệ");
        }
        ObjectStorage.ObjectInfo object = storage.stat(record.getFileKey());
        if (object.size() != record.getFileSize() || object.size() <= 0 || object.size() > MAX_FILE_SIZE) {
            throw new IllegalArgumentException("Kích thước file tải lên không khớp phiên upload");
        }
        try (InputStream input = storage.open(record.getFileKey())) {
            if (!Arrays.equals(input.readNBytes(5), "%PDF-".getBytes(StandardCharsets.US_ASCII))) {
                storage.delete(record.getFileKey());
                record.markFailed();
                throw new IllegalArgumentException("Nội dung file không phải PDF hợp lệ");
            }
        } catch (java.io.IOException e) {
            throw new IllegalStateException("Không thể xác minh nội dung PDF", e);
        }
        String finalKey = "course-files/" + record.getUnit().getId() + "/" + UUID.randomUUID() + ".pdf";
        storage.promote(record.getFileKey(), finalKey);
        record.markReady(finalKey, object.checksum());
        return record;
    }

    @Transactional(readOnly = true)
    public String downloadUrl(CourseUnitFile record) {
        if (record.getStatus() != CourseUnitFile.Status.READY || record.getStorageBucket() == null) {
            throw new IllegalStateException("Tài liệu chưa sẵn sàng trên object storage");
        }
        return storage.downloadUrl(record.getFileKey(), record.getFilename(), DOWNLOAD_TTL);
    }

    @Transactional
    public void delete(CourseUnitFile record) {
        record.markDeleting();
        files.save(record);
        if (record.getStorageBucket() != null) storage.delete(record.getFileKey());
        files.delete(record);
    }

    @Scheduled(fixedDelayString = "${app.storage.cleanup-delay-ms:3600000}")
    @Transactional
    public void cleanup() {
        for (CourseUnitFile file : files.findTop50ByStatusAndExpiresAtBeforeOrderByIdAsc(
                CourseUnitFile.Status.PENDING, Instant.now().minus(Duration.ofHours(24)))) {
            try { storage.delete(file.getFileKey()); } catch (Exception ignored) {}
            files.delete(file);
        }
        for (CourseUnitFile file : files.findTop50ByStatusOrderByIdAsc(CourseUnitFile.Status.DELETING)) {
            try {
                if (file.getStorageBucket() != null) storage.delete(file.getFileKey());
                files.delete(file);
            } catch (Exception ignored) {}
        }
        migrateLegacyFiles();
    }

    void migrateLegacyFiles() {
        for (CourseUnitFile file : files.findTop50ByStorageBucketIsNullAndStatusOrderByIdAsc(CourseUnitFile.Status.READY)) {
            Path source = legacyUploadDir.resolve(file.getFileKey()).normalize();
            if (!source.startsWith(legacyUploadDir) || !Files.isRegularFile(source)) continue;
            String key = "course-files/" + file.getUnit().getId() + "/" + UUID.randomUUID() + ".pdf";
            try (InputStream input = Files.newInputStream(source)) {
                storage.put(key, input, Files.size(source), "application/pdf");
                ObjectStorage.ObjectInfo info = storage.stat(key);
                file.migrateToStorage(storage.bucket(), key, info.checksum());
            } catch (Exception ignored) {
                // Giữ bản cũ để lần dọn sau thử lại và phục vụ rollback.
            }
        }
    }

    private CourseUnitFile owned(Long fileId, User user) {
        CourseUnitFile file = files.findById(fileId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy tài liệu"));
        if (file.getUploadedBy() != null && !user.isAdmin()
                && !file.getUploadedBy().getId().equals(user.getId())) {
            throw new SecurityException("Bạn không có quyền hoàn tất phiên upload này");
        }
        return file;
    }

    private void validateRequest(UploadRequest request) {
        if (request == null || request.fileSize() <= 0 || request.fileSize() > MAX_FILE_SIZE) {
            throw new IllegalArgumentException("File PDF phải có dung lượng từ 1 byte đến 100 MiB");
        }
        if (!"application/pdf".equals(request.contentType())) {
            throw new IllegalArgumentException("Chỉ chấp nhận file PDF");
        }
        if (!safeFilename(request.filename()).toLowerCase(Locale.ROOT).endsWith(".pdf")) {
            throw new IllegalArgumentException("Tên file phải có phần mở rộng .pdf");
        }
    }

    private String safeFilename(String name) {
        if (name == null || name.isBlank()) return "document.pdf";
        String clean = Path.of(name).getFileName().toString().replaceAll("[\\r\\n]", "_");
        if (clean.length() > 255) clean = clean.substring(clean.length() - 255);
        return clean;
    }
}
