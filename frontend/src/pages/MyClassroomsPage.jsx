import { Button, Card, Empty, Space, Table, Tag, Typography } from 'antd'
import { ArrowRightOutlined } from '@ant-design/icons'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { useFetch } from '../lib/hooks'

export default function MyClassroomsPage() {
  const { data: classrooms, loading } = useFetch(() => api.listClassrooms(), [])

  if (!loading && (!classrooms || classrooms.length === 0)) {
    return (
      <div style={{ maxWidth: 600, margin: '80px auto', textAlign: 'center' }}>
        <Empty
          description={
            <Typography.Text type="secondary">
              Bạn chưa có lớp học. Liên hệ giảng viên để được thêm vào lớp.
            </Typography.Text>
          }
        />
      </div>
    )
  }

  const columns = [
    {
      title: 'Tên lớp',
      dataIndex: 'name',
      render: (name, r) => (
        <Link to={`/classrooms/${r.id}`} style={{ fontWeight: 600 }}>
          {name}
        </Link>
      ),
    },
    {
      title: 'Kỳ học',
      dataIndex: 'semester',
      render: (v) => v ? <Tag>{v}</Tag> : '—',
    },
    {
      title: 'Ngày tạo',
      dataIndex: 'createdAt',
      render: (v) => new Date(v).toLocaleDateString('vi-VN'),
    },
    {
      title: '',
      width: 130,
      render: (_, r) => (
        <Link to={`/classrooms/${r.id}`}>
          <Button type="primary" size="small" icon={<ArrowRightOutlined />}>Vào lớp học</Button>
        </Link>
      ),
    },
  ]

  return (
    <div style={{ maxWidth: 800, margin: '32px auto', padding: '0 16px' }}>
      <Typography.Title level={3}>Lớp học của tôi</Typography.Title>
      <Card>
        <Space direction="vertical" style={{ width: '100%' }} size={0}>
          <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
            Bấm vào lớp học để xem bài giảng, tài liệu khóa học và các kỳ thi của lớp.
          </Typography.Text>
          <Table
            rowKey="id"
            columns={columns}
            dataSource={classrooms || []}
            loading={loading}
            pagination={false}
          />
        </Space>
      </Card>
    </div>
  )
}
