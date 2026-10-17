-- Cập nhật kỳ thi thử #1 và giữa kỳ #2 đang diễn ra (RUNNING) để thí sinh có thể làm bài và hệ thống giám sát hoạt động
UPDATE contests
SET start_at = NOW() - INTERVAL '30 minutes',
    end_at = NOW() + INTERVAL '14 days'
WHERE id IN (1, 2);
