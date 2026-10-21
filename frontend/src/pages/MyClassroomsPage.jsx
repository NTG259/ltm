import { Card, Empty, Table, Tag, Typography } from 'antd'
import { TeamOutlined } from '@ant-design/icons'
import { api } from '../api'
import { useFetch } from '../lib/hooks'

export default function MyClassroomsPage() {
  const { data: classrooms, loading } = useFetch(() => api.listClassrooms(), [])

  if (!loading && (!classrooms || classrooms.length === 0)) {
    return (
      <div style={{ maxWidth: 600, margin: '80px auto', textAlign: 'center' }}>
        <Empty
          image={<TeamOutlined style={{ fontSize: 48, color: 'var(--text-2)' }} />}
          imageStyle={{ height: 60 }}
          description={
            <Typography.Text type="secondary">
              Bạn chưa được xếp vào lớp học nào.
              <br />Vui lòng liên hệ giảng viên để được thêm vào lớp.
            </Typography.Text>
          }
        />
      </div>
    )
  }

  const columns = [
    { title: 'Tên lớp', dataIndex: 'name', key: 'name' },
    { title: 'Kỳ học', dataIndex: 'semester', key: 'semester', render: (v) => v ? <Tag>{v}</Tag> : '—' },
    { title: 'Ngày tạo', dataIndex: 'createdAt', key: 'createdAt', render: (v) => new Date(v).toLocaleDateString('vi-VN') },
  ]

  return (
    <div style={{ maxWidth: 800, margin: '32px auto', padding: '0 16px' }}>
      <Typography.Title level={3}>Lớp học của tôi</Typography.Title>
      <Card>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={classrooms || []}
          loading={loading}
          pagination={false}
        />
      </Card>
    </div>
  )
}
