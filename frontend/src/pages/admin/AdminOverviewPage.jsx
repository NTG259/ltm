import { useCallback, useMemo, useState } from 'react'
import { Alert, Badge, Button, Card, Empty, Spin, Statistic, Typography } from 'antd'
import { Link } from 'react-router-dom'
import { api } from '../../api'
import { useAuth } from '../../auth/context'
import AdminPageHeader from '../../components/admin/AdminPageHeader'
import { AdminOverviewAnalytics } from '../../components/admin/AdminOverviewPanels'
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
  const refresh = () => {
    overview.reload()
    submissions.reload()
    contests.reload()
  }

  return (
    <div className="page admin-overview admin-overview--single-screen">
      <AdminPageHeader
        eyebrow="Điều hành hệ thống"
        title="Bảng điều hành"
        actions={<Button onClick={refresh}>Cập nhật dữ liệu</Button>}
      />

      <section aria-labelledby="overview-system-title">
        <div className="admin-overview__section-head">
          <div>
            <h2 id="overview-system-title">Vận hành hiện tại</h2>
          </div>
          <Badge status={connection.status} text={connection.text} />
        </div>
        {overview.error && <Alert type="error" showIcon message="Không tải được trạng thái cụm Judge" description={overview.error.message} className="admin-overview__notice" />}
        {overview.loading && !workers ? <Spin style={{ display: 'block', margin: 32 }} /> : workers && queue ? (
          <div className="admin-overview__operations">
            <div className="admin-overview__metrics">
              <Card size="small"><Statistic title="Worker hoạt động" value={online} suffix={`/ ${workers.length}`} /></Card>
              <Card size="small"><Statistic title="Bài đang tồn đọng" value={queue.length} /></Card>
              <Card size="small"><Statistic title="Đang xử lý" value={processing ?? '—'} /></Card>
              <Card size="small"><Statistic title="Tổng bài nộp" value={total ?? '—'} /></Card>
            </div>
            <div className="admin-overview__operation-note">
              <div>
                <strong>{workers.length === 0 ? 'Chưa có Worker' : online === 0 ? 'Cụm Judge đang ngoại tuyến' : `${online}/${workers.length} Worker trực tuyến`}</strong>
                <span>{busy || 0} worker đang chấm · {activeContests ?? '—'} kỳ thi đang diễn ra</span>
              </div>
              <Link to="/admin">Mở giám sát máy chấm</Link>
            </div>
          </div>
        ) : !overview.error && <Empty description="Chưa có dữ liệu cụm Judge" />}
        {contests.error && <Alert type="warning" showIcon message="Không tải được số kỳ thi đang diễn ra" description={contests.error.message} className="admin-overview__notice" />}
        {submissions.error && <Alert type="warning" showIcon message="Không tải được số bài đang xử lý và phân tích bài nộp" description={submissions.error.message} className="admin-overview__notice" />}
      </section>

      <AdminOverviewAnalytics submissions={recent} loading={submissions.loading} error={submissions.error} />
    </div>
  )
}
