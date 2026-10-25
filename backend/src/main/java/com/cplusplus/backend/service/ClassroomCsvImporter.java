package com.cplusplus.backend.service;

import com.cplusplus.backend.domain.classroom.Classroom;
import com.cplusplus.backend.domain.classroom.ClassroomStudent;
import com.cplusplus.backend.domain.user.User;
import com.cplusplus.backend.repository.ClassroomStudentRepository;
import com.cplusplus.backend.repository.UserRepository;
import com.cplusplus.backend.security.SecurityService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.regex.Pattern;

@Service
public class ClassroomCsvImporter {

    private static final Pattern STUDENT_CODE = Pattern.compile("^[A-Z][0-9]{2}[A-Z]{4}[0-9]{3}$");

    private final UserRepository userRepository;
    private final ClassroomStudentRepository classroomStudentRepository;
    private final SecurityService securityService;

    public ClassroomCsvImporter(UserRepository userRepository,
                                ClassroomStudentRepository classroomStudentRepository,
                                SecurityService securityService) {
        this.userRepository = userRepository;
        this.classroomStudentRepository = classroomStudentRepository;
        this.securityService = securityService;
    }

    @Transactional
    public Map<String, Object> importTo(Classroom classroom, MultipartFile file) {
        int imported = 0, alreadyEnrolled = 0, created = 0, skippedInOtherClass = 0, skippedInvalid = 0, skippedExisting = 0;

        if (file == null || file.isEmpty() || file.getSize() > 1024 * 1024) {
            throw new IllegalArgumentException("File CSV phải có dữ liệu và không vượt quá 1 MB");
        }

        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8))) {

            String headerLine = reader.readLine();
            if (headerLine == null) {
                return buildResult(0, 0, 0, 0, 0, 0);
            }

            // Tìm cột MSSV và mật khẩu (case-insensitive, bỏ dấu cách).
            String[] headers = headerLine.split(",");
            int mssvIdx = -1, passwordIdx = -1;
            for (int i = 0; i < headers.length; i++) {
                String h = headers[i].replace("\uFEFF", "").trim().toLowerCase().replace(" ", "");
                if (h.equals("mssv") || h.equals("studentid") || h.equals("masinhvien")) mssvIdx = i;
                else if (h.equals("password") || h.equals("matkhau")) passwordIdx = i;
            }
            if (mssvIdx < 0 || passwordIdx < 0) {
                throw new IllegalArgumentException("CSV phải có hai cột: mssv,password");
            }

            String line;
            while ((line = reader.readLine()) != null) {
                if (line.isBlank()) continue;
                String[] cols = line.split(",", -1);

                String mssv = mssvIdx < cols.length ? cols[mssvIdx].trim().toUpperCase() : "";
                String password = passwordIdx < cols.length ? cols[passwordIdx] : "";

                if (!STUDENT_CODE.matcher(mssv).matches() || password.length() < 8) {
                    skippedInvalid++;
                    continue;
                }

                User user = userRepository.findByUsernameIgnoreCase(mssv).orElse(null);
                if (user != null && classroomStudentRepository.existsByClassroomIdAndUserId(classroom.getId(), user.getId())) {
                    alreadyEnrolled++;
                    continue;
                }
                if (user != null && classroomStudentRepository.existsByUserId(user.getId())) {
                    skippedInOtherClass++;
                    continue;
                }

                if (user == null) {
                    user = User.student(mssv, mssv);
                    user.setPasswordHash(securityService.hashPassword(password));
                    user = userRepository.save(user);
                    created++;
                } else if (user.getPasswordHash() == null) {
                    user.setPasswordHash(securityService.hashPassword(password));
                    userRepository.save(user);
                } else {
                    skippedExisting++;
                    continue;
                }

                classroomStudentRepository.save(new ClassroomStudent(classroom, user, Instant.now()));
                imported++;
            }
        } catch (IOException e) {
            throw new RuntimeException("Lỗi đọc file CSV: " + e.getMessage(), e);
        }

        return buildResult(imported, alreadyEnrolled, created, skippedInOtherClass, skippedInvalid, skippedExisting);
    }

    private Map<String, Object> buildResult(int imported, int alreadyEnrolled, int created,
                                             int skippedInOtherClass, int skippedInvalid, int skippedExisting) {
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("imported", imported);
        r.put("alreadyEnrolled", alreadyEnrolled);
        r.put("created", created);
        r.put("skippedInOtherClass", skippedInOtherClass);
        r.put("skippedInvalid", skippedInvalid);
        r.put("skippedExisting", skippedExisting);
        return r;
    }
}
