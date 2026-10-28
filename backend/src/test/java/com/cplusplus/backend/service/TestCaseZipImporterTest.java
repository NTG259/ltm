package com.cplusplus.backend.service;

import com.cplusplus.backend.domain.problem.Problem;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

import static org.assertj.core.api.Assertions.assertThat;

class TestCaseZipImporterTest {

    private final TestCaseZipImporter importer = new TestCaseZipImporter();

    private byte[] createZip(String... filesAndContents) throws IOException {
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        try (ZipOutputStream zos = new ZipOutputStream(baos, StandardCharsets.UTF_8)) {
            for (int i = 0; i < filesAndContents.length; i += 2) {
                String filename = filesAndContents[i];
                String content = filesAndContents[i + 1];
                ZipEntry entry = new ZipEntry(filename);
                zos.putNextEntry(entry);
                zos.write(content.getBytes(StandardCharsets.UTF_8));
                zos.closeEntry();
            }
        }
        return baos.toByteArray();
    }

    @Test
    void parsesNumericInAndOutFilesWithNaturalSort() throws IOException {
        byte[] zipData = createZip(
                "10.in", "10 20\n",
                "10.out", "30\n",
                "1.in", "1 2\n",
                "1.out", "3\n",
                "2.in", "2 3\n",
                "2.out", "5\n"
        );
        MockMultipartFile file = new MockMultipartFile("file", "tests.zip", "application/zip", zipData);

        TestCaseZipImporter.ParseResult result = importer.parse(file);

        assertThat(result.tests()).hasSize(3);
        // Kiểm tra thứ tự tự nhiên: 1 -> 2 -> 10 (thay vì 1 -> 10 -> 2)
        assertThat(result.tests().get(0).key()).isEqualTo("1");
        assertThat(result.tests().get(0).input()).isEqualTo("1 2\n");
        assertThat(result.tests().get(0).output()).isEqualTo("3\n");

        assertThat(result.tests().get(1).key()).isEqualTo("2");
        assertThat(result.tests().get(1).input()).isEqualTo("2 3\n");
        assertThat(result.tests().get(1).output()).isEqualTo("5\n");

        assertThat(result.tests().get(2).key()).isEqualTo("10");
        assertThat(result.tests().get(2).input()).isEqualTo("10 20\n");
        assertThat(result.tests().get(2).output()).isEqualTo("30\n");

        assertThat(result.unpairedInputs()).isEmpty();
        assertThat(result.unpairedOutputs()).isEmpty();
    }

    @Test
    void parsesThemisAndFolderStructures() throws IOException {
        byte[] zipData = createZip(
                "test01.inp", "10\n",
                "test01.out", "20\n",
                "input/2.txt", "100\n",
                "output/2.txt", "200\n"
        );
        MockMultipartFile file = new MockMultipartFile("file", "themis_tests.zip", "application/zip", zipData);

        TestCaseZipImporter.ParseResult result = importer.parse(file);

        assertThat(result.tests()).hasSize(2);
        assertThat(result.unpairedInputs()).isEmpty();
    }

    @Test
    void detectsUnpairedTestFiles() throws IOException {
        byte[] zipData = createZip(
                "1.in", "1\n",
                "1.out", "1\n",
                "2.in", "2\n" // Thiếu 2.out
        );
        MockMultipartFile file = new MockMultipartFile("file", "partial.zip", "application/zip", zipData);

        TestCaseZipImporter.ParseResult result = importer.parse(file);

        assertThat(result.tests()).hasSize(1);
        assertThat(result.unpairedInputs()).containsExactly("2");
    }

    @Test
    void importsDirectlyToProblemAndPreservesSamples() throws IOException {
        byte[] zipData = createZip(
                "1.in", "input 1\n",
                "1.out", "output 1\n",
                "2.in", "input 2\n",
                "2.out", "output 2\n"
        );
        MockMultipartFile file = new MockMultipartFile("file", "tests.zip", "application/zip", zipData);

        Problem problem = new Problem("Test Problem", "Statement");
        // Thêm test sample ví dụ
        problem.addTestCase("sample_in", "sample_out", true);

        TestCaseZipImporter.ImportResult result = importer.importToProblem(problem, file, true);

        assertThat(result.importedCount()).isEqualTo(2);
        // Tổng số test = 1 sample + 2 tests từ zip = 3
        assertThat(problem.getTestCases()).hasSize(3);
        assertThat(problem.getTestCases().get(0).isSample()).isTrue();
        assertThat(problem.getTestCases().get(0).getInput()).isEqualTo("sample_in");
        assertThat(problem.getTestCases().get(1).isSample()).isFalse();
        assertThat(problem.getTestCases().get(1).getInput()).isEqualTo("input 1\n");
        assertThat(problem.getTestCases().get(2).isSample()).isFalse();
        assertThat(problem.getTestCases().get(2).getInput()).isEqualTo("input 2\n");
    }
}
