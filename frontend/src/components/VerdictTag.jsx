import { Tooltip } from 'antd'
import { CheckCircleFilled, ClockCircleOutlined, LoadingOutlined } from '@ant-design/icons'
import { STATUSES, VERDICTS } from '../lib/verdicts'

/** Nhãn kết quả: hiển thị trạng thái trung gian nếu bài chưa chấm xong. */
export default function VerdictTag({ submission, verdict, status, progress, size, full }) {
  const s = status ?? submission?.status ?? 'FINISHED'
  const v = verdict ?? submission?.verdict
  const p = progress ?? submission?.progress
  const cls = `verdict${size === 'large' ? ' lg' : ''}`

  if (s !== 'FINISHED') {
    const meta = STATUSES[s] || STATUSES.IN_QUEUE
    const text = s === 'TESTING' && p ? `TESTING ${p.current}/${p.total}` : s === 'IN_QUEUE' ? 'IN_QUEUE' : s
    return (
      <Tooltip title={meta.label}>
        <span className={`${cls} tone-${meta.tone}`}>
          {s === 'IN_QUEUE' ? <ClockCircleOutlined /> : <LoadingOutlined />}
          {text}
        </span>
      </Tooltip>
    )
  }
  const meta = VERDICTS[v]
  if (!meta) return <span className={`${cls} tone-pending`}>—</span>
  return (
    <Tooltip title={`${meta.label} – ${meta.desc}`}>
      <span className={`${cls} tone-${meta.tone}`}>
        {v === 'AC' && <CheckCircleFilled />}
        {full ? meta.label : meta.short}
      </span>
    </Tooltip>
  )
}
