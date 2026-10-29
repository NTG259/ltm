package com.cplusplus.backend.controller;

import com.cplusplus.backend.domain.course.CourseUnit;
import com.cplusplus.backend.domain.course.CourseUnitFile;
import com.cplusplus.backend.domain.user.User;
import com.cplusplus.backend.repository.CourseUnitFileRepository;
import com.cplusplus.backend.repository.CourseUnitRepository;
import com.cplusplus.backend.security.AuthInterceptor;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/courses/units/{unitId}/files")
@Transactional(readOnly = true)
public class CourseUnitFileController {

    private static final long MAX_FILE_SIZE = 20 * 1024 * 1024L; // 20 MB

    private final CourseUnitRepository courseUnitRepository;
    private final CourseUnitFileRepository courseUnitFileRepository;
    private final Path uploadDir;

    public CourseUnitFileController(CourseUnitRepository courseUnitRepository,
                                    CourseUnitFileRepository courseUnitFileRepository,
                                    @Value("${app.upload-dir:./uploads/course-files}") String uploadDirStr) {
        this.courseUnitRepository = courseUnitRepository;
        this.courseUnitFileRepository = courseUnitFileRepository;
        this.uploadDir = Paths.get(uploadDirStr).toAbsolutePath().normalize();
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Transactional
    public ResponseEntity<?> uploadFile(@PathVariable Long unitId,
                                        @RequestParam("file") MultipartFile file,
                                        HttpServletRequest req) {
        User user = currentUser(req);
        if (user == null) return unauthorized();
        if (!user.isAdminOrLecturer()) return forbidden();

        CourseUnit unit = courseUnitRepository.findById(unitId).orElse(null);
        if (unit == null) return ResponseEntity.notFound().build();

        if (file.isEmpty()) return badRequest("File không được để trống");
        if (file.getSize() > MAX_FILE_SIZE) return badRequest("File vượt quá giới hạn 20 MB");

        String contentType = file.getContentType();
        if (contentType == null || !contentType.equals("application/pdf")) {
            return badRequest("Chỉ chấp nhận file PDF");
        }

        String originalName = file.getOriginalFilename();
        if (originalName == null || originalName.isBlank()) originalName = "document.pdf";
        // Sanitize filename
        String displayName = Paths.get(originalName).getFileName().toString();
        String fileKey = UUID.randomUUID() + ".pdf";

        try {
            Files.createDirectories(uploadDir);
            Path target = uploadDir.resolve(fileKey);
            file.transferTo(target);
        } catch (IOException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Không thể lưu file: " + e.getMessage()));
        }

        int nextOrder = courseUnitFileRepository.countByUnitId(unitId) + 1;
        CourseUnitFile saved = courseUnitFileRepository.save(
                new CourseUnitFile(unit, displayName, fileKey, file.getSize(), nextOrder));

        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of(
                "id", saved.getId(),
                "filename", saved.getFilename(),
                "fileSize", saved.getFileSize(),
                "orderIndex", saved.getOrderIndex()
        ));
    }

    @GetMapping("/{fileId}/download")
    public ResponseEntity<Resource> downloadFile(@PathVariable Long unitId,
                                                 @PathVariable Long fileId,
                                                 HttpServletRequest req) {
        User user = currentUser(req);
        if (user == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();

        CourseUnitFile fileRecord = courseUnitFileRepository.findById(fileId).orElse(null);
        if (fileRecord == null || !fileRecord.getUnit().getId().equals(unitId))
            return ResponseEntity.notFound().build();

        Path filePath = uploadDir.resolve(fileRecord.getFileKey()).normalize();
        if (!filePath.startsWith(uploadDir) || !Files.exists(filePath))
            return ResponseEntity.notFound().build();

        try {
            Resource resource = new UrlResource(filePath.toUri());
            String encodedName = URLEncoder.encode(fileRecord.getFilename(), StandardCharsets.UTF_8)
                    .replace("+", "%20");
            return ResponseEntity.ok()
                    .contentType(MediaType.APPLICATION_PDF)
                    .header(HttpHeaders.CONTENT_DISPOSITION,
                            "attachment; filename*=UTF-8''" + encodedName)
                    .body(resource);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @DeleteMapping("/{fileId}")
    @Transactional
    public ResponseEntity<?> deleteFile(@PathVariable Long unitId,
                                        @PathVariable Long fileId,
                                        HttpServletRequest req) {
        User user = currentUser(req);
        if (user == null) return unauthorized();
        if (!user.isAdminOrLecturer()) return forbidden();

        CourseUnitFile fileRecord = courseUnitFileRepository.findById(fileId).orElse(null);
        if (fileRecord == null || !fileRecord.getUnit().getId().equals(unitId))
            return ResponseEntity.notFound().build();

        // Xoá file vật lý
        Path filePath = uploadDir.resolve(fileRecord.getFileKey()).normalize();
        if (filePath.startsWith(uploadDir)) {
            try { Files.deleteIfExists(filePath); } catch (IOException ignored) {}
        }

        courseUnitFileRepository.deleteById(fileId);
        return ResponseEntity.noContent().build();
    }

    private User currentUser(HttpServletRequest req) {
        return (User) req.getAttribute(AuthInterceptor.CURRENT_USER_ATTR);
    }

    private ResponseEntity<Map<String, String>> unauthorized() {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Bạn chưa đăng nhập"));
    }

    private ResponseEntity<Map<String, String>> forbidden() {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "Bạn không có quyền thực hiện thao tác này"));
    }

    private ResponseEntity<Map<String, String>> badRequest(String msg) {
        return ResponseEntity.badRequest().body(Map.of("error", msg));
    }
}
