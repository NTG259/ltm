import { useCallback, useMemo, useState } from 'react'
import { App, Button, Popconfirm, Spin } from 'antd'
import { DeleteOutlined } from '@ant-design/icons'
import { api } from '../../api'
import AdminPageHeader from '../../components/admin/AdminPageHeader'
import {
  ClusterSummary,
  ConnectionLogPanel,
  MachineTable,
} from '../../components/admin/JudgeClusterPanels'
import { useFetch, useNow, useSocket } from '../../lib/hooks'

export default function AdminDashboardPage() {
  const now = useNow(1000)
  const { message } = App.useApp()
  const overview = useFetch(() => api.adminOverview(), [])
  const [live, setLive] = useState({})
  const [workerAction, setWorkerAction] = useState(null)

  useSocket(
    useCallback((msg) => {
      if (msg.type === 'WORKER_UPDATE') setLive((l) => ({ ...l, workers: msg.workers, queue: msg.queue }))
      if (msg.type === 'LOG') setLive((l) => ({ ...l, logs: [msg.entry, ...(l.logs || [])].slice(0, 200) }))
      if (msg.type === 'SUBMISSION_UPDATE' && msg.submission.status === 'IN_QUEUE' && msg.submission.attempts === 0)
        setLive((l) => ({ ...l, newIds: new Set(l.newIds).add(msg.submission.id) }))
    }, []),
  )

  const [logLevel, setLogLevel] = useState('')

  const base = overview.data || { workers: [], queue: [], logs: [], submissions: 0, throughput: [] }
  const workers = live.workers || base.workers
  const disconnectedCount = workers.filter((w) => w.status === 'DEAD').length
  const logs = useMemo(
    () => (live.logs ? [...live.logs, ...base.logs.filter((entry) => !live.logs.some((item) => item.id === entry.id))] : base.logs),
    [base.logs, live.logs],
  )
  const queue = live.queue || base.queue
  const alive = workers.filter((w) => w.status !== 'DEAD').length
  const busy = workers.filter((w) => w.status === 'BUSY').length

  const controlWorker = useCallback(async (id, action) => {
    setWorkerAction({ id, action })
    try {
      await api.controlWorker(id, action)
      const labels = { START: 'khởi động', STOP: 'dừng', RESTART: 'khởi động lại' }
      message.success(`Đã gửi yêu cầu ${labels[action]} máy chấm ${id}`)
    } catch (e) {
      message.error(e.message || 'Không thể điều khiển máy chấm')
    } finally {
      setWorkerAction(null)
    }
  }, [message])
  const removeDisconnected = useCallback(async () => {
    try {
      const result = await api.removeDisconnectedWorkers()
      overview.setData((current) => current && ({ ...current, workers: current.workers.filter((w) => w.status !== 'DEAD') }))
      setLive((current) => current.workers ? ({ ...current, workers: current.workers.filter((w) => w.status !== 'DEAD') }) : current)
      message.success(`Đã xóa ${result.removed} worker đã ngắt kết nối`)
    } catch (e) {
      message.error(e.message || 'Không thể xóa worker đã ngắt kết nối')
    }
  }, [message, overview])

  return (
    <div className="page judge-monitor">
      <AdminPageHeader
        eyebrow="Vận hành hệ thống chấm"
        title="Giám sát máy chấm"
        actions={disconnectedCount > 0 ? (
          <Popconfirm
            title={`Xóa ${disconnectedCount} máy chấm đã ngắt kết nối?`}
            description="Các máy chấm đang hoạt động sẽ được giữ lại."
            okText="Xóa máy đã dừng"
            cancelText="Hủy"
            okButtonProps={{ danger: true }}
            onConfirm={removeDisconnected}
          >
            <Button danger icon={<DeleteOutlined />}>Dọn máy đã dừng ({disconnectedCount})</Button>
          </Popconfirm>
        ) : null}
      />

      {overview.loading && <Spin style={{ display: 'block', margin: 40 }} />}
      {!overview.loading && (
        <div className="judge-monitor__content">
          <ClusterSummary
            alive={alive}
            busy={busy}
            workerCount={workers.length}
            queueCount={queue.length}
            submissionCount={base.submissions + (live.newIds?.size || 0)}
          />

          <div className="judge-monitor__workspace">
            <MachineTable
              workers={workers}
              now={now}
              onControl={controlWorker}
              pendingAction={workerAction}
            />
          </div>

          <ConnectionLogPanel logs={logs} levelFilter={logLevel} onLevelChange={setLogLevel} />
        </div>
      )}
    </div>
  )
}
