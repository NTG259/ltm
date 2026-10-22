import { useEffect, useMemo } from 'react'
import {
  Alert,
  App,
  Breadcrumb,
  Button,
  Card,
  Empty,
  List,
  Progress,
  Space,
  Tag,
  Typography,
} from 'antd'
import {
  ArrowLeftOutlined,
  CheckCircleFilled,
  ReadOutlined,
  RocketOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../../api'
import { useAuth } from '../../auth/context'
import { useFetch } from '../../lib/hooks'
import { useThemeMode } from '../../theme'

export default function CourseDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { message } = App.useApp()
  const { isAdmin } = useAuth()
  const { mode } = useThemeMode()
  const isDark = mode === 'dark'
  const { data: course, loading } = useFetch(() => api.getCourse(id), [id])
  const { data: progress, reload: reloadProgress } = useFetch(() => api.getCourseProgress(id), [id])

  // Cache tiến độ vào localStorage để hiển thị tức thì không bị chớp 0%
  const cacheKey = `cj.cache_progress_${id}`
  const cachedProgress = useMemo(() => {
    try {
      const raw = localStorage.getItem(cacheKey)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  }, [cacheKey])

  // Ưu tiên dữ liệu mới nhất: progress API riêng -> course.progress đi kèm -> cached progress
  const activeProgress = progress || course?.progress || cachedProgress

  // Lưu lại cache khi có dữ liệu mới từ server
  useEffect(() => {
    const p = progress || course?.progress
    if (p) {
      try {
        localStorage.setItem(cacheKey, JSON.stringify(p))
      } catch {
        /* bỏ qua khi trình duyệt chặn storage */
      }
    }
  }, [progress, course?.progress, cacheKey])

  const toggleComplete = async (unitId) => {
    try {
      await api.toggleUnitProgress(unitId)
      message.success('Đã cập nhật tiến độ học tập!')
      reloadProgress()
    } catch (e) {
      message.error(e.message || 'Lỗi khi cập nhật tiến độ')
    }
  }

  const units = course?.units ? [...course.units].sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0)) : []
  const completedSet = new Set(activeProgress?.completedUnitIds || [])
  const completedCount = activeProgress?.completedCount ?? 0
  const progressPercent = activeProgress?.percent ?? 0

  return (
    <div className="page">
      <div style={{ marginBottom: 16 }}>
        <Breadcrumb
          items={[
            { title: <Link to="/courses">Khóa học</Link> },
            { title: course?.title || 'Chi tiết khóa học' },
          ]}
        />
      </div>

      <div className="page-head">
        <Space size={12} align="center">
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/courses')}>
            Danh sách khóa học
          </Button>
          <h1 style={{ margin: 0 }}>{course?.title || 'Khóa học C++'}</h1>
        </Space>

        {units.length > 0 && (isAdmin || course?.published) && (
          <Button
            type="primary"
            icon={<RocketOutlined />}
            size="large"
            onClick={() => navigate(`/courses/${id}/learn`)}
          >
            {completedCount === 0 ? 'Bắt đầu học ngay' : 'Tiếp tục bài học'}
          </Button>
        )}
      </div>

      {loading ? (
        <Card loading />
      ) : !course ? (
        <Alert
          type="error"
          message="Không tìm thấy khóa học"
          description="Khóa học này có thể đã bị xóa hoặc không tồn tại."
          showIcon
        />
      ) : !course.published && !isAdmin ? (
        <Card style={{ textAlign: 'center', padding: '60px 20px', borderRadius: 16 }}>
          <Empty
            description={
              <div>
                <Typography.Title level={4} style={{ marginBottom: 8 }}>
                  Khóa học đang ở trạng thái bản nháp
                </Typography.Title>
                <Typography.Text type="secondary">
                  Nội dung khóa học này hiện đang được biên soạn và chưa được công khai cho sinh viên.
                </Typography.Text>
              </div>
            }
          >
            <Button type="primary" onClick={() => navigate('/courses')} style={{ marginTop: 16 }}>
              Quay lại danh sách khóa học
            </Button>
          </Empty>
        </Card>
      ) : (
        <>
          {/* Hero Banner thích ứng theo theme: sáng sủa, đồng điệu ở Light theme và obsidian sắc nét ở Dark theme */}
          <div
            className="course-hero-banner"
            style={{
              marginBottom: 24,
              borderRadius: 16,
              background: isDark
                ? 'linear-gradient(135deg, #0c1120 0%, #161f38 100%)'
                : 'linear-gradient(135deg, #ffffff 0%, #eef2ff 100%)',
              color: isDark ? '#ffffff' : 'var(--text)',
              padding: '28px 32px',
              border: isDark ? '1px solid rgba(99, 102, 241, 0.25)' : '1px solid #c7d2fe',
              boxShadow: isDark
                ? '0 8px 28px rgba(0, 0, 0, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
                : '0 4px 20px -2px rgba(79, 70, 229, 0.08), 0 2px 6px -1px rgba(0, 0, 0, 0.04)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 20 }}>
              <div style={{ flex: 1, minWidth: 280 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
                  <span
                    style={{
                      display: 'inline-block',
                      fontWeight: 700,
                      fontSize: 11,
                      letterSpacing: '0.05em',
                      padding: '3px 10px',
                      borderRadius: 6,
                      background: isDark ? 'rgba(99, 102, 241, 0.15)' : '#eef2ff',
                      color: isDark ? '#a5b4fc' : '#4338ca',
                      border: isDark ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid #c7d2fe',
                    }}
                  >
                    LỘ TRÌNH ĐÀO TẠO
                  </span>
                  {!course.published && (
                    <Tag color="warning" style={{ margin: 0, fontWeight: 600 }}>
                      Bản nháp (Xem trước Admin)
                    </Tag>
                  )}
                </div>
                <Typography.Title
                  level={2}
                  style={{
                    color: isDark ? '#ffffff' : 'var(--text)',
                    margin: '4px 0 10px 0',
                    fontWeight: 800,
                  }}
                >
                  {course.title}
                </Typography.Title>
                <Typography.Paragraph
                  style={{
                    color: isDark ? '#cbd5e1' : 'var(--text-2)',
                    fontSize: 15,
                    maxWidth: 650,
                    margin: '0 0 18px 0',
                    lineHeight: 1.6,
                  }}
                >
                  {course.description || 'Hoàn thành tất cả các chủ đề theo thứ tự để nắm vững kiến thức.'}
                </Typography.Paragraph>

                {units.length > 0 && (
                  <Button
                    type="primary"
                    size="large"
                    icon={<RocketOutlined />}
                    onClick={() => navigate(`/courses/${id}/learn`)}
                    style={{
                      borderRadius: 8,
                      fontWeight: 700,
                      height: 42,
                      paddingInline: 24,
                    }}
                  >
                    {completedCount === 0 ? 'Bắt đầu học ngay' : 'Tiếp tục bài học'}
                  </Button>
                )}
              </div>

              {units.length > 0 && (
                <div style={{ textAlign: 'center', minWidth: 120 }}>
                  <Progress
                    type="circle"
                    percent={progressPercent}
                    size={92}
                    strokeWidth={8}
                    strokeColor={isDark ? '#3b82f6' : '#2563eb'}
                    trailColor={isDark ? 'rgba(255,255,255,0.12)' : '#e2e8f0'}
                    format={(p) => (
                      <span style={{ color: isDark ? '#ffffff' : 'var(--text)', fontSize: 20, fontWeight: 800 }}>
                        {p}%
                      </span>
                    )}
                  />
                  <div
                    style={{
                      color: isDark ? '#94a3b8' : 'var(--muted)',
                      fontSize: 13,
                      marginTop: 10,
                      fontWeight: 600,
                    }}
                  >
                    Đã học {completedCount}/{units.length} bài
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Danh sách chủ đề */}
          <Card
            title={
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 16 }}>
                  <UnorderedListOutlined style={{ color: 'var(--primary)' }} />
                  <span style={{ fontWeight: 700 }}>Nội dung lộ trình học ({units.length} chủ đề)</span>
                </div>
                {units.length > 0 && (
                  <Button
                    type="link"
                    icon={<RocketOutlined />}
                    onClick={() => navigate(`/courses/${id}/learn`)}
                    style={{ fontWeight: 600 }}
                  >
                    Vào không gian học tập &rarr;
                  </Button>
                )}
              </div>
            }
            style={{ borderRadius: 14 }}
            styles={{ body: { padding: 0 } }}
          >
            {units.length === 0 ? (
              <div style={{ padding: '40px 0' }}>
                <Empty description="Khóa học này đang được chuẩn bị nội dung." />
              </div>
            ) : (
              <List
                itemLayout="horizontal"
                dataSource={units}
                renderItem={(unit, index) => {
                  const isDone = completedSet.has(unit.id)
                  return (
                    <List.Item
                      className={isDone ? 'unit-item-completed' : ''}
                      style={{
                        padding: '18px 24px',
                        borderBottom: '1px solid var(--border)',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                      }}
                      onClick={() => navigate(`/courses/${id}/learn/${unit.id}`)}
                      actions={[
                        <Button
                          key="toggle"
                          type={isDone ? 'primary' : 'default'}
                          size="small"
                          style={isDone ? { background: '#16a34a', borderColor: '#16a34a', fontWeight: 600 } : undefined}
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleComplete(unit.id)
                          }}
                        >
                          {isDone ? '✓ Đã xong' : 'Đánh dấu xong'}
                        </Button>,
                        <Button
                          key="learn"
                          type={isDone ? 'default' : 'primary'}
                          icon={<ReadOutlined />}
                          onClick={(e) => {
                            e.stopPropagation()
                            navigate(`/courses/${id}/learn/${unit.id}`)
                          }}
                        >
                          Vào học
                        </Button>,
                      ]}
                    >
                      <List.Item.Meta
                        avatar={
                          <div
                            className={isDone ? 'badge-completed-solid' : ''}
                            style={{
                              width: 42,
                              height: 42,
                              borderRadius: '50%',
                              background: isDone ? '#16a34a' : 'var(--inset)',
                              color: isDone ? '#ffffff' : 'var(--text-2)',
                              border: isDone ? '2px solid #22c55e' : '1px solid var(--border)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              fontSize: 16,
                            }}
                          >
                            {isDone ? <CheckCircleFilled style={{ fontSize: 22 }} /> : index + 1}
                          </div>
                        }
                        title={
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ fontSize: 16, fontWeight: 700, color: isDone ? '#15803d' : 'var(--text)' }}>
                              {unit.title}
                            </span>
                            {isDone && (
                              <Tag
                                color="success"
                                style={{
                                  fontWeight: 700,
                                  fontSize: 12,
                                  borderRadius: 999,
                                  background: '#16a34a',
                                  color: '#ffffff',
                                  border: 'none',
                                  padding: '1px 10px',
                                }}
                              >
                                ✓ ĐÃ HOÀN THÀNH
                              </Tag>
                            )}
                          </div>
                        }
                        description={
                          <span style={{ color: isDone ? '#166534' : 'var(--text-2)', fontSize: 13.5 }}>
                            Bấm vào để mở không gian học tập: lý thuyết, code ví dụ và bài tập thực hành.
                          </span>
                        }
                      />
                    </List.Item>
                  )
                }}
              />
            )}
          </Card>
        </>
      )}
    </div>
  )
}
