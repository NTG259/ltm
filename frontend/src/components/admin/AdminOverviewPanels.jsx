import { Card, Col, Empty, Progress, Row, Skeleton, Tag, Typography } from 'antd'
import { Link } from 'react-router-dom'
import { formatDateTime } from '../../lib/format'
import { VERDICTS } from '../../lib/verdicts'
import VerdictTag from '../VerdictTag'

const VERDICT_ORDER = ['AC', 'WA', 'TLE', 'RTE', 'CE', 'MLE', 'SEC']
const VERDICT_COLOR = {
  AC: 'var(--ac-fg)', WA: 'var(--wa-fg)', TLE: 'var(--tle-fg)',
  RTE: 'var(--rte-fg)', CE: 'var(--ce-fg)', MLE: 'var(--mle-fg)', SEC: 'var(--sec-fg)',
}

function dayKey(value) {
  const date = new Date(value)
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

export function AdminOverviewAnalytics({ submissions, loading, error }) {
  const finished = submissions?.filter((sub) => sub.status === 'FINISHED') || []
  const counts = Object.fromEntries(VERDICT_ORDER.map((verdict) => [verdict, finished.filter((sub) => sub.verdict === verdict).length]))
  const max = Math.max(1, ...Object.values(counts))
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date()
    date.setHours(0, 0, 0, 0)
    date.setDate(date.getDate() - 6 + index)
    return { key: dayKey(date), label: date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }) }
  })
  const volume = days.map((day) => ({
    ...day,
    count: submissions?.filter((sub) => sub.createdAt && dayKey(sub.createdAt) === day.key).length || 0,
  }))
  const volumeMax = Math.max(1, ...volume.map((day) => day.count))

  return (
    <section aria-labelledby="overview-analytics-title" className="admin-overview__section">
      <div className="admin-overview__section-head">
        <div><h2 id="overview-analytics-title">Phân tích bài nộp</h2><Typography.Text type="secondary">Mẫu tối đa 100 bài nộp gần nhất · không phải số liệu toàn hệ thống</Typography.Text></div>
        <Link to="/admin/submissions">Xem tất cả →</Link>
      </div>
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="Hoạt động 7 ngày gần đây" className="admin-overview__panel">
            {loading && !submissions ? <Skeleton active paragraph={{ rows: 5 }} /> : submissions?.length ? (
              <div className="admin-overview__trend" role="img" aria-label={`Số bài nộp từng ngày: ${volume.map((day) => `${day.label}: ${day.count}`).join(', ')}`}>
                {volume.map((day) => (
                  <div className="admin-overview__trend-day" key={day.key} title={`${day.label}: ${day.count} bài`}>
                    <strong>{day.count}</strong>
                    <div className="admin-overview__trend-track"><div style={{ height: `${(day.count / volumeMax) * 100}%` }} /></div>
                    <span>{day.label}</span>
                  </div>
                ))}
              </div>
            ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={error ? 'Không tải được dữ liệu' : 'Chưa có bài nộp để phân tích'} />}
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Phân bố kết quả chấm" className="admin-overview__panel">
            {loading && !submissions ? <Skeleton active paragraph={{ rows: 5 }} /> : finished.length ? (
              <div className="admin-overview__verdicts">
                {VERDICT_ORDER.map((verdict) => (
                  <div className="admin-overview__verdict-row" key={verdict}>
                    <span title={VERDICTS[verdict].label}>{verdict}</span>
                    <Progress percent={Math.round((counts[verdict] / max) * 100)} showInfo={false} strokeColor={VERDICT_COLOR[verdict]} />
                    <strong>{counts[verdict]}</strong>
                  </div>
                ))}
              </div>
            ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={error ? 'Không tải được dữ liệu' : 'Chưa có kết quả chấm trong mẫu'} />}
          </Card>
        </Col>
      </Row>
    </section>
  )
}

export function AdminOverviewActivity({ submissions, logs, warnings, loading, error, logsAvailable }) {
  return (
    <section aria-labelledby="overview-activity-title" className="admin-overview__section">
      <div className="admin-overview__section-head"><h2 id="overview-activity-title">Hoạt động gần đây</h2></div>
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <Card title="Bài nộp mới nhất" extra={<Link to="/admin/submissions">Mở danh sách →</Link>} className="admin-overview__panel">
            {loading && !submissions ? <Skeleton active paragraph={{ rows: 4 }} /> : submissions?.length ? (
              <div className="admin-overview__list">
                {submissions.slice(0, 5).map((sub) => (
                  <div className="admin-overview__activity-row" key={sub.id}>
                    <div>
                      <Link to={`/submissions/${sub.id}`} className="mono">#{sub.id}</Link>
                      <span> · {sub.problemTitle || `Bài #${sub.problemId ?? '—'}`}</span>
                      <div className="muted">{sub.userName || sub.userId || 'Không rõ thí sinh'} · {sub.createdAt ? formatDateTime(sub.createdAt) : 'Chưa có thời gian'}</div>
                    </div>
                    {sub.status === 'FINISHED' && sub.verdict ? <VerdictTag verdict={sub.verdict} /> : <Tag color="processing">{sub.status === 'IN_QUEUE' ? 'Đang chờ' : 'Đang chấm'}</Tag>}
                  </div>
                ))}
              </div>
            ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={error ? 'Không tải được dữ liệu' : 'Chưa có bài nộp gần đây'} />}
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card title="Nhật ký Master & cảnh báo" className="admin-overview__panel">
            {!logsAvailable ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có dữ liệu nhật ký" /> : logs.length ? (
              <>
              <Typography.Text type="secondary">{warnings.length ? `${warnings.length} cảnh báo trong nhật ký đã tải` : 'Không có cảnh báo trong nhật ký đã tải'}</Typography.Text>
              <div className="admin-overview__list">
                {logs.slice(0, 5).map((entry) => (
                  <div className="admin-overview__log-row" key={entry.id}>
                    <Tag color={entry.level === 'error' ? 'error' : entry.level === 'warning' ? 'warning' : entry.level === 'success' ? 'success' : 'default'}>{entry.level === 'error' ? 'Lỗi' : entry.level === 'warning' ? 'Cảnh báo' : 'Thông tin'}</Tag>
                    <div><div>{entry.message}</div><span className="muted">{formatDateTime(entry.time)}</span></div>
                  </div>
                ))}
              </div>
              </>
            ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có sự kiện trong nhật ký" />}
            {logsAvailable && <Typography.Text type="secondary" className="admin-overview__log-note">{logs.length} mục nhật ký đã tải · <Link to="/admin">Xem nhật ký Master</Link></Typography.Text>}
          </Card>
        </Col>
      </Row>
    </section>
  )
}
