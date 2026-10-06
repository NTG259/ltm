import { Alert, Progress, Space, Steps, Tag, Typography } from 'antd'
import { CloudServerOutlined, SwapOutlined } from '@ant-design/icons'
import VerdictTag from './VerdictTag'
import { formatMemory, formatTime } from '../lib/format'

const ORDER = ['IN_QUEUE', 'COMPILING', 'TESTING', 'FINISHED']

/** Thanh tiến trình chấm realtime nhận từ WebSocket: IN_QUEUE → COMPILING → TESTING x/y → FINISHED. */
export default function JudgeProgress({ submission: s, compact }) {
  if (!s) return null
  const current = ORDER.indexOf(s.status)
  const failed = s.status === 'FINISHED' && s.verdict !== 'AC'
  const { current: done = 0, total = 0 } = s.progress || {}
  const failovers = (s.history || []).filter((h) => h.status === 'FAILOVER')
  const percent =
    s.status === 'FINISHED'
      ? 100
      : s.status === 'TESTING'
        ? Math.round(((done - 0.5) / Math.max(total, 1)) * 100)
        : s.status === 'COMPILING'
          ? 5
          : 0

  return (
    <Space orientation="vertical" size={12} style={{ width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <Typography.Text strong className="mono">
          #{s.id}
        </Typography.Text>
        <VerdictTag submission={s} size="large" full={s.status === 'FINISHED'} />
        {s.status === 'FINISHED' && s.score != null && (
          <Typography.Text strong style={{ fontSize: 16 }}>
            {s.score}
            <Typography.Text type="secondary"> / 100</Typography.Text>
          </Typography.Text>
        )}
        {s.status === 'FINISHED' && !['CE', 'SEC'].includes(s.verdict) && (
          <Typography.Text type="secondary" className="mono" style={{ fontSize: 12 }}>
            {formatTime(s.timeMs)} · {formatMemory(s.memoryKb)}
          </Typography.Text>
        )}
        <span style={{ flex: 1 }} />
        {s.workerId && (
          <Tag icon={<CloudServerOutlined />} color={s.status === 'FINISHED' ? 'default' : 'processing'} className="mono">
            {s.workerId}
          </Tag>
        )}
        {s.attempts > 1 && (
          <Tag icon={<SwapOutlined />} color="warning">
            Lần chấm {s.attempts}/3
          </Tag>
        )}
      </div>
      {!compact && (
        <Steps
          size="small"
          current={current}
          status={failed ? 'error' : s.status === 'FINISHED' ? 'finish' : 'process'}
          items={[
            { title: 'Hàng đợi', content: 'FIFO trên Master' },
            { title: 'Biên dịch', content: 'Quét Regex + g++' },
            {
              title: 'Chấm test',
              content: total ? `${s.status === 'FINISHED' ? done : Math.max(done, 0)}/${total} test` : 'Sandbox TL/ML',
            },
            { title: 'Kết quả', content: s.status === 'FINISHED' ? s.verdict : 'OP_TASK_RESULT' },
          ]}
        />
      )}
      {s.status !== 'IN_QUEUE' && (
        <Progress
          percent={percent}
          size="small"
          status={s.status === 'FINISHED' ? (failed ? 'exception' : 'success') : 'active'}
          format={() => (total ? `${done}/${total}` : '')}
        />
      )}
      {failovers.length > 0 && (
        <Alert
          type="warning"
          showIcon
          title="Failover: bài đã được thu hồi và chấm lại"
          description={failovers.map((f) => f.note).join(' · ')}
        />
      )}
    </Space>
  )
}
