package com.cplusplus.backend.controller;

import com.cplusplus.backend.domain.course.CourseUnit;
import com.cplusplus.backend.domain.course.CourseUnitFile;
import com.cplusplus.backend.domain.user.User;
import com.cplusplus.backend.repository.CourseUnitFileRepository;
import com.cplusplus.backend.repository.CourseUnitRepository;
import com.cplusplus.backend.security.AuthInterceptor;
import com.cplusplus.backend.service.CourseUnitFileService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/courses/units/{unitId}/files")
public class CourseUnitFileController {
    private final CourseUnitRepository units;
    private final CourseUnitFileRepository files;
    private final CourseUnitFileService fileService;

    public CourseUnitFileController(CourseUnitRepository units, CourseUnitFileRepository files,
                                    CourseUnitFileService fileService) {
        this.units = units;
        this.files = files;
        this.fileService = fileService;
    }

    @GetMapping
    public ResponseEntity<?> listFiles(@PathVariable Long unitId, HttpServletRequest req) {
        User user = currentUser(req);
        if (user == null) return unauthorized();
        if (units.findById(unitId).isEmpty()) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(files.findByUnitIdAndStatusOrderByOrderIndexAsc(unitId, CourseUnitFile.Status.READY)
                .stream().map(this::toDto).toList());
    }

    @PostMapping("/upload-sessions")
    public ResponseEntity<?> createUpload(@PathVariable Long unitId,
            @RequestBody CourseUnitFileService.UploadRequest body, HttpServletRequest req) {
        User user = currentUser(req);
        if (user == null) return unauthorized();
        if (!user.isAdminOrLecturer()) return forbidden();
        CourseUnit unit = units.findById(unitId).orElse(null);
        if (unit == null) return ResponseEntity.notFound().build();
        if (!canManage(unit, user)) return forbidden();
        return ResponseEntity.status(HttpStatus.CREATED).body(fileService.createUpload(unit, user, body));
    }

    @PostMapping("/{fileId}/complete")
    public ResponseEntity<?> complete(@PathVariable Long unitId, @PathVariable Long fileId,
                                      HttpServletRequest req) {
        User user = currentUser(req);
        if (user == null) return unauthorized();
        CourseUnitFile file = files.findById(fileId).orElse(null);
        if (file == null || !file.getUnit().getId().equals(unitId)) return ResponseEntity.notFound().build();
        if (!canManage(file.getUnit(), user)) return forbidden();
        return ResponseEntity.ok(toDto(fileService.complete(fileId, user)));
    }

    @GetMapping("/{fileId}/download-url")
    public ResponseEntity<?> downloadUrl(@PathVariable Long unitId, @PathVariable Long fileId,
                                         HttpServletRequest req) {
        User user = currentUser(req);
        if (user == null) return unauthorized();
        CourseUnitFile file = files.findById(fileId).orElse(null);
        if (file == null || !file.getUnit().getId().equals(unitId)) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(Map.of(
                "url", fileService.downloadUrl(file),
                "expiresAt", Instant.now().plusSeconds(300).toEpochMilli()));
    }

    @DeleteMapping("/{fileId}")
    public ResponseEntity<?> deleteFile(@PathVariable Long unitId, @PathVariable Long fileId,
                                        HttpServletRequest req) {
        User user = currentUser(req);
        if (user == null) return unauthorized();
        if (!user.isAdminOrLecturer()) return forbidden();
        CourseUnitFile file = files.findById(fileId).orElse(null);
        if (file == null || !file.getUnit().getId().equals(unitId)) return ResponseEntity.notFound().build();
        if (!canManage(file.getUnit(), user)) return forbidden();
        fileService.delete(file);
        return ResponseEntity.noContent().build();
    }

    private Map<String, Object> toDto(CourseUnitFile file) {
        Map<String, Object> dto = new LinkedHashMap<>();
        dto.put("id", file.getId());
        dto.put("filename", file.getFilename());
        dto.put("fileName", file.getFilename());
        dto.put("fileSize", file.getFileSize() != null ? file.getFileSize() : 0L);
        dto.put("contentType", file.getContentType());
        dto.put("orderIndex", file.getOrderIndex());
        dto.put("createdAt", file.getUploadedAt() != null ? file.getUploadedAt().toEpochMilli() : null);
        return dto;
    }

    private User currentUser(HttpServletRequest req) {
        return (User) req.getAttribute(AuthInterceptor.CURRENT_USER_ATTR);
    }

    private boolean canManage(CourseUnit unit, User user) {
        return user.isAdmin() || (user.isLecturer() && unit.getCourse().getCreatedBy() != null
                && unit.getCourse().getCreatedBy().getId().equals(user.getId()));
    }

    private ResponseEntity<Map<String, String>> unauthorized() {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Bạn chưa đăng nhập"));
    }

    private ResponseEntity<Map<String, String>> forbidden() {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "Bạn không có quyền thực hiện thao tác này"));
    }
}
