-- Xếp hạng theo số bài AC, sau đó theo tổng phút đến khi AC.
-- Số lần nộp sai vẫn được giữ trong v_contest_cells để hiển thị,
-- nhưng không còn cộng thêm thời gian.
CREATE OR REPLACE VIEW v_contest_standings AS
WITH totals AS (
    SELECT p.contest_id,
           p.user_id,
           count(*) FILTER (WHERE cc.solved)                    AS solved,
           coalesce(sum(cc.solve_minute::numeric) FILTER (WHERE cc.solved), 0::numeric) AS penalty
    FROM contest_participants p
    LEFT JOIN v_contest_cells cc ON cc.contest_id = p.contest_id AND cc.user_id = p.user_id
    GROUP BY p.contest_id, p.user_id
)
SELECT t.contest_id,
       rank() OVER (PARTITION BY t.contest_id ORDER BY t.solved DESC, t.penalty ASC) AS rank,
       t.user_id,
       u.username,
       u.full_name,
       t.solved,
       t.penalty
FROM totals t
JOIN users u ON u.id = t.user_id;
