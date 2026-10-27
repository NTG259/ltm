import { useCallback, useMemo, useState } from 'react'
import { App, Col, Row, Spin } from 'antd'
import { api } from '../../api'
import AdminPageHeader from '../../components/admin/AdminPageHeader'
import {
  ClusterSummary,
  MasterLogPanel,
  QueuePanel,
  WorkerCard,
} from '../../components/admin/JudgeClusterPanels'
import { useFetch, useNow, useSocket } from '../../lib/hooks'

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
  const logs = useMemo(
    () => (live.logs ? [...live.logs, ...base.logs.filter((entry) => !live.logs.some((item) => item.id === entry.id))] : base.logs),
    [base.logs, live.logs],
  )
  const queue = live.queue || base.queue
  const alive = workers.filter((w) => w.status !== 'DEAD').length
  const busy = workers.filter((w) => w.status === 'BUSY').length

  const kill = useCallback(async (id) => {
    await api.killWorker(id)
    message.warning(`${id} đã bị ngắt – Master kích hoạt Failover`)
  }, [message])
  const revive = useCallback(async (id) => {
    try {
      await api.reviveWorker(id)
      message.success(`${id} đã đăng ký lại`)
    } catch (e) {
      message.info(e.message)
    }
  }, [message])

  return (
    <div className="page">
      <AdminPageHeader
        title="Giám sát cụm Judge Worker"
        description="Trạng thái sống còn qua Heartbeat (PING/PONG 5s, timeout 15s), hàng đợi FIFO và nhật ký điều phối của Master."
      />

      {overview.loading && <Spin style={{ display: 'block', margin: 40 }} />}
      {!overview.loading && (
        <>
          <ClusterSummary
            alive={alive}
            busy={busy}
            workerCount={workers.length}
            queueCount={queue.length}
            submissionCount={base.submissions + (live.newIds?.size || 0)}
          />

          <Row gutter={[16, 16]}>
            {workers.map((w) => (
              <Col xs={24} md={12} xl={8} key={w.id}>
                <WorkerCard worker={w} now={now} onKill={kill} onRevive={revive} />
              </Col>
            ))}
          </Row>

          <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
            <Col xs={24} lg={10}>
              <QueuePanel queue={queue} />
            </Col>
            <Col xs={24} lg={14}>
              <MasterLogPanel logs={logs} />
            </Col>
          </Row>
        </>
      )}
    </div>
  )
}
