import { Button, Card, Col, Empty, Row, Tag, Typography } from 'antd'
import { ArrowRightOutlined, BookOutlined, ReadOutlined } from '@ant-design/icons'
import { Link } from 'react-router-dom'
import { api } from '../../api'
import { useAuth } from '../../auth/context'
import { useFetch } from '../../lib/hooks'
import { useThemeMode } from '../../theme'

export default function CourseListPage() {
  const { mode } = useThemeMode()
  const { isAdmin } = useAuth()
  const isDark = mode === 'dark'
  const { data: courses, loading } = useFetch(() => api.listCourses(), [])

  // Sinh viên CHỈ thấy các khóa học đã được công khai (published === true).
  // Admin có thể xem trước tất cả các khóa (kèm nhãn Bản nháp).
  const displayCourses = (courses || []).filter((c) => isAdmin || c.published)

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 20px' }}>
      <div
        className="course-hero-banner"
        style={{
          marginBottom: 28,
          padding: '28px 32px',
          borderRadius: 18,
          background: isDark
            ? 'linear-gradient(135deg, rgba(12, 17, 32, 0.85) 0%, rgba(22, 31, 56, 0.85) 100%)'
            : 'linear-gradient(135deg, rgba(255, 255, 255, 0.85) 0%, rgba(238, 242, 255, 0.75) 100%)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: isDark ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid rgba(255, 255, 255, 0.95)',
          boxShadow: isDark
            ? '0 12px 32px -4px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.06)'
            : '0 14px 34px -4px rgba(99, 102, 241, 0.12), 0 0 0 1px rgba(99, 102, 241, 0.08), inset 0 1px 0 rgba(255, 255, 255, 1)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 12px', borderRadius: 999, background: isDark ? 'rgba(99, 102, 241, 0.18)' : 'linear-gradient(135deg, #eef2ff 0%, #ede9fe 100%)', color: isDark ? '#a5b4fc' : '#4f46e5', border: isDark ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid rgba(99, 102, 241, 0.2)', fontSize: 11.5, fontWeight: 700, marginBottom: 10 }}>
            <ReadOutlined /> LỘ TRÌNH ĐÀO TẠO
          </div>
          <Typography.Title level={2} style={{ margin: 0, fontWeight: 800, letterSpacing: '-0.025em' }}>
            Khóa học & Lộ trình C++
          </Typography.Title>
          <Typography.Text type="secondary" style={{ fontSize: 14.5, marginTop: 6, display: 'block' }}>
            Khám phá các lộ trình học lập trình C++ bài bản từ cơ bản đến nâng cao
          </Typography.Text>
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div
            style={{
              padding: '10px 20px',
              borderRadius: 14,
              background: isDark ? 'rgba(99, 102, 241, 0.12)' : 'rgba(255, 255, 255, 0.8)',
              border: isDark ? '1px solid rgba(99, 102, 241, 0.25)' : '1px solid rgba(99, 102, 241, 0.15)',
              boxShadow: '0 2px 8px rgba(99, 102, 241, 0.06)',
              textAlign: 'center',
              minWidth: 90,
            }}
          >
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--primary)', lineHeight: 1.1 }}>
              {displayCourses.length}
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: 2 }}>
              Khóa học
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <Card loading />
      ) : displayCourses.length === 0 ? (
        <Card style={{ textAlign: 'center', padding: '40px 0' }}>
          <Empty description="Hiện chưa có khóa học nào được công khai. Vui lòng quay lại sau!" />
        </Card>
      ) : (
        <Row gutter={[20, 20]}>
          {displayCourses.map((course) => (
            <Col xs={24} sm={12} md={8} key={course.id}>
              <Card
                hoverable
                className="course-card"
                style={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                }}
                styles={{
                  body: {
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  },
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                    <div
                      style={{
                        width: 46,
                        height: 46,
                        borderRadius: 12,
                        background: isDark
                          ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.16) 0%, rgba(168, 85, 247, 0.18) 100%)'
                          : 'linear-gradient(135deg, #eef2ff 0%, #ede9fe 100%)',
                        border: isDark ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid #c7d2fe',
                        color: isDark ? '#a5b4fc' : '#4f46e5',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 22,
                      }}
                    >
                      <BookOutlined />
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      {!course.published && (
                        <Tag color="default" style={{ margin: 0, fontWeight: 600 }}>
                          Bản nháp
                        </Tag>
                      )}
                      <span
                        style={{
                          padding: '4px 11px',
                          borderRadius: 999,
                          background: isDark ? 'rgba(99, 102, 241, 0.15)' : '#eef2ff',
                          color: isDark ? '#a5b4fc' : '#4338ca',
                          border: isDark ? '1px solid rgba(99, 102, 241, 0.25)' : '1px solid #c7d2fe',
                          fontSize: 12,
                          fontWeight: 700,
                        }}
                      >
                        {course.unitCount || 0} chủ đề
                      </span>
                    </div>
                  </div>

                  <Typography.Title level={4} style={{ marginBottom: 8, marginTop: 4, fontWeight: 700 }}>
                    {course.title}
                  </Typography.Title>

                  <Typography.Paragraph
                    type="secondary"
                    ellipsis={{ rows: 3 }}
                    style={{ minHeight: 66, marginBottom: 16, lineHeight: 1.6 }}
                  >
                    {course.description || 'Khóa học cung cấp kiến thức nền tảng và bài tập thực hành theo từng chủ đề.'}
                  </Typography.Paragraph>
                </div>

                <Link to={`/courses/${course.id}`} style={{ display: 'block', marginTop: 12 }}>
                  <Button type="primary" block icon={<ArrowRightOutlined />} iconPosition="end" style={{ height: 40, borderRadius: 8, fontWeight: 600 }}>
                    Bắt đầu học
                  </Button>
                </Link>
              </Card>
            </Col>
          ))}
        </Row>
      )}
    </div>
  )
}
