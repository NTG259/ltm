package com.cplusplus.backend.domain.submission;

/** Kết quả một test; {@code SKIPPED} khi đã dừng ở test sai trước đó. */
public enum TestStatus {
    AC, WA, TLE, MLE, RTE, SKIPPED
}
