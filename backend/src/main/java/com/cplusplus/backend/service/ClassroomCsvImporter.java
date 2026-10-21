package com.cplusplus.backend.service;

import com.cplusplus.backend.domain.classroom.Classroom;
import com.cplusplus.backend.domain.classroom.ClassroomStudent;
import com.cplusplus.backend.domain.user.User;
import com.cplusplus.backend.repository.ClassroomStudentRepository;
import com.cplusplus.backend.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.BufferedReader;
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

    public ClassroomCsvImporter(UserRepository userRepository,
                                ClassroomStudentRepository classroomStudentRepository) {
        this.userRepository = userRepository;
        this.classroomStudentRepository = classroomStudentRepository;
    }

    @Transactional
    public Map<String, Object> importTo(Classroom classroom, MultipartFile file) {
        int imported = 0, alreadyEnrolled = 0, created = 0, skippedInOtherClass = 0, skippedInvalid = 0;

        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8))) {

            String headerLine = reader.readLine();
            if (headerLine == null) {
                return buildResult(0, 0, 0, 0, 0);
            }

            // tìm index cột MSSV và HọTên (case-insensitive, bỏ dấu space)
            String[] headers = headerLine.split(",");
            int mssvIdx = -1, nameIdx = -1;
            for (int i = 0; i < headers.length; i++) {
                String h = headers[i].trim().toLowerCase().replace(" ", "");
                if (h.equals("mssv") || h.equals("studentid") || h.equals("masinhvien")) mssvIdx = i;
                else if (h.contains("ten") || h.contains("name") || h.contains("tên")) nameIdx = i;
            }
            if (mssvIdx < 0) mssvIdx = 0;
            if (nameIdx < 0) nameIdx = 1;

            String line;
            while ((line = reader.readLine()) != null) {
                if (line.isBlank()) continue;
                String[] cols = line.split(",", -1);

                String mssv = mssvIdx < cols.length ? cols[mssvIdx].trim().toUpperCase() : "";
                String fullName = nameIdx < cols.length ? cols[nameIdx].trim() : mssv;
                if (fullName.isBlank()) fullName = mssv;

                if (!STUDENT_CODE.matcher(mssv).matches()) {
                    skippedInvalid++;
                    continue;
                }

                // upsert user
                User user = userRepository.findByUsernameIgnoreCase(mssv).orElse(null);
                if (user == null) {
                    user = userRepository.save(User.student(mssv, fullName));
                    created++;
                }

                // kiểm tra đã enrolled lớp này chưa
                if (classroomStudentRepository.existsByClassroomIdAndUserId(classroom.getId(), user.getId())) {
                    alreadyEnrolled++;
                    continue;
                }

                // kiểm tra đang ở lớp khác (UNIQUE constraint)
                if (classroomStudentRepository.existsByUserId(user.getId())) {
                    skippedInOtherClass++;
                    continue;
                }

                classroomStudentRepository.save(new ClassroomStudent(classroom, user, Instant.now()));
                imported++;
            }
        } catch (Exception e) {
            throw new RuntimeException("Lỗi đọc file CSV: " + e.getMessage(), e);
        }

        return buildResult(imported, alreadyEnrolled, created, skippedInOtherClass, skippedInvalid);
    }

    private Map<String, Object> buildResult(int imported, int alreadyEnrolled, int created,
                                             int skippedInOtherClass, int skippedInvalid) {
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("imported", imported);
        r.put("alreadyEnrolled", alreadyEnrolled);
        r.put("created", created);
        r.put("skippedInOtherClass", skippedInOtherClass);
        r.put("skippedInvalid", skippedInvalid);
        return r;
    }
}
