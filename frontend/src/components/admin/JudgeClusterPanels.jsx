import { memo } from 'react'
import {
  Badge,
  Button,
  Card,
  Col,
  Empty,
  Popconfirm,
  Row,
  Space,
  Statistic,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import {
  ApiOutlined,
  CloudServerOutlined,
  DisconnectOutlined,
  HeartFilled,
  ThunderboltOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons'
import { Link } from 'react-router-dom'
import { USE_MOCK } from '../../api'
import { formatClock } from '../../lib/format'

const HEARTBEAT_TIMEOUT = 15000
const STATUS = {
  IDLE: { color: '#10b981', text: 'Rảnh', badge: 'success' },
  BUSY: { color: '#2563eb', text: 'Đang chấm', badge: 'processing' },
  DEAD: { color: '#ef4444', text: 'Mất kết nối', badge: 'error' },
}
const LOG_COLOR = { info: 'var(--text-2)', success: '#10b981', warning: '#f59e0b', error: '#ef4444' }
const QUEUE_COLUMNS = [
  { title: 'Vị trí', dataIndex: 'pos', width: 70 },
  {
    title: 'Bài nộp',
    dataIndex: 'id',
    render: (id) => (
      <Link to={`/submissions/${id}`} className="mono">
        #{id}
      </Link>
    ),
  },
]

export const ClusterSummary = memo(function ClusterSummary({
  alive,
  busy,
  workerCount,
  queueCount,
  submissionCount,
}) {
  return (
    <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
      <Col xs={12} md={6}>
        <Card size="small">
          <Statistic
            title="Worker hoạt động"
            value={alive}
            suffix={`/ ${workerCount}`}
            styles={{ content: { color: alive ? '#10b981' : '#ef4444' } }}
          />
        </Card>
      </Col>
      <Col xs={12} md={6}>
        <Card size="small">
          <Statistic title="Đang chấm" value={busy} prefix={<ThunderboltOutlined />} />
        </Card>
      </Col>
      <Col xs={12} md={6}>
        <Card size="small">
          <Statistic title="Hàng đợi FIFO" value={queueCount} prefix={<UnorderedListOutlined />} />
        </Card>
      </Col>
      <Col xs={12} md={6}>
        <Card size="small">
          <Statistic title="Tổng bài nộp" value={submissionCount} />
        </Card>
      </Col>
    </Row>
  )
})

export const WorkerCard = memo(function WorkerCard({ worker, now, onKill, onRevive }) {
  const status = STATUS[worker.status]
  const heartbeatAge = now - worker.lastHeartbeat
  const stale = worker.status !== 'DEAD' && heartbeatAge > HEARTBEAT_TIMEOUT

  return (
    <Card className="worker-card" style={{ borderColor: worker.status === 'DEAD' ? 'var(--wa-bd)' : undefined }}>
      <div className="worker-card__header">
        <Space>
          <CloudServerOutlined style={{ fontSize: 20, color: status.color }} />
          <div>
            <Typography.Text strong className="mono">
              {worker.id}
            </Typography.Text>
            <div className="mono muted" style={{ fontSize: 12 }}>
              {worker.address}
            </div>
          </div>
        </Space>
        <Badge status={status.badge} text={status.text} />
      </div>
      <Row gutter={8} style={{ marginTop: 14 }}>
        <Col span={8}>
          <div className="muted" style={{ fontSize: 12 }}>
            Heartbeat
          </div>
          <Tooltip title={`PONG cuối: ${formatClock(worker.lastHeartbeat)} · timeout 15s`}>
            <span className="mono" style={{ color: worker.status === 'DEAD' || stale ? '#ef4444' : undefined }}>
              {worker.status === 'DEAD' ? (
                '—'
              ) : (
                <>
                  <HeartFilled style={{ color: '#ef4444', fontSize: 11 }} /> {Math.round(heartbeatAge / 1000)}s
                </>
              )}
            </span>
          </Tooltip>
        </Col>
        <Col span={8}>
          <div className="muted" style={{ fontSize: 12 }}>
            Độ trễ
          </div>
          <span className="mono">{worker.status === 'DEAD' ? '—' : `${worker.latencyMs} ms`}</span>
        </Col>
        <Col span={8}>
          <div className="muted" style={{ fontSize: 12 }}>
            Đã chấm
          </div>
          <span className="mono">{worker.completed}</span>
        </Col>
      </Row>
      <div style={{ marginTop: 12, minHeight: 24 }}>
        {worker.currentTask ? (
          <Link to={`/submissions/${worker.currentTask}`}>
            <Tag color="processing" className="mono">
              Đang chấm #{worker.currentTask}
            </Tag>
          </Link>
        ) : (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {worker.status === 'DEAD' ? 'Không nhận bài' : 'Chờ OP_TASK_ASSIGN'}
          </Typography.Text>
        )}
      </div>
      <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
        {worker.status === 'DEAD' ? (
          <Button size="small" icon={<ApiOutlined />} onClick={() => onRevive(worker.id)} disabled={!USE_MOCK}>
            Kết nối lại
          </Button>
        ) : (
          <Popconfirm
            title={`Ngắt ${worker.id}?`}
            description="Giống nhấn Ctrl+C ở cửa sổ Worker. Bài đang chấm sẽ được thu hồi về đầu hàng đợi."
            okText="Ngắt"
            cancelText="Huỷ"
            okButtonProps={{ danger: true }}
            onConfirm={() => onKill(worker.id)}
          >
            <Button size="small" danger icon={<DisconnectOutlined />}>
              Giả lập sự cố
            </Button>
          </Popconfirm>
        )}
      </div>
    </Card>
  )
})

export const QueuePanel = memo(function QueuePanel({ queue }) {
  const rows = queue.map((id, index) => ({ id, pos: index + 1 }))

  return (
    <Card title="Hàng đợi FIFO" extra={<Typography.Text type="secondary">Least-Busy scheduling</Typography.Text>}>
      {queue.length ? (
        <Table size="small" rowKey="id" pagination={false} dataSource={rows} columns={QUEUE_COLUMNS} />
      ) : (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Hàng đợi trống" />
      )}
    </Card>
  )
})

export const MasterLogPanel = memo(function MasterLogPanel({ logs }) {
  return (
    <Card title="Nhật ký Master" extra={<Badge status="processing" text="Live" />}>
      <div className="log-list">
        {logs.map((entry) => (
          <div className="log-row" key={entry.id}>
            <time>{formatClock(entry.time)}</time>
            <span style={{ color: LOG_COLOR[entry.level] }}>{entry.message}</span>
          </div>
        ))}
      </div>
    </Card>
  )
})
