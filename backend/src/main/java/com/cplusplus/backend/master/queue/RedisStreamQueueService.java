package com.cplusplus.backend.master.queue;

import com.cplusplus.backend.domain.submission.Submission;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Range;
import org.springframework.data.redis.connection.stream.*;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.List;
import java.util.Map;

/**
 * Hàng đợi bền vững dùng Redis Streams với 3 mức ưu tiên:
 * <ul>
 *   <li>{@code judge:contest}  — bài nộp trong kỳ thi đang diễn ra (ưu tiên cao nhất)</li>
 *   <li>{@code judge:practice} — bài luyện tập</li>
 *   <li>{@code judge:custom}   — custom test (reject khi tải cao)</li>
 * </ul>
 *
 * <p>At-least-once delivery: XACK chỉ gọi SAU KHI ghi DB thành công.
 * Nếu Master crash trước XACK, XAUTOCLAIM sẽ reclaim entry khi restart.
 */
@Service
public class RedisStreamQueueService {

    private static final Logger log = LoggerFactory.getLogger(RedisStreamQueueService.class);

    public static final String STREAM_CONTEST  = "judge:contest";
    public static final String STREAM_PRACTICE = "judge:practice";
    public static final String STREAM_CUSTOM   = "judge:custom";

    /** Thứ tự ưu tiên — contest trước, custom sau. */
    public static final List<String> PRIORITY_ORDER = List.of(STREAM_CONTEST, STREAM_PRACTICE, STREAM_CUSTOM);

    private static final String GROUP = "master-dispatch";

    /**
     * Visibility timeout: compile (20s) + 100 test × 10s + buffer (30s) ≈ 1050s.
     * Entry trong PEL idle quá thời gian này được XAUTOCLAIM khi restart.
     */
    public static final long VISIBILITY_TIMEOUT_MS = 1_050_000L;

    private final StringRedisTemplate redis;

    public RedisStreamQueueService(StringRedisTemplate redis) {
        this.redis = redis;
    }

    @PostConstruct
    void ensureGroups() {
        for (String stream : PRIORITY_ORDER) {
            try {
                redis.opsForStream().createGroup(stream, ReadOffset.latest(), GROUP);
                log.info("Tạo consumer group '{}' trên stream '{}'", GROUP, stream);
            } catch (Exception e) {
                // Group đã tồn tại hoặc stream chưa có — bỏ qua
                log.debug("Consumer group '{}' trên '{}' đã tồn tại hoặc stream trống", GROUP, stream);
            }
        }
    }

    // ------------------------------------------------------------------ enqueue

    public enum Priority { CONTEST, PRACTICE, CUSTOM }

    /** Chọn stream dựa trên submission: contest đang diễn ra → CONTEST, còn lại → PRACTICE. */
    public Priority priorityOf(Submission sub) {
        if (sub.getContest() != null) return Priority.CONTEST;
        return Priority.PRACTICE;
    }

    public String streamOf(Priority priority) {
        return switch (priority) {
            case CONTEST  -> STREAM_CONTEST;
            case PRACTICE -> STREAM_PRACTICE;
            case CUSTOM   -> STREAM_CUSTOM;
        };
    }

    /**
     * Đẩy bài nộp vào đúng stream theo priority.
     *
     * @return Redis Stream message ID (dùng để XACK sau này nếu cần)
     */
    public RecordId enqueue(Submission sub, Priority priority) {
        String stream = streamOf(priority);
        Map<String, String> fields = Map.of(
                "submissionId",  String.valueOf(sub.getId()),
                "attemptToken",  sub.getAttemptToken() != null ? sub.getAttemptToken().toString() : "",
                "enqueuedAt",    String.valueOf(System.currentTimeMillis()),
                "attempt",       String.valueOf(sub.getAttempts())
        );
        RecordId id = redis.opsForStream().add(StreamRecords.newRecord().in(stream).ofMap(fields));
        log.debug("Enqueue bài #{} vào stream '{}' (id={})", sub.getId(), stream, id);
        return id;
    }

    // ------------------------------------------------------------------ readNext

    /**
     * Đọc 1 message từ stream ưu tiên cao nhất có message (non-blocking).
     *
     * @param consumerId ID của consumer (thường là workerId)
     * @return null nếu tất cả stream đều rỗng
     */
    @SuppressWarnings("unchecked")
    public MapRecord<String, Object, Object> readNext(String consumerId) {
        for (String stream : PRIORITY_ORDER) {
            List<MapRecord<String, Object, Object>> records = redis.opsForStream().read(
                    Consumer.from(GROUP, consumerId),
                    StreamReadOptions.empty().count(1),
                    StreamOffset.create(stream, ReadOffset.lastConsumed())
            );
            if (records != null && !records.isEmpty()) {
                return records.get(0);
            }
        }
        return null;
    }

    // ------------------------------------------------------------------ ack

    /**
     * Xác nhận message đã xử lý xong (gọi SAU KHI ghi DB thành công).
     */
    public void ack(String stream, RecordId messageId) {
        try {
            redis.opsForStream().acknowledge(stream, GROUP, messageId);
            log.debug("XACK stream='{}' messageId='{}'", stream, messageId);
        } catch (Exception e) {
            log.warn("Không thể XACK message {}: {}", messageId, e.getMessage());
        }
    }

    // ------------------------------------------------------------------ claimStale

    /**
     * Reclaim các PEL entries đã idle quá {@value #VISIBILITY_TIMEOUT_MS} ms bằng XPENDING + XCLAIM.
     * Gọi trong @PostConstruct của JudgeMasterService; DB orphan scan sau đó re-enqueue chúng.
     *
     * @return tổng số entries được reclaim
     */
    public int claimStale() {
        int total = 0;
        for (String stream : PRIORITY_ORDER) {
            try {
                // Liệt kê PEL entries của group
                var pendingMsgs = redis.opsForStream().pending(
                        stream, Consumer.from(GROUP, "-all-"),
                        Range.unbounded(), 100L);
                if (pendingMsgs == null) continue;

                for (var pm : pendingMsgs) {
                    // Chỉ reclaim entries idle quá visibilityTimeout
                    if (pm.getElapsedTimeSinceLastDelivery() != null
                            && pm.getElapsedTimeSinceLastDelivery().toMillis() > VISIBILITY_TIMEOUT_MS) {
                        try {
                            redis.opsForStream().claim(
                                    stream, GROUP, "recovery",
                                    Duration.ZERO,   // minIdleTime = 0 vì đã lọc ở trên
                                    pm.getId());
                            total++;
                        } catch (Exception ce) {
                            log.debug("XCLAIM failed for {}: {}", pm.getId(), ce.getMessage());
                        }
                    }
                }
                if (total > 0) {
                    log.info("XCLAIM: reclaim {} stale PEL entries từ stream '{}'", total, stream);
                }
            } catch (Exception e) {
                log.debug("Không thể đọc PEL stream '{}': {}", stream, e.getMessage());
            }
        }
        return total;
    }

    // ------------------------------------------------------------------ queue depth

    public long depth(String stream) {
        try {
            StreamInfo.XInfoStream info = redis.opsForStream().info(stream);
            return info.streamLength();
        } catch (Exception e) {
            return 0L;
        }
    }

    public long totalDepth() {
        return PRIORITY_ORDER.stream().mapToLong(this::depth).sum();
    }
}
