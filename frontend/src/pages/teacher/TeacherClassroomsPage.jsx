import { Button, Card, Empty, Space, Table, Tag, Typography } from 'antd'
import { ArrowRightOutlined } from '@ant-design/icons'
import { Link } from 'react-router-dom'
import { api } from '../../api'
import { useFetch } from '../../lib/hooks'

export default function TeacherClassroomsPage() {
  const { data: classrooms, loading } = useFetch(() => api.listClassrooms(), [])
  const columns = [
    { title: 'Tên lớp', dataIndex: 'name', render: (name, row) => <Link to={`/teacher/classrooms/${row.id}`} style={{ fontWeight: 600 }}>{name}</Link> },
    { title: 'Kỳ học', dataIndex: 'semester', render: (value) => value ? <Tag color="purple">{value}</Tag> : '—' },
    { title: 'Ngày tạo', dataIndex: 'createdAt', render: (value) => new Date(value).toLocaleDateString('vi-VN') },
    { title: '', width: 130, render: (_, row) => <Link to={`/teacher/classrooms/${row.id}`}><Button size="small" icon={<ArrowRightOutlined />}>Quản lý</Button></Link> },
  ]

  return (
    <div style={{ maxWidth: 1000, margin: '32px auto', padding: '0 16px' }}>
      <Space direction="vertical" size={2} style={{ marginBottom: 20 }}>
        <Typography.Title level={3} style={{ margin: 0 }}>Lớp học được phân công</Typography.Title>
        <Typography.Text type="secondary">Lớp học do admin tạo và giao cho bạn phụ trách.</Typography.Text>
      </Space>
      {!loading && (!classrooms || classrooms.length === 0) ? (
        <Card><Empty description="Bạn chưa được phân công lớp học nào. Hãy liên hệ admin." /></Card>
      ) : (
        <Card styles={{ body: { padding: 0 } }}>
          <Table rowKey="id" columns={columns} dataSource={classrooms || []} loading={loading} pagination={false} />
        </Card>
      )}
    </div>
  )
}
