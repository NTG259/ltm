import { Clock3, LoaderCircle, TriangleAlert } from 'lucide-react'
import { explainVerdict, statusLabel, VERDICTS } from '../lib/verdicts'
import { formatMemory, formatTime } from '../lib/format'
import { Progress } from './ui/progress'

/**
 * Tóm tắt một bài nộp trong một khối duy nhất:
 * – đang chấm: một dòng trạng thái + thanh tiến độ;
 * – đã xong: nhãn kết quả, câu giải thích, điểm, thời gian/bộ nhớ.
 */
export default function ResultSummary({ submission: s, problem, extra }) {
  if (!s) return null
  const failovers = (s.history || []).filter((h) => h.status === 'FAILOVER').length
  const note = (
    <span className="text-xs text-muted-foreground">
      Bài #{s.id}
      {s.workerId && ` · chấm bởi ${s.workerId}`}
      {failovers > 0 && (
        <span className="text-destructive">
          {' '}
          · <TriangleAlert className="inline size-3" /> máy chấm gặp sự cố, bài đã được tự động chấm lại
        </span>
      )}
    </span>
  )

  if (s.status !== 'FINISHED') {
    const { current = 0, total = 0 } = s.progress || {}
    return (
      <div className="result-summary tone-running">
        <div className="result-main">
          <div className="result-title">
            {s.status === 'IN_QUEUE' ? <Clock3 /> : <LoaderCircle className="animate-spin" />} {statusLabel(s)}…
          </div>
          {note}
        </div>
        {s.status === 'TESTING' && total > 0 && (
          <Progress value={Math.round((current / total) * 100)} aria-label={`Tiến độ chấm ${current}/${total}`} />
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
          <div className="font-mono text-xs">
            {formatTime(s.timeMs)} · {formatMemory(s.memoryKb)}
          </div>
        )}
        {extra}
      </div>
    </div>
  )
}
