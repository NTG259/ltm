package com.cplusplus.backend.service;

import com.cplusplus.backend.domain.classroom.Classroom;
import com.cplusplus.backend.domain.classroom.ClassroomStudent;
import com.cplusplus.backend.domain.classroom.ClassroomContest;
import com.cplusplus.backend.domain.contest.ContestParticipant;
import com.cplusplus.backend.domain.user.User;
import com.cplusplus.backend.repository.ClassroomContestRepository;
import com.cplusplus.backend.repository.ContestParticipantRepository;
import com.cplusplus.backend.repository.ClassroomStudentRepository;
import com.cplusplus.backend.repository.UserRepository;
import com.cplusplus.backend.security.SecurityService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.text.Normalizer;
import java.time.Instant;
import java.util.*;
import java.util.regex.Pattern;

@Service
public class ClassroomCsvImporter {

    private static final Pattern STUDENT_CODE = Pattern.compile("^[A-Za-z0-9._-]{3,32}$");

    private final UserRepository userRepository;
    private final ClassroomStudentRepository classroomStudentRepository;
    private final ClassroomContestRepository classroomContestRepository;
    private final ContestParticipantRepository contestParticipantRepository;
    private final SecurityService securityService;

    public ClassroomCsvImporter(UserRepository userRepository,
                                ClassroomStudentRepository classroomStudentRepository,
                                SecurityService securityService) {
        this(userRepository, classroomStudentRepository, null, null, securityService);
    }

    @Autowired
    public ClassroomCsvImporter(UserRepository userRepository,
                                ClassroomStudentRepository classroomStudentRepository,
                                ClassroomContestRepository classroomContestRepository,
                                ContestParticipantRepository contestParticipantRepository,
                                SecurityService securityService) {
        this.userRepository = userRepository;
        this.classroomStudentRepository = classroomStudentRepository;
        this.classroomContestRepository = classroomContestRepository;
        this.contestParticipantRepository = contestParticipantRepository;
        this.securityService = securityService;
    }

    @Transactional
    public Map<String, Object> importTo(Classroom classroom, MultipartFile file) {
        int imported = 0, alreadyEnrolled = 0, created = 0, skippedInOtherClass = 0, skippedInvalid = 0, skippedExisting = 0;

        if (file == null || file.isEmpty() || file.getSize() > 1024 * 1024) {
            throw new IllegalArgumentException("File CSV phải có dữ liệu và không vượt quá 1 MB");
        }

        List<ClassroomContest> classroomContests = classroomContestRepository != null
                ? classroomContestRepository.findAllWithContestByClassroomId(classroom.getId())
                : List.of();
        Set<String> seenInFile = new HashSet<>();

        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8))) {

            String headerLine = reader.readLine();
            if (headerLine == null) {
                return buildResult(0, 0, 0, 0, 0, 0);
            }

            char delimiter = detectDelimiter(headerLine);
            List<String> headers = parseRow(headerLine, delimiter);
            int mssvIdx = -1, fullNameIdx = -1, passwordIdx = -1;

            for (int i = 0; i < headers.size(); i++) {
                String h = normalizeHeader(headers.get(i));
                if (Set.of("mssv", "studentid", "masinhvien", "ma", "username").contains(h)) mssvIdx = i;
                else if (Set.of("hoten", "hovaten", "fullname", "tensinhvien", "ten").contains(h)) fullNameIdx = i;
                else if (Set.of("password", "matkhau", "pass").contains(h)) passwordIdx = i;
            }

            if (mssvIdx < 0) {
                throw new IllegalArgumentException("CSV phải có ít nhất cột: mssv (hoặc masinhvien)");
            }

            String line;
            while ((line = reader.readLine()) != null) {
                if (line.isBlank()) continue;
                List<String> cols;
                try {
                    cols = parseRow(line, delimiter);
                } catch (IllegalArgumentException e) {
                    skippedInvalid++;
                    continue;
                }

                String mssv = (mssvIdx < cols.size()) ? cols.get(mssvIdx).replace("﻿", "").trim().toUpperCase(Locale.ROOT) : "";
                String fullName = (fullNameIdx >= 0 && fullNameIdx < cols.size()) ? cols.get(fullNameIdx).trim() : "";
                String password = (passwordIdx >= 0 && passwordIdx < cols.size()) ? cols.get(passwordIdx).trim() : "";

                if (!STUDENT_CODE.matcher(mssv).matches()) {
                    skippedInvalid++;
                    continue;
                }

                if (!seenInFile.add(mssv)) {
                    alreadyEnrolled++;
                    continue;
                }

                // Nếu không cung cấp mật khẩu hoặc ngắn hơn 8 ký tự, tự sinh mật khẩu mặc định
                if (password.length() < 8) {
                    password = mssv.length() >= 8 ? mssv : String.format("%-8s", mssv).replace(' ', '0');
                }

                User user = userRepository.findByUsernameIgnoreCase(mssv).orElse(null);
                if (user != null && classroomStudentRepository.existsByClassroomIdAndUserId(classroom.getId(), user.getId())) {
                    alreadyEnrolled++;
                    continue;
                }

                if (user == null) {
                    String displayName = !fullName.isBlank() ? fullName : mssv;
                    user = User.student(mssv, displayName);
                    user.setPasswordHash(securityService.hashPassword(password));
                    user.setInitialPassword(password);
                    user = userRepository.save(user);
                    created++;
                } else {
                    if (user.getPasswordHash() == null) {
                        user.setPasswordHash(securityService.hashPassword(password));
                        user.setInitialPassword(password);
                    }
                    if (!fullName.isBlank() && (user.getFullName() == null || user.getFullName().equals(user.getUsername()))) {
                        user.setFullName(fullName);
                    }
                    userRepository.save(user);
                }

                ClassroomStudent enrollment = new ClassroomStudent(classroom, user, Instant.now());
                enrollment.setImportedPassword(user.getInitialPassword() != null ? user.getInitialPassword() : password);
                classroomStudentRepository.save(enrollment);

                if (contestParticipantRepository != null) {
                    Instant now = Instant.now();
                    for (ClassroomContest cc : classroomContests) {
                        ContestParticipant.Id pid = new ContestParticipant.Id(cc.getContest().getId(), user.getId());
                        if (!contestParticipantRepository.existsById(pid)) {
                            contestParticipantRepository.save(new ContestParticipant(cc.getContest(), user, now));
                        }
                    }
                }
                imported++;
            }
        } catch (IOException e) {
            throw new RuntimeException("Lỗi đọc file CSV: " + e.getMessage(), e);
        }

        return buildResult(imported, alreadyEnrolled, created, skippedInOtherClass, skippedInvalid, skippedExisting);
    }

    private static char detectDelimiter(String line) {
        int semicolons = 0;
        int commas = 0;
        for (char c : line.toCharArray()) {
            if (c == ';') semicolons++;
            else if (c == ',') commas++;
        }
        return semicolons > commas ? ';' : ',';
    }

    private static String normalizeHeader(String header) {
        String withoutMarks = Normalizer.normalize(header.replace("\uFEFF", "").trim(), Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "");
        return withoutMarks.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]", "");
    }

    private static List<String> parseRow(String line, char delimiter) {
        List<String> columns = new ArrayList<>();
        StringBuilder value = new StringBuilder();
        boolean quoted = false;
        for (int i = 0; i < line.length(); i++) {
            char c = line.charAt(i);
            if (c == '"') {
                if (quoted && i + 1 < line.length() && line.charAt(i + 1) == '"') {
                    value.append('"');
                    i++;
                } else {
                    quoted = !quoted;
                }
            } else if (c == delimiter && !quoted) {
                columns.add(value.toString());
                value.setLength(0);
            } else {
                value.append(c);
            }
        }
        if (quoted) throw new IllegalArgumentException("CSV có dấu ngoặc kép chưa đóng");
        columns.add(value.toString());
        return columns;
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
