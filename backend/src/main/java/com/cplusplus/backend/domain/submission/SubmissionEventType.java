package com.cplusplus.backend.domain.submission;

/** Mốc trên dòng thời gian của bài nộp (gồm cả Failover). */
public enum SubmissionEventType {
    IN_QUEUE, ASSIGNED, COMPILING, TESTING, SCAN, REJECTED, REQUEUED, FINISHED, FAILED, REJUDGE
}
