import { Progress, Typography } from 'antd'
import { useNow } from '../lib/hooks'
import { formatCountdown } from '../lib/format'
import { liveStatus } from '../lib/contest'

/** Đồng hồ kỳ thi: đếm ngược tới lúc bắt đầu hoặc kết thúc. compact = một dòng cho thanh công cụ. */
export default function ContestClock({ contest, compact }) {
  const now = useNow(1000)
  const status = liveStatus(contest, now)
  const label = status === 'UPCOMING' ? 'Bắt đầu sau' : status === 'RUNNING' ? 'Còn lại' : 'Đã kết thúc'
  const remaining = status === 'UPCOMING' ? contest.startAt - now : status === 'RUNNING' ? contest.endAt - now : 0
  const urgent = status === 'RUNNING' && remaining < 10 * 60_000

  if (compact) {
    return (
      <Typography.Text type={urgent ? 'danger' : 'secondary'} style={{ whiteSpace: 'nowrap' }}>
        {label}
        {status !== 'ENDED' && (
          <b className="mono" style={{ marginInlineStart: 6, color: urgent ? undefined : 'var(--text)' }}>
            {formatCountdown(remaining)}
          </b>
        )}
      </Typography.Text>
    )
  }

  const elapsed = Math.min(1, Math.max(0, (now - contest.startAt) / (contest.endAt - contest.startAt)))
  return (
    <div className="contest-clock">
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        {label}
      </Typography.Text>
      <div className={`contest-clock-time mono${urgent ? ' urgent' : ''}`}>
        {status === 'ENDED' ? '00:00:00' : formatCountdown(remaining)}
      </div>
      {status !== 'UPCOMING' && (
        <Progress
          percent={Math.round(elapsed * 100)}
          showInfo={false}
          size="small"
          status={status === 'ENDED' ? 'normal' : 'active'}
        />
      )}
    </div>
  )
}
