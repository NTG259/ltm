import { useState } from 'react'
import { App, Button, Empty, Spin, Space, Table, Tag, Tabs, Typography } from 'antd'
import {
  ArrowLeftOutlined, TrophyOutlined,
  FilePdfOutlined, PlayCircleOutlined, DownloadOutlined,
} from '@ant-design/icons'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api'
import { useFetch, useNow } from '../lib/hooks'
import { formatDateTime } from '../lib/format'

function phaseTag(c, now) {
  if (now < c.startAt) return <Tag color="blue">Sắp diễn ra</Tag>
  if (now < c.endAt) return <Tag color="green">Đang diễn ra</Tag>
  return <Tag color="default">Đã kết thúc</Tag>
}

function ContestsTab({ classroom, loading }) {
  const now = useNow(30000)
  const contests = classroom?.contests || []

  const columns = [
    {
      title: 'Kỳ thi',
      dataIndex: 'title',
      render: (title, r) => (
        <Link to={`/contests/${r.contestId}`} style={{ fontWeight: 600 }}>
          <TrophyOutlined style={{ marginRight: 6, color: 'var(--primary)' }} />
          {title}
        </Link>
      ),
    },
    { title: 'Bắt đầu', dataIndex: 'startAt', width: 180, render: (v) => formatDateTime(v) },
    { title: 'Kết thúc', dataIndex: 'endAt', width: 180, render: (v) => formatDateTime(v) },
    { title: 'Trạng thái', width: 150, render: (_, r) => phaseTag(r, now) },
    {
      title: '',
      width: 100,
      render: (_, r) => (
        <Link to={`/contests/${r.contestId}`}>
          <Button size="small" type="primary" ghost>Vào thi</Button>
        </Link>
      ),
    },
  ]

  return (
    <div style={{ padding: 20 }}>
      {loading || contests.length === 0 ? (
        <Empty description="Lớp này chưa có kỳ thi nào" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <Table rowKey="contestId" dataSource={contests} columns={columns} pagination={false} size="small" />
      )}
    </div>
  )
}

function CourseTab({ classroomId }) {
  const [selectedUnit, setSelectedUnit] = useState(null)
  const { data: courseData, loading } = useFetch(
    () => api.getClassroomCourse(classroomId).catch(() => null), [classroomId]
  )

  const units = courseData?.units || []
  const activeUnit = selectedUnit != null
    ? units.find((u) => u.id === selectedUnit) ?? units[0]
    : units[0]

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}><Spin /></div>

  if (!courseData) {
    return (
      <div style={{ padding: 40 }}>
        <Empty description="Lớp này chưa có khóa học nào" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      </div>
    )
  }

  return (
    <>
      {/* Course header */}
      <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontWeight: 600 }}>📗 {courseData.title}</span>
        <Tag>{units.length} chương</Tag>
      </div>

      {/* Sidebar + content */}
      <div style={{ display: 'flex', minHeight: 420 }}>
        {/* Sidebar chương */}
        <div style={{ width: 240, flexShrink: 0, borderRight: '1px solid var(--border)', background: 'var(--surface)' }}>
          <div style={{ padding: '10px 14px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--text-2)', borderBottom: '1px solid var(--border)' }}>
            Danh sách chương
          </div>
          {units.map((unit) => (
            <div
              key={unit.id}
              onClick={() => setSelectedUnit(unit.id)}
              style={{
                padding: '10px 14px', fontSize: 13, cursor: 'pointer', lineHeight: 1.4,
                borderLeft: `3px solid ${activeUnit?.id === unit.id ? 'var(--primary)' : 'transparent'}`,
                background: activeUnit?.id === unit.id ? 'var(--primary-bg, #ede9fe)' : 'transparent',
                color: activeUnit?.id === unit.id ? 'var(--primary)' : 'var(--text-2)',
                fontWeight: activeUnit?.id === unit.id ? 600 : 400,
                transition: 'all .15s',
              }}
            >
              {unit.title}
            </div>
          ))}
        </div>

        {/* Nội dung chương */}
        {activeUnit ? (
          <div style={{ flex: 1, padding: 20, overflow: 'auto' }}>
            <Typography.Title level={5} style={{ marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
              {activeUnit.title}
            </Typography.Title>

            {/* Files */}
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--text-2)', marginBottom: 8 }}>
              Tài liệu PDF
            </div>
            <Space direction="vertical" style={{ width: '100%', marginBottom: 20 }}>
              {(activeUnit.files || []).length === 0 ? (
                <div style={{ color: 'var(--text-2)', fontSize: 13, fontStyle: 'italic' }}>Chưa có tài liệu nào</div>
              ) : (activeUnit.files || []).map((f) => (
                <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)' }}>
                  <FilePdfOutlined style={{ fontSize: 18, color: '#ef4444', flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{f.filename}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-2)' }}>
                    {f.fileSize ? (f.fileSize / 1024 / 1024).toFixed(1) + ' MB' : ''}
                  </span>
                  <Button
                    size="small"
                    icon={<DownloadOutlined />}
                    onClick={() => window.open(`/api/courses/units/${activeUnit.id}/files/${f.id}/download`, '_blank')}
                  >
                    Tải về
                  </Button>
                </div>
              ))}
            </Space>

            {/* Problems */}
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--text-2)', marginBottom: 8 }}>
              Bài tập lập trình
            </div>
            {(activeUnit.problems || []).length === 0 ? (
              <div style={{ color: 'var(--text-2)', fontSize: 13, fontStyle: 'italic' }}>Chưa có bài tập nào</div>
            ) : (
              <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                {(activeUnit.problems || []).map((p, i) => (
                  <Link
                    key={p.id}
                    to={`/problems/${p.id}`}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 14px',
                      borderBottom: i < (activeUnit.problems.length - 1) ? '1px solid var(--border)' : 'none',
                      color: 'inherit',
                    }}
                  >
                    <PlayCircleOutlined style={{ color: 'var(--primary)', flexShrink: 0 }} />
                    <span style={{ flex: 1, fontWeight: 500 }}>{p.title}</span>
                    <Tag color={p.difficulty === 'EASY' ? 'green' : p.difficulty === 'MEDIUM' ? 'orange' : 'red'}>
                      {p.difficulty}
                    </Tag>
                  </Link>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Empty description="Chọn chương bên trái để xem nội dung" />
          </div>
        )}
      </div>
    </>
  )
}

export default function MyClassroomDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: classroom, loading } = useFetch(() => api.getClassroom(id), [id])

  const tabItems = [
    { key: 'contests', label: '🏆 Kỳ thi', children: <ContestsTab classroom={classroom} loading={loading} /> },
    { key: 'course', label: '📖 Khóa học', children: <CourseTab classroomId={id} /> },
  ]

  return (
    <App>
      <div style={{ maxWidth: 1000, margin: '32px auto', padding: '0 16px' }}>
        <Button icon={<ArrowLeftOutlined />} style={{ marginBottom: 16 }} onClick={() => navigate('/my-classrooms')}>
          Quay lại
        </Button>

        <Typography.Title level={3} style={{ marginBottom: 4 }}>
          {classroom?.name || '…'}
        </Typography.Title>
        {classroom?.semester && <Tag style={{ marginBottom: 16 }}>{classroom.semester}</Tag>}

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          <Tabs
            items={tabItems}
            defaultActiveKey="contests"
            tabBarStyle={{ margin: 0, padding: '0 16px', background: 'var(--surface)' }}
            renderTabBar={(props, DefaultTabBar) => (
              <div style={{ borderBottom: '1px solid var(--border)' }}>
                <DefaultTabBar {...props} />
              </div>
            )}
          />
        </div>
      </div>
    </App>
  )
}
