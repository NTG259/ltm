import { useState } from 'react'
import { Badge, Button, Card, Space, Statistic, Table, Typography } from 'antd'
import { ArrowLeftOutlined, WifiOutlined } from '@ant-design/icons'
import { Link, useParams } from 'react-router-dom'
import { api } from '../../api'
import { useFetch, useSocket } from '../../lib/hooks'

export default function AdminClassroomMonitorPage() {
  const { id } = useParams()
  const { data: initial, loading } = useFetch(() => api.getClassroomPresence(id), [id])
  const [realtimeOverrides, setRealtimeOverrides] = useState({})

  // Lắng nghe PRESENCE_UPDATE realtime
  useSocket((msg) => {
    if (msg.type !== 'PRESENCE_UPDATE') return
    setRealtimeOverrides((prev) => ({
      ...prev,
      [msg.userId]: msg.status === 'ONLINE',
    }))
  })

  const data = (initial || []).map((r) =>
    r.userId in realtimeOverrides ? { ...r, online: realtimeOverrides[r.userId] } : r
  )
  const onlineCount = data.filter((r) => r.online).length

  const columns = [
    {
      title: 'MSSV',
      dataIndex: 'username',
      key: 'username',
      className: 'mono',
      sorter: (a, b) => a.username.localeCompare(b.username),
    },
    { title: 'Họ tên', dataIndex: 'fullName', key: 'fullName' },
    {
      title: 'Trạng thái',
      dataIndex: 'online',
      key: 'online',
      filters: [
        { text: 'Online', value: true },
        { text: 'Offline', value: false },
      ],
      onFilter: (v, r) => r.online === v,
      render: (online) =>
        online ? (
          <Badge status="success" text={<Typography.Text type="success">Online</Typography.Text>} />
        ) : (
          <Badge status="default" text={<Typography.Text type="secondary">Offline</Typography.Text>} />
        ),
    },
  ]

  return (
    <div style={{ maxWidth: 800, margin: '32px auto', padding: '0 16px' }}>
      <Space style={{ marginBottom: 16 }}>
        <Link to={`/admin/classrooms/${id}`}>
          <Button icon={<ArrowLeftOutlined />}>Chi tiết lớp</Button>
        </Link>
        <Typography.Title level={3} style={{ margin: 0 }}>
          <WifiOutlined style={{ marginRight: 8 }} />
          Giám sát Online
        </Typography.Title>
      </Space>

      <Card style={{ marginBottom: 16 }}>
        <Space size={48}>
          <Statistic title="Đang online" value={onlineCount} valueStyle={{ color: '#22c55e' }} />
          <Statistic title="Tổng sinh viên" value={data.length} />
          <Statistic
            title="Tỉ lệ"
            value={data.length ? Math.round((onlineCount / data.length) * 100) : 0}
            suffix="%"
          />
        </Space>
      </Card>

      <Card>
        <Table
          rowKey="userId"
          columns={columns}
          dataSource={data}
          loading={loading && !initial}
          pagination={{ pageSize: 20 }}
          rowClassName={(r) => (r.online ? 'row-online' : '')}
        />
      </Card>
    </div>
  )
}
