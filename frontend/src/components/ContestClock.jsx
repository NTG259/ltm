import { useNow } from '../lib/hooks'
import { formatCountdown } from '../lib/format'
import { liveStatus } from '../lib/contest'
import { Progress } from './ui/progress'

/** Đồng hồ kỳ thi: đếm ngược tới lúc bắt đầu hoặc kết thúc. compact = một dòng cho thanh công cụ. */
export default function ContestClock({ contest, compact }) {
  const now = useNow(1000)
  const status = liveStatus(contest, now)
  const label = status === 'UPCOMING' ? 'Bắt đầu sau' : status === 'RUNNING' ? 'Còn lại' : 'Đã kết thúc'
  const remaining = status === 'UPCOMING' ? contest.startAt - now : status === 'RUNNING' ? contest.endAt - now : 0
  const urgent = status === 'RUNNING' && remaining < 10 * 60_000

  if (compact) {
    return (
      <span className={urgent ? 'whitespace-nowrap text-destructive' : 'whitespace-nowrap text-muted-foreground'}>
        {label}
        {status !== 'ENDED' && (
          <b className="ml-1.5 font-mono text-foreground">
            {formatCountdown(remaining)}
          </b>
        )}
      </span>
    )
  }

  const elapsed = Math.min(1, Math.max(0, (now - contest.startAt) / (contest.endAt - contest.startAt)))
  return (
    <div className="contest-clock">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className={`contest-clock-time mono${urgent ? ' urgent' : ''}`}>
        {status === 'ENDED' ? '00:00:00' : formatCountdown(remaining)}
      </div>
      {status !== 'UPCOMING' && (
        <Progress
          value={Math.round(elapsed * 100)}
          aria-label={`Tiến độ kỳ thi ${Math.round(elapsed * 100)}%`}
        />
      )}
    </div>
  )
}
