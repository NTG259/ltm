package com.cplusplus.backend.service;

import com.cplusplus.backend.domain.user.User;
import com.cplusplus.backend.repository.UserRepository;
import com.cplusplus.backend.security.SecurityService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

@Service
public class LecturerCsvImporter {

    private static final Pattern STAFF_ID = Pattern.compile("^[A-Za-z0-9._-]{3,32}$");
    private final UserRepository userRepository;
    private final SecurityService securityService;

    public LecturerCsvImporter(UserRepository userRepository, SecurityService securityService) {
        this.userRepository = userRepository;
        this.securityService = securityService;
    }

    @Transactional
    public Map<String, Object> importFile(MultipartFile file) {
        if (file == null || file.isEmpty() || file.getSize() > 1024 * 1024) {
            throw new IllegalArgumentException("File CSV phải có dữ liệu và không vượt quá 1 MB");
        }

        int imported = 0;
        int skippedInvalid = 0;
        int skippedExisting = 0;
        Set<String> seen = new HashSet<>();
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8))) {
            String headerLine = reader.readLine();
            if (headerLine == null) throw new IllegalArgumentException("CSV không có dòng tiêu đề");
            List<String> headers = parseRow(headerLine);
            int staffIdIndex = -1;
            int fullNameIndex = -1;
            int passwordIndex = -1;
            for (int i = 0; i < headers.size(); i++) {
                String header = normalizeHeader(headers.get(i));
                if (Set.of("staffid", "magv", "magiangvien", "manhanvien", "username").contains(header)) staffIdIndex = i;
                else if (Set.of("fullname", "hoten", "tengiangvien").contains(header)) fullNameIndex = i;
                else if (Set.of("password", "matkhau").contains(header)) passwordIndex = i;
            }
            if (staffIdIndex < 0 || fullNameIndex < 0 || passwordIndex < 0) {
                throw new IllegalArgumentException("CSV phải có ba cột: MaGiangVien,HoTen,MatKhau");
            }

            String line;
            while ((line = reader.readLine()) != null) {
                if (line.isBlank()) continue;
                List<String> columns;
                try {
                    columns = parseRow(line);
                } catch (IllegalArgumentException e) {
                    skippedInvalid++;
                    continue;
                }
                String staffId = column(columns, staffIdIndex).trim();
                String fullName = column(columns, fullNameIndex).trim();
                String password = column(columns, passwordIndex);
                String normalizedId = staffId.toUpperCase(Locale.ROOT);
                if (!STAFF_ID.matcher(staffId).matches() || fullName.isBlank() || fullName.length() > 100
                        || password.length() < 8) {
                    skippedInvalid++;
                    continue;
                }
                if (!seen.add(normalizedId) || userRepository.findByUsernameIgnoreCase(staffId).isPresent()) {
                    skippedExisting++;
                    continue;
                }
                User lecturer = User.lecturer(staffId, fullName, securityService.hashPassword(password));
                lecturer.setInitialPassword(password);
                userRepository.save(lecturer);
                imported++;
            }
        } catch (IOException e) {
            throw new RuntimeException("Lỗi đọc file CSV: " + e.getMessage(), e);
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("imported", imported);
        result.put("skippedInvalid", skippedInvalid);
        result.put("skippedExisting", skippedExisting);
        return result;
    }

    private static String column(List<String> columns, int index) {
        return index < columns.size() ? columns.get(index) : "";
    }

    private static String normalizeHeader(String header) {
        String withoutMarks = Normalizer.normalize(header.replace("\uFEFF", "").trim(), Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "");
        return withoutMarks.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]", "");
    }

    private static List<String> parseRow(String line) {
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
            } else if (c == ',' && !quoted) {
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
}
