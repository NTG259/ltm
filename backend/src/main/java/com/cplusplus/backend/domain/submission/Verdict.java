package com.cplusplus.backend.domain.submission;

/** 7 nhãn kết quả cuối cùng của một bài nộp. */
public enum Verdict {
    AC, WA, TLE, MLE, RTE, CE, SEC;

    /** Lần nộp sai có bị tính phút phạt ICPC không (CE và SEC thì không). */
    public boolean isPenalized() {
        return this != AC && this != CE && this != SEC;
    }
}
