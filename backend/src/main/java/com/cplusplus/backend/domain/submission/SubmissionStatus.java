package com.cplusplus.backend.domain.submission;

/** IN_QUEUE → COMPILING → TESTING → FINISHED; FAILED khi Failover quá 3 lần hoặc máy chấm báo lỗi. */
public enum SubmissionStatus {
    IN_QUEUE, COMPILING, TESTING, FINISHED, FAILED;

    public boolean isPending() {
        return this == IN_QUEUE || this == COMPILING || this == TESTING;
    }
}
