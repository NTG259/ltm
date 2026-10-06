import { useCallback, useState } from 'react'
import {
  App,
  Badge,
  Button,
  Card,
  Col,
  Empty,
  Popconfirm,
  Row,
  Space,
  Spin,
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
import { api, USE_MOCK } from '../../api'
import { useFetch, useNow, useSocket } from '../../lib/hooks'
import { formatClock } from '../../lib/format'

const HEARTBEAT_TIMEOUT = 15000
const STATUS = {
  IDLE: { color: '#10b981', text: 'Rảnh', badge: 'success' },
  BUSY: { color: '#2563eb', text: 'Đang chấm', badge: 'processing' },
  DEAD: { color: '#ef4444', text: 'Mất kết nối', badge: 'error' },
}
const LOG_COLOR = { info: 'var(--text-2)', success: '#10b981', warning: '#f59e0b', error: '#ef4444' }

function WorkerCard({ w, now, onKill, onRevive }) {
  const st = STATUS[w.status]
  const age = now - w.lastHeartbeat
  const stale = w.status !== 'DEAD' && age > HEARTBEAT_TIMEOUT
  return (
    <Card className="worker-card" style={{ borderColor: w.status === 'DEAD' ? '#fecaca' : undefined }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <Space>
          <CloudServerOutlined style={{ fontSize: 20, color: st.color }} />
          <div>
            <Typography.Text strong className="mono">
              {w.id}
            </Typography.Text>
            <div className="mono muted" style={{ fontSize: 12 }}>
              {w.address}
            </div>
          </div>
        </Space>
        <Badge status={st.badge} text={st.text} />
      </div>
      <Row gutter={8} style={{ marginTop: 14 }}>
        <Col span={8}>
          <div className="muted" style={{ fontSize: 12 }}>
            Heartbeat
          </div>
          <Tooltip title={`PONG cuối: ${formatClock(w.lastHeartbeat)} · timeout 15s`}>
            <span className="mono" style={{ color: w.status === 'DEAD' || stale ? '#ef4444' : undefined }}>
              {w.status === 'DEAD' ? (
                '—'
              ) : (
                <>
                  <HeartFilled style={{ color: '#ef4444', fontSize: 11 }} /> {Math.round(age / 1000)}s
                </>
              )}
            </span>
          </Tooltip>
        </Col>
        <Col span={8}>
          <div className="muted" style={{ fontSize: 12 }}>
            Độ trễ
          </div>
          <span className="mono">{w.status === 'DEAD' ? '—' : `${w.latencyMs} ms`}</span>
        </Col>
        <Col span={8}>
          <div className="muted" style={{ fontSize: 12 }}>
            Đã chấm
          </div>
          <span className="mono">{w.completed}</span>
        </Col>
      </Row>
      <div style={{ marginTop: 12, minHeight: 24 }}>
        {w.currentTask ? (
          <Link to={`/submissions/${w.currentTask}`}>
            <Tag color="processing" className="mono">
              Đang chấm #{w.currentTask}
            </Tag>
          </Link>
        ) : (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {w.status === 'DEAD' ? 'Không nhận bài' : 'Chờ OP_TASK_ASSIGN'}
          </Typography.Text>
        )}
      </div>
      <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
        {w.status === 'DEAD' ? (
          <Button size="small" icon={<ApiOutlined />} onClick={() => onRevive(w.id)} disabled={!USE_MOCK}>
            Kết nối lại
          </Button>
        ) : (
          <Popconfirm
            title={`Ngắt ${w.id}?`}
            description="Giống nhấn Ctrl+C ở cửa sổ Worker. Bài đang chấm sẽ được thu hồi về đầu hàng đợi."
            okText="Ngắt"
            cancelText="Huỷ"
            okButtonProps={{ danger: true }}
            onConfirm={() => onKill(w.id)}
          >
            <Button size="small" danger icon={<DisconnectOutlined />}>
              Giả lập sự cố
            </Button>
          </Popconfirm>
        )}
      </div>
    </Card>
  )
}

export default function AdminDashboardPage() {
  const now = useNow(1000)
  const { message } = App.useApp()
  const overview = useFetch(() => api.adminOverview(), [])
  const [live, setLive] = useState({})

  useSocket(
    useCallback((msg) => {
      if (msg.type === 'WORKER_UPDATE') setLive((l) => ({ ...l, workers: msg.workers, queue: msg.queue }))
      if (msg.type === 'LOG') setLive((l) => ({ ...l, logs: [msg.entry, ...(l.logs || [])].slice(0, 200) }))
      if (msg.type === 'SUBMISSION_UPDATE' && msg.submission.status === 'IN_QUEUE' && msg.submission.attempts === 0)
        setLive((l) => ({ ...l, newIds: new Set(l.newIds).add(msg.submission.id) }))
    }, []),
  )

  const base = overview.data || { workers: [], queue: [], logs: [], submissions: 0 }
  const workers = live.workers || base.workers
  const logs = live.logs ? [...live.logs, ...base.logs.filter((b) => !live.logs.some((x) => x.id === b.id))] : base.logs
  const queue = live.queue || base.queue
  const alive = workers.filter((w) => w.status !== 'DEAD').length
  const busy = workers.filter((w) => w.status === 'BUSY').length

  const kill = async (id) => {
    await api.killWorker(id)
    message.warning(`${id} đã bị ngắt – Master kích hoạt Failover`)
  }
  const revive = async (id) => {
    try {
      await api.reviveWorker(id)
      message.success(`${id} đã đăng ký lại`)
    } catch (e) {
      message.info(e.message)
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Giám sát cụm Judge Worker</h1>
          <p>Trạng thái sống còn qua Heartbeat (PING/PONG 5s, timeout 15s), hàng đợi FIFO và nhật ký điều phối của Master.</p>
        </div>
      </div>

      {overview.loading && <Spin style={{ display: 'block', margin: 40 }} />}
      {!overview.loading && (
        <>
          <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
            <Col xs={12} md={6}>
              <Card size="small">
                <Statistic
                  title="Worker hoạt động"
                  value={alive}
                  suffix={`/ ${workers.length}`}
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
                <Statistic title="Hàng đợi FIFO" value={queue.length} prefix={<UnorderedListOutlined />} />
              </Card>
            </Col>
            <Col xs={12} md={6}>
              <Card size="small">
                <Statistic title="Tổng bài nộp" value={base.submissions + (live.newIds?.size || 0)} />
              </Card>
            </Col>
          </Row>

          <Row gutter={[16, 16]}>
            {workers.map((w) => (
              <Col xs={24} md={12} xl={8} key={w.id}>
                <WorkerCard w={w} now={now} onKill={kill} onRevive={revive} />
              </Col>
            ))}
          </Row>

          <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
            <Col xs={24} lg={10}>
              <Card title="Hàng đợi FIFO" extra={<Typography.Text type="secondary">Least-Busy scheduling</Typography.Text>}>
                {queue.length ? (
                  <Table
                    size="small"
                    rowKey="id"
                    pagination={false}
                    dataSource={queue.map((id, i) => ({ id, pos: i + 1 }))}
                    columns={[
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
                    ]}
                  />
                ) : (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Hàng đợi trống" />
                )}
              </Card>
            </Col>
            <Col xs={24} lg={14}>
              <Card title="Nhật ký Master" extra={<Badge status="processing" text="Live" />}>
                <div className="log-list">
                  {logs.map((l) => (
                    <div className="log-row" key={l.id}>
                      <time>{formatClock(l.time)}</time>
                      <span style={{ color: LOG_COLOR[l.level] }}>{l.message}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </Col>
          </Row>
        </>
      )}
    </div>
  )
}
