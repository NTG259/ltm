import { Progress, Typography } from 'antd'
import { ClockCircleOutlined, LoadingOutlined, WarningOutlined } from '@ant-design/icons'
import { explainVerdict, statusLabel, VERDICTS } from '../lib/verdicts'
import { formatMemory, formatTime } from '../lib/format'

/**
 * Tóm tắt một bài nộp trong một khối duy nhất:
 * – đang chấm: một dòng trạng thái + thanh tiến độ;
 * – đã xong: nhãn kết quả, câu giải thích, điểm, thời gian/bộ nhớ.
 */
export default function ResultSummary({ submission: s, problem, extra }) {
  if (!s) return null
  const failovers = (s.history || []).filter((h) => h.status === 'FAILOVER').length
  const note = (
    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
      Bài #{s.id}
      {s.workerId && ` · chấm bởi ${s.workerId}`}
      {failovers > 0 && (
        <span style={{ color: '#d97706' }}>
          {' '}
          · <WarningOutlined /> máy chấm gặp sự cố, bài đã được tự động chấm lại
        </span>
      )}
    </Typography.Text>
  )

  if (s.status !== 'FINISHED') {
    const { current = 0, total = 0 } = s.progress || {}
    return (
      <div className="result-summary tone-running">
        <div className="result-main">
          <div className="result-title">
            {s.status === 'IN_QUEUE' ? <ClockCircleOutlined /> : <LoadingOutlined />} {statusLabel(s)}…
          </div>
          {note}
        </div>
        {s.status === 'TESTING' && total > 0 && (
          <Progress percent={Math.round((current / total) * 100)} showInfo={false} size="small" style={{ margin: 0 }} />
        )}
      </div>
    )
  }

  const meta = VERDICTS[s.verdict]
  const ran = !['CE', 'SEC'].includes(s.verdict)
  return (
    <div className={`result-summary tone-${meta?.tone || 'pending'}`}>
      <div className="result-main">
        <div className="result-title">{meta?.label || s.verdict}</div>
        <div>{explainVerdict(s, problem)}</div>
        {note}
      </div>
      <div className="result-side">
        <div className="result-score">
          {s.score ?? 0}
          <small>/100</small>
        </div>
        {ran && (
          <div className="mono" style={{ fontSize: 12 }}>
            {formatTime(s.timeMs)} · {formatMemory(s.memoryKb)}
          </div>
        )}
        {extra}
      </div>
    </div>
  )
}
