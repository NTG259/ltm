import { useEffect, useState } from 'react'
import { Badge, Button, Card, Space, Statistic, Table, Tag, Tooltip, Typography } from 'antd'
import { ArrowLeftOutlined, ReloadOutlined, TrophyOutlined } from '@ant-design/icons'
import { Link, useParams } from 'react-router-dom'
import { api } from '../../api'
import { useFetch, useSocket } from '../../lib/hooks'

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
  const [lastRefresh, setLastRefresh] = useState(null)
  const { data: rawRows, loading, reload } = useFetch(async () => {
    const res = await api.getContestMonitor(cid, kid)
    setLastRefresh(new Date())
    return res
  }, [cid, kid])
  const [presenceOverrides, setPresenceOverrides] = useState({})

  // Polling 10s fallback
  useEffect(() => {
    const t = setInterval(reload, 10000)
    return () => clearInterval(t)
  }, [reload])

  // Realtime: khi có bài được chấm, reload nếu thuộc lớp này
  useSocket((msg) => {
    if (msg.type === 'SUBMISSION_UPDATE') {
      const userId = msg.submission?.userId ?? msg.submission?.user?.id
      if (userId && rawRows?.some((r) => r.userId === userId)) {
        reload()
      }
    }
    if (msg.type === 'PRESENCE_UPDATE') {
      setPresenceOverrides((prev) => ({
        ...prev,
        [msg.userId]: msg.status === 'ONLINE',
      }))
    }
  })

  const rows = (rawRows || []).map((r) =>
    r.userId in presenceOverrides ? { ...r, online: presenceOverrides[r.userId] } : r
  )
  const labels = rawRows?.[0]?.problems?.map((p) => p.label) || []

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
        <Button icon={<ReloadOutlined />} onClick={reload} loading={loading} size="small">
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
          loading={loading && !rawRows}
          pagination={{ pageSize: 30 }}
          size="small"
          scroll={{ x: 'max-content' }}
          locale={{ emptyText: 'Chưa có dữ liệu' }}
        />
      </Card>
    </div>
  )
}
