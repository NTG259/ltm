import { Card, Empty, Table, Tag, Typography } from 'antd'
import { api } from '../../api'
import { useFetch } from '../../lib/hooks'
import { DIFFICULTIES } from '../../lib/verdicts'

export default function TeacherProblemsPage() {
  const list = useFetch(() => api.teacherListProblems(), [])
  return (
    <div className="page">
      <div style={{ marginBottom: 20 }}>
        <Typography.Title level={3} style={{ margin: 0 }}>Kho đề dùng chung</Typography.Title>
        <Typography.Text type="secondary">Chọn các đề do admin quản lý khi soạn khóa học hoặc kỳ thi. Chỉ admin được tạo và sửa đề.</Typography.Text>
      </div>
      <Card styles={{ body: { padding: 0 } }}>
        <Table rowKey="id" loading={list.loading} dataSource={list.data || []} pagination={{ pageSize: 20 }}
          locale={{ emptyText: <Empty description="Kho đề hiện chưa có bài nào" /> }}
          columns={[
            { title: 'Đề bài', dataIndex: 'title', render: (title, problem) => <><b>#{problem.id} {title}</b><div>{(problem.tags || []).map((tag) => <Tag key={tag}>{tag}</Tag>)}</div></> },
            { title: 'Độ khó', dataIndex: 'difficulty', width: 120, render: (value) => DIFFICULTIES[value]?.label || value },
            { title: 'Lượt nộp', dataIndex: 'totalSubmissions', width: 100 },
          ]}
        />
      </Card>
    </div>
  )
}
