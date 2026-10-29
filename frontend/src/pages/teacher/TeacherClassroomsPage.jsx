import { Button, Card, Empty, Space, Table, Tag, Typography } from 'antd'
import { PlusOutlined, ArrowRightOutlined } from '@ant-design/icons'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../../api'
import { useFetch } from '../../lib/hooks'

export default function TeacherClassroomsPage() {
  const navigate = useNavigate()
  const { data: classrooms, loading } = useFetch(() => api.listClassrooms(), [])

  const columns = [
    {
      title: 'Tên lớp',
      dataIndex: 'name',
      render: (name, r) => (
        <Link to={`/teacher/classrooms/${r.id}`} style={{ fontWeight: 600 }}>
          {name}
        </Link>
      ),
    },
    {
      title: 'Kỳ học',
      dataIndex: 'semester',
      render: (v) => v ? <Tag color="purple">{v}</Tag> : '—',
    },
    {
      title: 'Ngày tạo',
      dataIndex: 'createdAt',
      render: (v) => new Date(v).toLocaleDateString('vi-VN'),
    },
    {
      title: '',
      width: 120,
      render: (_, r) => (
        <Link to={`/teacher/classrooms/${r.id}`}>
          <Button size="small" icon={<ArrowRightOutlined />}>Quản lý</Button>
        </Link>
      ),
    },
  ]

  return (
    <div style={{ maxWidth: 860, margin: '32px auto', padding: '0 16px' }}>
      <Space style={{ marginBottom: 20, justifyContent: 'space-between', width: '100%' }}>
        <Typography.Title level={3} style={{ margin: 0 }}>Lớp học của tôi</Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/teacher/classrooms/new')}>
          Tạo lớp mới
        </Button>
      </Space>

      {!loading && (!classrooms || classrooms.length === 0) ? (
        <Card>
          <Empty description="Chưa có lớp học nào. Bấm «Tạo lớp mới» để bắt đầu." />
        </Card>
      ) : (
        <Card>
          <Table
            rowKey="id"
            columns={columns}
            dataSource={classrooms || []}
            loading={loading}
            pagination={false}
          />
        </Card>
      )}
    </div>
  )
}
