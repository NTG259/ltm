import { useCallback, useMemo, useState } from 'react'
import { Alert, Badge, Button, Card, Col, Empty, Row, Spin, Statistic, Typography } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import { Link } from 'react-router-dom'
import { api } from '../../api'
import { useAuth } from '../../auth/context'
import AdminPageHeader from '../../components/admin/AdminPageHeader'
import { AdminOverviewAnalytics, AdminOverviewActivity } from '../../components/admin/AdminOverviewPanels'
import { ClusterSummary } from '../../components/admin/JudgeClusterPanels'
import { useFetch, useSocket, useSocketStatus } from '../../lib/hooks'

export default function AdminOverviewPage() {
  const { user } = useAuth()
  const overview = useFetch(() => api.adminOverview(), [])
  // The real endpoint returns at most 100 rows by default. Analytics below describe this sample only.
  const submissions = useFetch(() => api.listSubmissions(), [])
  const contests = useFetch(() => api.listContests(user), [user])
  const { reload: reloadContests } = contests
  const socketStatus = useSocketStatus()
  const [live, setLive] = useState({})
  const [submissionUpdates, setSubmissionUpdates] = useState({})

  useSocket(useCallback((msg) => {
    if (msg.type === 'WORKER_UPDATE') {
      setLive((current) => ({
        ...current,
        workers: Array.isArray(msg.workers) ? msg.workers : current.workers,
        queue: Array.isArray(msg.queue) ? msg.queue : current.queue,
      }))
    }
    if (msg.type === 'LOG' && msg.entry) {
      setLive((current) => ({ ...current, logs: [msg.entry, ...(current.logs || [])].slice(0, 20) }))
    }
    if (msg.type === 'SUBMISSION_UPDATE' && msg.submission?.id != null) {
      const sub = msg.submission
      // Keep only the fields used by this page; the full payload may contain source code and tests.
      setSubmissionUpdates((current) => {
        const next = {
          ...current,
          [sub.id]: {
          id: sub.id,
          status: sub.status,
          verdict: sub.verdict,
          createdAt: sub.createdAt,
          userName: sub.userName,
          userId: sub.userId,
          problemTitle: sub.problemTitle,
          problemId: sub.problemId,
          },
        }
        const ids = Object.keys(next)
        if (ids.length > 100) delete next[ids[0]]
        return next
      })
    }
    if (msg.type === 'CONTEST_UPDATE') reloadContests()
  }, [reloadContests]))

  const workers = live.workers || overview.data?.workers
  const queue = live.queue || overview.data?.queue
  const logs = useMemo(() => {
    const initial = overview.data?.logs || []
    const updates = live.logs || []
    const ids = new Set(updates.map((entry) => entry.id))
    return [...updates, ...initial.filter((entry) => !ids.has(entry.id))]
  }, [overview.data?.logs, live.logs])
  const recent = useMemo(() => {
    if (!Array.isArray(submissions.data)) return null
    const byId = new Map(submissions.data.map((sub) => [sub.id, sub]))
    Object.values(submissionUpdates).forEach((sub) => {
      byId.set(sub.id, { ...byId.get(sub.id), ...Object.fromEntries(Object.entries(sub).filter(([, value]) => value !== undefined)) })
    })
    return [...byId.values()].sort((a, b) => b.createdAt - a.createdAt).slice(0, 100)
  }, [submissions.data, submissionUpdates])
  const online = workers?.filter((worker) => worker.status !== 'DEAD').length
  const busy = workers?.filter((worker) => worker.status === 'BUSY').length
  const processing = recent?.filter((sub) => ['COMPILING', 'TESTING'].includes(sub.status)).length
  const activeContests = contests.data?.filter((contest) => contest.status === 'RUNNING').length
  const total = overview.data?.submissions
  const connection = socketStatus === 'open' ? { status: 'success', text: 'Đã kết nối' }
    : socketStatus === 'connecting' || socketStatus === 'reconnecting' ? { status: 'warning', text: 'Đang kết nối' }
    : { status: 'error', text: 'Mất kết nối' }
  const warnings = logs.filter((entry) => ['warning', 'error'].includes(entry.level))

  const refresh = () => {
    overview.reload()
    submissions.reload()
    contests.reload()
  }

  return (
    <div className="page admin-overview">
      <AdminPageHeader
        title="Tổng quan hệ thống"
        description="Theo dõi hoạt động chấm bài, bài nộp và tình trạng cụm Judge tại một nơi."
        actions={<Button icon={<ReloadOutlined />} onClick={refresh}>Làm mới</Button>}
      />

      <section aria-labelledby="overview-system-title">
        <div className="admin-overview__section-head">
          <h2 id="overview-system-title">Tình trạng hệ thống</h2>
          <Badge status={connection.status} text={connection.text} />
        </div>
        {overview.error && <Alert type="error" showIcon message="Không tải được trạng thái cụm Judge" description={overview.error.message} className="admin-overview__notice" />}
        {overview.loading && !workers ? <Spin style={{ display: 'block', margin: 32 }} /> : workers && queue ? (
          <>
            <ClusterSummary alive={online} busy={busy} workerCount={workers.length} queueCount={queue.length} submissionCount={total ?? '—'} />
            <Typography.Text type="secondary" className="admin-overview__snapshot-note">Tổng bài nộp là số liệu tại lần tải gần nhất.</Typography.Text>
            <Row gutter={[12, 12]} className="admin-overview__extra-stats">
              <Col xs={24} sm={12} lg={8}><Card size="small"><Statistic title="Bài đang xử lý · trong 100 bài gần nhất" value={processing ?? '—'} /></Card></Col>
              <Col xs={24} sm={12} lg={8}><Card size="small"><Statistic title="Kỳ thi đang diễn ra" value={activeContests ?? '—'} /></Card></Col>
              <Col xs={24} sm={24} lg={8}><Card size="small" className="admin-overview__cluster-card">
                <Typography.Text type="secondary">Cụm Judge</Typography.Text>
                <div className="admin-overview__cluster-state">{workers.length === 0 ? 'Chưa có Worker' : online === 0 ? 'Không có Worker trực tuyến' : `${online}/${workers.length} Worker trực tuyến`}</div>
                <Link to="/admin">Mở giám sát chi tiết →</Link>
              </Card></Col>
            </Row>
          </>
        ) : !overview.error && <Empty description="Chưa có dữ liệu cụm Judge" />}
        {contests.error && <Alert type="warning" showIcon message="Không tải được số kỳ thi đang diễn ra" description={contests.error.message} className="admin-overview__notice" />}
        {submissions.error && <Alert type="warning" showIcon message="Không tải được số bài đang xử lý và phân tích bài nộp" description={submissions.error.message} className="admin-overview__notice" />}
      </section>

      <AdminOverviewAnalytics submissions={recent} loading={submissions.loading} error={submissions.error} />
      <AdminOverviewActivity submissions={recent} logs={logs} warnings={warnings} loading={submissions.loading} error={submissions.error} logsAvailable={Boolean(overview.data)} />

      <section aria-labelledby="overview-actions-title" className="admin-overview__section">
        <div className="admin-overview__section-head"><h2 id="overview-actions-title">Truy cập nhanh</h2></div>
        <div className="admin-overview__actions">
          <Link to="/admin/submissions">Quản lý bài nộp →</Link>
          <Link to="/admin/problems">Quản lý đề bài →</Link>
          <Link to="/admin/contests">Quản lý kỳ thi →</Link>
          <Link to="/admin">Giám sát Judge Worker →</Link>
        </div>
      </section>
    </div>
  )
}
