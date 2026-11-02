import { memo } from 'react'
import {
  Badge,
  Button,
  Card,
  Collapse,
  Empty,
  Popconfirm,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import { Link } from 'react-router-dom'
import { formatClock } from '../../lib/format'

const HEARTBEAT_TIMEOUT = 15000
const STATUS = {
  IDLE: { text: 'Sẵn sàng', badge: 'success' },
  BUSY: { text: 'Đang chấm', badge: 'processing' },
  DEAD: { text: 'Mất kết nối', badge: 'error' },
}
const LOG_COLOR = { info: 'var(--text-2)', success: 'var(--ac-fg)', warning: 'var(--tle-fg)', error: 'var(--wa-fg)' }
const LOG_LEVEL_OPTIONS = [
  { value: '', label: 'Tất cả' },
  { value: 'info', label: 'Thông tin' },
  { value: 'success', label: 'Thành công' },
  { value: 'warning', label: 'Cảnh báo' },
  { value: 'error', label: 'Lỗi' },
]

export const ClusterSummary = memo(function ClusterSummary({
  alive,
  busy,
  workerCount,
  queueCount,
  submissionCount,
}) {
  return (
    <div className="judge-summary">
      <Card size="small">
        <Statistic title="Máy chấm trực tuyến" value={alive} suffix={`/ ${workerCount}`} />
      </Card>
      <Card size="small">
        <Statistic title="Đang xử lý" value={busy} />
      </Card>
      <Card size="small">
        <Statistic title="Bài còn tồn đọng" value={queueCount} />
      </Card>
      <Card size="small">
        <Statistic title="Tổng bài nộp" value={submissionCount} />
      </Card>
    </div>
  )
})

export const MachineTable = memo(function MachineTable({ workers, now, onControl, pendingAction }) {
  const columns = [
    {
      title: 'Máy chấm',
      dataIndex: 'id',
      key: 'machine',
      render: (_, worker) => (
        <div className="judge-machine__identity">
          <strong className="mono">{worker.id}</strong>
          <span className="mono">{worker.address}</span>
        </div>
      ),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      width: 125,
      render: (value) => {
        const status = STATUS[value] || { text: value, badge: 'default' }
        return <Badge status={status.badge} text={status.text} />
      },
    },
    {
      title: 'Công việc hiện tại',
      dataIndex: 'currentTask',
      width: 150,
      render: (task, worker) => task ? (
        <Link to={`/submissions/${task}`} className="mono">Bài #{task}</Link>
      ) : (
        <Typography.Text type="secondary">
          {worker.status === 'DEAD' ? 'Không nhận bài' : 'Đang chờ bài'}
        </Typography.Text>
      ),
    },
    {
      title: 'Heartbeat',
      dataIndex: 'lastHeartbeat',
      width: 100,
      render: (value, worker) => {
        if (worker.status === 'DEAD') return '—'
        const age = now - value
        const stale = age > HEARTBEAT_TIMEOUT
        return (
          <Tooltip title={`PONG cuối: ${formatClock(value)} · timeout 15s`}>
            <span className={stale ? 'mono judge-machine__heartbeat is-stale' : 'mono judge-machine__heartbeat'}>
              {Math.max(0, Math.round(age / 1000))}s
            </span>
          </Tooltip>
        )
      },
    },
    {
      title: 'Độ trễ',
      dataIndex: 'latencyMs',
      width: 90,
      render: (value, worker) => <span className="mono">{worker.status === 'DEAD' ? '—' : `${value} ms`}</span>,
    },
    {
      title: 'Đã chấm',
      dataIndex: 'completed',
      width: 80,
      render: (value) => <span className="mono">{value}</span>,
    },
    {
      title: '',
      key: 'action',
      width: 250,
      align: 'left',
      render: (_, worker) => {
        const isStopped = worker.status === 'DEAD'
        const isPending = pendingAction?.id === worker.id
        return (
          <Space size={4} wrap={false}>
            <Button
              size="small"
              type="primary"
              disabled={!isStopped || isPending}
              loading={isPending && pendingAction.action === 'START'}
              onClick={() => onControl(worker.id, 'START')}
            >
              Start
            </Button>
            <Popconfirm
              title={`Dừng máy chấm ${worker.id}?`}
              description="Bài đang chấm sẽ được thu hồi và chuyển cho máy khác."
              okText="Stop"
              cancelText="Hủy"
              okButtonProps={{ danger: true }}
              disabled={isStopped || isPending}
              onConfirm={() => onControl(worker.id, 'STOP')}
            >
              <Button
                size="small"
                danger
                disabled={isStopped || isPending}
                loading={isPending && pendingAction.action === 'STOP'}
              >
                Stop
              </Button>
            </Popconfirm>
            <Popconfirm
              title={`Khởi động lại máy chấm ${worker.id}?`}
              description="Kết nối hiện tại sẽ ngắt trong thời gian ngắn."
              okText="Restart"
              cancelText="Hủy"
              disabled={isStopped || isPending}
              onConfirm={() => onControl(worker.id, 'RESTART')}
            >
              <Button
                size="small"
                disabled={isStopped || isPending}
                loading={isPending && pendingAction.action === 'RESTART'}
              >
                Restart
              </Button>
            </Popconfirm>
          </Space>
        )
      },
    },
  ]

  return (
    <Card
      className="judge-machine-panel"
      title="Danh sách máy chấm"
      extra={<Typography.Text type="secondary">{workers.length} máy đã đăng ký</Typography.Text>}
    >
      {workers.length ? (
        <Table
          className="judge-machine-table"
          size="small"
          rowKey="id"
          pagination={false}
          dataSource={workers}
          columns={columns}
          scroll={{ x: 980 }}
        />
      ) : (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có máy chấm đăng ký" />
      )}
    </Card>
  )
})

export const ConnectionLogPanel = memo(function ConnectionLogPanel({ logs, onLevelChange, levelFilter = '' }) {
  const filtered = levelFilter ? logs.filter((entry) => entry.level === levelFilter) : logs
  const content = (
    <div className="judge-connection-log__content">
      <div className="judge-connection-log__toolbar">
        <Select
          size="small"
          value={levelFilter}
          onChange={onLevelChange}
          options={LOG_LEVEL_OPTIONS}
          aria-label="Lọc nhật ký theo mức độ"
        />
        <Badge status="processing" text="Đang nhận trực tiếp" />
      </div>
      <div className="judge-connection-log__list">
        {filtered.map((entry, index) => (
          <div className="judge-connection-log__row" key={`${entry.id ?? 'log'}-${entry.time ?? 'time'}-${index}`}>
            <time>{formatClock(entry.time)}</time>
            <Tag color={entry.level === 'error' ? 'error' : entry.level === 'warning' ? 'warning' : entry.level === 'success' ? 'success' : 'default'}>
              {entry.level === 'error' ? 'Lỗi' : entry.level === 'warning' ? 'Cảnh báo' : entry.level === 'success' ? 'Thành công' : 'Thông tin'}
            </Tag>
            <span style={{ color: LOG_COLOR[entry.level] }}>{entry.message}</span>
          </div>
        ))}
        {!filtered.length && <Typography.Text type="secondary">Không có nhật ký phù hợp</Typography.Text>}
      </div>
    </div>
  )

  return (
    <Collapse
      className="judge-connection-log"
      items={[
        {
          key: 'connection-log',
          label: (
            <div className="judge-connection-log__label">
              <strong>Nhật ký kết nối</strong>
              <span>{logs.length} sự kiện · Chọn để mở</span>
            </div>
          ),
          children: content,
        },
      ]}
    />
  )
})
