import { CheckCircle2, Clock3, LoaderCircle } from 'lucide-react'
import { statusLabel, STATUSES, VERDICTS } from '../lib/verdicts'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'

/** Nhãn kết quả: hiển thị trạng thái trung gian nếu bài chưa chấm xong. */
export default function VerdictTag({ submission, verdict, status, progress, size, full }) {
  const s = status ?? submission?.status ?? 'FINISHED'
  const v = verdict ?? submission?.verdict
  const p = progress ?? submission?.progress
  const cls = `verdict${size === 'large' ? ' lg' : ''}`

  if (s !== 'FINISHED') {
    const meta = STATUSES[s] || STATUSES.IN_QUEUE
    return (
      <span className={`${cls} tone-${meta.tone} font-sans font-medium`}>
        {s === 'IN_QUEUE' ? <Clock3 /> : <LoaderCircle className="animate-spin" />}
        {statusLabel({ status: s, progress: p })}
      </span>
    )
  }
  const meta = VERDICTS[v]
  if (!meta) return <span className={`${cls} tone-pending`}>—</span>
  return (
    <Tooltip>
      <TooltipTrigger render={<span className={`${cls} tone-${meta.tone}`} />}>
        {v === 'AC' && <CheckCircle2 />}
        {full ? meta.label : meta.short}
      </TooltipTrigger>
      <TooltipContent>{meta.label} – {meta.desc}</TooltipContent>
    </Tooltip>
  )
}
