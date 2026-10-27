package com.cplusplus.backend.service;

import com.cplusplus.backend.domain.problem.Problem;
import com.cplusplus.backend.domain.problem.TestCase;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

/**
 * Dịch vụ giải nén và phân tích bộ testcase từ file ZIP.
 * Hỗ trợ các quy chuẩn đặt tên phổ biến:
 * 1. 1.in / 1.out, 1.inp / 1.out, 1.in / 1.ans
 * 2. input01.txt / output01.txt, in1.txt / out1.txt
 * 3. input/1.txt / output/1.txt
 * 4. test01/input.txt / test01/output.txt
 */
@Service
public class TestCaseZipImporter {

    private static final Logger log = LoggerFactory.getLogger(TestCaseZipImporter.class);

    private static final long MAX_ZIP_SIZE = 50 * 1024 * 1024; // 50 MB
    private static final long MAX_SINGLE_FILE_SIZE = 10 * 1024 * 1024; // 10 MB per test file
    private static final int MAX_TESTS = 500; // Tối đa 500 testcases/đề

    public record ParsedTest(String key, String input, String output) {
    }

    public record ParseResult(
            List<ParsedTest> tests,
            List<String> unpairedInputs,
            List<String> unpairedOutputs
    ) {
    }

    public record ImportResult(
            int importedCount,
            List<String> testKeys,
            List<String> unpairedInputs,
            List<String> unpairedOutputs
    ) {
    }

    /**
     * Tự nhiên sắp xếp chuỗi có chứa số (Natural Sort Order: 1, 2, 9, 10, 100 thay vì 1, 10, 100, 2).
     */
    public static final Comparator<String> NATURAL_ORDER = (a, b) -> {
        int i = 0, j = 0;
        while (i < a.length() && j < b.length()) {
            char ca = a.charAt(i);
            char cb = b.charAt(j);
            if (Character.isDigit(ca) && Character.isDigit(cb)) {
                int startA = i;
                while (i < a.length() && Character.isDigit(a.charAt(i))) i++;
                int startB = j;
                while (j < b.length() && Character.isDigit(b.charAt(j))) j++;
                String numA = a.substring(startA, i);
                String numB = b.substring(startB, j);
                String tA = numA.replaceFirst("^0+", "");
                String tB = numB.replaceFirst("^0+", "");
                if (tA.length() != tB.length()) {
                    return tA.length() - tB.length();
                }
                int cmp = tA.compareTo(tB);
                if (cmp != 0) return cmp;
                cmp = numA.compareTo(numB);
                if (cmp != 0) return cmp;
            } else {
                int cmp = Character.compare(Character.toLowerCase(ca), Character.toLowerCase(cb));
                if (cmp != 0) return cmp;
                i++;
                j++;
            }
        }
        return Integer.compare(a.length(), b.length());
    };

    /**
     * Giải nén và phân tích các cặp input/output từ file ZIP.
     */
    public ParseResult parse(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("File ZIP tải lên không có dữ liệu");
        }
        if (file.getSize() > MAX_ZIP_SIZE) {
            throw new IllegalArgumentException("Dung lượng file ZIP vượt quá giới hạn 50 MB");
        }

        Map<String, String> inputs = new HashMap<>();
        Map<String, String> outputs = new HashMap<>();

        try (InputStream is = file.getInputStream();
             ZipInputStream zis = new ZipInputStream(is, StandardCharsets.UTF_8)) {

            ZipEntry entry;
            byte[] buffer = new byte[8192];

            while ((entry = zis.getNextEntry()) != null) {
                if (entry.isDirectory()) {
                    continue;
                }

                String rawPath = entry.getName().replace('\\', '/').trim();
                while (rawPath.startsWith("/")) {
                    rawPath = rawPath.substring(1);
                }

                // Bỏ qua các file hệ thống ẩn của macOS / Windows
                if (rawPath.startsWith("__MACOSX/") || rawPath.endsWith(".DS_Store")
                        || rawPath.endsWith("Thumbs.db") || rawPath.endsWith("desktop.ini")) {
                    continue;
                }

                // Đọc nội dung file
                ByteArrayOutputStream baos = new ByteArrayOutputStream();
                int read;
                long totalBytes = 0;
                while ((read = zis.read(buffer)) != -1) {
                    totalBytes += read;
                    if (totalBytes > MAX_SINGLE_FILE_SIZE) {
                        throw new IllegalArgumentException("File " + rawPath + " vượt quá giới hạn 10 MB");
                    }
                    baos.write(buffer, 0, read);
                }
                String content = baos.toString(StandardCharsets.UTF_8);

                classifyAndStore(rawPath, content, inputs, outputs);
            }
        } catch (IOException e) {
            log.error("Lỗi khi đọc file ZIP", e);
            throw new IllegalArgumentException("Không thể đọc hoặc giải nén file ZIP: " + e.getMessage());
        }

        // Ghép cặp Input và Output
        List<ParsedTest> matchedTests = new ArrayList<>();
        List<String> unpairedInputs = new ArrayList<>();
        List<String> unpairedOutputs = new ArrayList<>(outputs.keySet());

        // Lấy danh sách keys từ inputs và sắp xếp theo thứ tự tự nhiên
        List<String> sortedInputKeys = new ArrayList<>(inputs.keySet());
        sortedInputKeys.sort(NATURAL_ORDER);

        for (String inKey : sortedInputKeys) {
            String matchingOutKey = findMatchingOutputKey(inKey, outputs.keySet());
            if (matchingOutKey != null) {
                matchedTests.add(new ParsedTest(inKey, inputs.get(inKey), outputs.get(matchingOutKey)));
                unpairedOutputs.remove(matchingOutKey);
            } else {
                unpairedInputs.add(inKey);
            }
        }

        unpairedOutputs.sort(NATURAL_ORDER);

        if (matchedTests.isEmpty()) {
            throw new IllegalArgumentException(
                    "Không tìm thấy cặp testcase hợp lệ nào trong file ZIP. Vui lòng đảm bảo các file có tên tương ứng như 1.in / 1.out, input01.txt / output01.txt,..."
            );
        }

        if (matchedTests.size() > MAX_TESTS) {
            throw new IllegalArgumentException("Số lượng test case trong file ZIP (" + matchedTests.size() + ") vượt quá giới hạn " + MAX_TESTS);
        }

        return new ParseResult(matchedTests, unpairedInputs, unpairedOutputs);
    }

    /**
     * Nhập trực tiếp các testcase từ file ZIP vào Problem entity.
     */
    public ImportResult importToProblem(Problem problem, MultipartFile file, boolean keepSamples) {
        ParseResult parseResult = parse(file);

        List<TestCase.Data> newTestData = new ArrayList<>();

        // Giữ lại test ví dụ nếu có yêu cầu
        if (keepSamples) {
            for (TestCase tc : problem.getTestCases()) {
                if (tc.isSample()) {
                    newTestData.add(new TestCase.Data(tc.getInput(), tc.getExpectedOutput(), true));
                }
            }
        }

        List<String> importedKeys = new ArrayList<>();
        for (ParsedTest pt : parseResult.tests()) {
            newTestData.add(new TestCase.Data(pt.input(), pt.output(), false));
            importedKeys.add(pt.key());
        }

        problem.replaceTestCases(newTestData);

        return new ImportResult(
                parseResult.tests().size(),
                importedKeys,
                parseResult.unpairedInputs(),
                parseResult.unpairedOutputs()
        );
    }

    /**
     * Phân loại file thành Input hoặc Output dựa trên cấu trúc thư mục, tên file và phần mở rộng.
     */
    private void classifyAndStore(String rawPath, String content, Map<String, String> inputs, Map<String, String> outputs) {
        int lastSlash = rawPath.lastIndexOf('/');
        String folder = lastSlash >= 0 ? rawPath.substring(0, lastSlash).toLowerCase() : "";
        String filename = lastSlash >= 0 ? rawPath.substring(lastSlash + 1) : rawPath;

        int lastDot = filename.lastIndexOf('.');
        String ext = lastDot >= 0 ? filename.substring(lastDot + 1).toLowerCase() : "";
        String base = lastDot >= 0 ? filename.substring(0, lastDot) : filename;
        String lowerBase = base.toLowerCase();

        // 1. Phân loại theo thư mục input/ vs output/
        boolean inInputFolder = folder.equals("input") || folder.endsWith("/input")
                || folder.equals("in") || folder.endsWith("/in")
                || folder.equals("inputs") || folder.endsWith("/inputs");
        boolean inOutputFolder = folder.equals("output") || folder.endsWith("/output")
                || folder.equals("out") || folder.endsWith("/out")
                || folder.equals("ans") || folder.endsWith("/ans")
                || folder.equals("outputs") || folder.endsWith("/outputs");

        if (inInputFolder) {
            String key = stripFolderSuffix(folder, "input", "inputs", "in") + "/" + base;
            inputs.put(cleanKey(key), content);
            return;
        }
        if (inOutputFolder) {
            String key = stripFolderSuffix(folder, "output", "outputs", "out", "ans") + "/" + base;
            outputs.put(cleanKey(key), content);
            return;
        }

        // 2. Phân loại theo tên file trong folder từng test (ví dụ test01/input.txt và test01/output.txt)
        if (lowerBase.equals("input") || lowerBase.equals("in")) {
            inputs.put(cleanKey(folder.isEmpty() ? base : folder), content);
            return;
        }
        if (lowerBase.equals("output") || lowerBase.equals("out") || lowerBase.equals("ans")) {
            outputs.put(cleanKey(folder.isEmpty() ? base : folder), content);
            return;
        }

        // 3. Phân loại theo phần mở rộng phổ biến: .in, .inp, .input vs .out, .ans, .output, .sol
        if (ext.equals("in") || ext.equals("inp") || ext.equals("input")) {
            String key = (folder.isEmpty() ? "" : folder + "/") + base;
            inputs.put(cleanKey(key), content);
            return;
        }
        if (ext.equals("out") || ext.equals("ans") || ext.equals("output") || ext.equals("sol")) {
            String key = (folder.isEmpty() ? "" : folder + "/") + base;
            outputs.put(cleanKey(key), content);
            return;
        }

        // 4. Phân loại theo tiền tố tên file: input01.txt vs output01.txt, in1.txt vs out1.txt
        if (lowerBase.startsWith("input") || lowerBase.startsWith("output")) {
            boolean isInput = lowerBase.startsWith("input");
            String keySuffix = isInput ? lowerBase.substring(5) : lowerBase.substring(6);
            String key = cleanKey((folder.isEmpty() ? "" : folder + "/") + keySuffix);
            if (isInput) inputs.put(key, content);
            else outputs.put(key, content);
            return;
        }

        if (lowerBase.startsWith("in") && lowerBase.length() > 2 && Character.isDigit(lowerBase.charAt(2))) {
            inputs.put(cleanKey((folder.isEmpty() ? "" : folder + "/") + lowerBase.substring(2)), content);
            return;
        }
        if (lowerBase.startsWith("out") && lowerBase.length() > 3 && Character.isDigit(lowerBase.charAt(3))) {
            outputs.put(cleanKey((folder.isEmpty() ? "" : folder + "/") + lowerBase.substring(3)), content);
        }
    }

    private String cleanKey(String key) {
        key = key.replace('\\', '/').trim();
        while (key.startsWith("/")) key = key.substring(1);
        while (key.endsWith("/")) key = key.substring(0, key.length() - 1);
        return key;
    }

    private String stripFolderSuffix(String folder, String... suffixes) {
        for (String suffix : suffixes) {
            if (folder.equals(suffix)) return "";
            if (folder.endsWith("/" + suffix)) {
                return folder.substring(0, folder.length() - suffix.length() - 1);
            }
        }
        return folder;
    }

    private String findMatchingOutputKey(String inKey, Set<String> outputKeys) {
        if (outputKeys.contains(inKey)) {
            return inKey;
        }
        for (String outKey : outputKeys) {
            if (outKey.equalsIgnoreCase(inKey)) {
                return outKey;
            }
            // Thử so khớp khi có hoặc không có số 0 ở đầu (ví dụ: "1" khớp với "01")
            String cleanIn = inKey.replaceAll("^0+", "");
            String cleanOut = outKey.replaceAll("^0+", "");
            if (!cleanIn.isEmpty() && cleanIn.equalsIgnoreCase(cleanOut)) {
                return outKey;
            }
        }
        return null;
    }
}
