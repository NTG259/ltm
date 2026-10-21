import { useEffect, useRef, useState } from 'react'
import { Badge, Button, Card, Space, Statistic, Table, Tag, Tooltip, Typography } from 'antd'
import { ArrowLeftOutlined, ReloadOutlined, TrophyOutlined } from '@ant-design/icons'
import { Link, useParams } from 'react-router-dom'
import { api } from '../../api'
import { useSocket } from '../../lib/hooks'

const VERDICT_COLOR = {
  AC: 'success',
  WA: 'error',
  TLE: 'warning',
  MLE: 'warning',
  RTE: 'error',
  CE: 'default',
  SEC: 'magenta',
}

function ProblemCell({ cell }) {
  if (!cell || cell.verdict === null) return <span style={{ color: 'var(--text-2)' }}>—</span>
  if (cell.verdict === 'AC') {
    const mins = cell.acAt
      ? Math.round((new Date(cell.acAt) - 0) / 60000 - new Date(cell.acAt).getTimezoneOffset())
      : null
    return (
      <Tooltip title={cell.acAt ? new Date(cell.acAt).toLocaleTimeString('vi-VN') : ''}>
        <Tag color="success">✓ {cell.attempts}</Tag>
      </Tooltip>
    )
  }
  return (
    <Tooltip title={`${cell.attempts} lần`}>
      <Tag color={VERDICT_COLOR[cell.verdict] || 'default'}>{cell.verdict}</Tag>
    </Tooltip>
  )
}

export default function AdminContestMonitorPage() {
  const { cid, kid } = useParams()
  const [rows, setRows] = useState(null)
  const [labels, setLabels] = useState([])
  const [loading, setLoading] = useState(true)
  const studentIdsRef = useRef(new Set())
  const [lastRefresh, setLastRefresh] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const data = await api.getContestMonitor(cid, kid)
      setRows(data)
      studentIdsRef.current = new Set(data.map((r) => r.userId))
      if (data.length > 0 && data[0].problems?.length > 0) {
        setLabels(data[0].problems.map((p) => p.label))
      }
      setLastRefresh(new Date())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [cid, kid])

  // Polling 10s fallback
  useEffect(() => {
    const t = setInterval(load, 10000)
    return () => clearInterval(t)
  }, [cid, kid])

  // Realtime: khi có bài được chấm, reload nếu thuộc lớp này
  useSocket((msg) => {
    if (msg.type === 'SUBMISSION_UPDATE') {
      const userId = msg.submission?.userId ?? msg.submission?.user?.id
      if (userId && studentIdsRef.current.has(userId)) {
        load()
      }
    }
    if (msg.type === 'PRESENCE_UPDATE' && studentIdsRef.current.has(msg.userId)) {
      setRows((prev) =>
        prev
          ? prev.map((r) =>
              r.userId === msg.userId ? { ...r, online: msg.status === 'ONLINE' } : r
            )
          : prev
      )
    }
  })

  const data = rows ?? []
  const acLeader = data.length ? Math.max(...data.map((r) => r.acCount)) : 0

  const baseColumns = [
    {
      title: 'MSSV',
      dataIndex: 'username',
      key: 'username',
      width: 130,
      className: 'mono',
      render: (v, r) => (
        <Space size={4}>
          <Badge status={r.online ? 'success' : 'default'} />
          {v}
        </Space>
      ),
    },
    { title: 'Họ tên', dataIndex: 'fullName', key: 'fullName', ellipsis: true },
    {
      title: 'AC',
      dataIndex: 'acCount',
      key: 'acCount',
      width: 70,
      sorter: (a, b) => b.acCount - a.acCount || a.penaltyMinutes - b.penaltyMinutes,
      defaultSortOrder: 'ascend',
      render: (v) => (
        <Typography.Text strong style={{ color: v > 0 ? '#22c55e' : undefined }}>
          {v}
        </Typography.Text>
      ),
    },
    {
      title: 'Nộp',
      dataIndex: 'totalSubmissions',
      key: 'totalSubmissions',
      width: 65,
    },
    {
      title: 'Phạt',
      dataIndex: 'penaltyMinutes',
      key: 'penaltyMinutes',
      width: 75,
      sorter: (a, b) => a.penaltyMinutes - b.penaltyMinutes,
      render: (v) => (v > 0 ? `${v}'` : '—'),
    },
    {
      title: 'Lần cuối',
      dataIndex: 'lastSubmitAt',
      key: 'lastSubmitAt',
      width: 90,
      render: (v) =>
        v ? (
          <Tooltip title={new Date(v).toLocaleString('vi-VN')}>
            <span style={{ fontSize: 12 }}>{new Date(v).toLocaleTimeString('vi-VN')}</span>
          </Tooltip>
        ) : (
          '—'
        ),
    },
  ]

  const problemColumns = labels.map((label) => ({
    title: label,
    key: `prob_${label}`,
    width: 70,
    align: 'center',
    render: (_, row) => {
      const cell = row.problems?.find((p) => p.label === label)
      return <ProblemCell cell={cell} />
    },
  }))

  const columns = [...baseColumns, ...problemColumns]

  return (
    <div style={{ maxWidth: 1200, margin: '32px auto', padding: '0 16px' }}>
      <Space style={{ marginBottom: 16 }}>
        <Link to={`/admin/classrooms/${cid}`}>
          <Button icon={<ArrowLeftOutlined />}>Chi tiết lớp</Button>
        </Link>
        <Typography.Title level={3} style={{ margin: 0 }}>
          <TrophyOutlined style={{ marginRight: 8 }} />
          Giám sát kỳ thi
        </Typography.Title>
        <Button icon={<ReloadOutlined />} onClick={load} loading={loading} size="small">
          Làm mới
        </Button>
        {lastRefresh && (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Cập nhật lúc {lastRefresh.toLocaleTimeString('vi-VN')}
          </Typography.Text>
        )}
      </Space>

      <Card style={{ marginBottom: 16 }}>
        <Space size={48}>
          <Statistic title="Sinh viên" value={data.length} />
          <Statistic
            title="Đang online"
            value={data.filter((r) => r.online).length}
            valueStyle={{ color: '#22c55e' }}
          />
          <Statistic title="Bài AC cao nhất" value={acLeader} />
        </Space>
      </Card>

      <Card>
        <Table
          rowKey="userId"
          columns={columns}
          dataSource={data}
          loading={loading && !rows}
          pagination={{ pageSize: 30 }}
          size="small"
          scroll={{ x: 'max-content' }}
          locale={{ emptyText: 'Chưa có dữ liệu' }}
        />
      </Card>
    </div>
  )
}
