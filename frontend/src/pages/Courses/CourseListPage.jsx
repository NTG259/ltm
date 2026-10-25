import { Button, Card, Col, Empty, Row, Tag, Typography } from 'antd'
import { Link } from 'react-router-dom'
import { api } from '../../api'
import { useAuth } from '../../auth/context'
import { useFetch } from '../../lib/hooks'

export default function CourseListPage() {
  const { isAdmin } = useAuth()
  const { data: courses, loading } = useFetch(() => api.listCourses(), [])

  // Sinh viên CHỈ thấy các khóa học đã được công khai (published === true).
  // Admin có thể xem trước tất cả các khóa (kèm nhãn Bản nháp).
  const displayCourses = (courses || []).filter((c) => isAdmin || c.published)

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 20px' }}>
      <div className="page-head" style={{ marginBottom: 28 }}>
        <div>
          <Typography.Title level={2} style={{ margin: 0, fontWeight: 700 }}>
            Khóa học
          </Typography.Title>
          <Typography.Text type="secondary" style={{ fontSize: 14.5, marginTop: 6, display: 'block' }}>
            Học C++ theo từng chủ đề, từ cơ bản đến nâng cao.
          </Typography.Text>
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
                  <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-start', marginBottom: 14 }}>
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
                          background: 'var(--inset)',
                          color: 'var(--text-2)',
                          border: '1px solid var(--border)',
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
                  <Button type="primary" block style={{ height: 40, borderRadius: 8, fontWeight: 600 }}>
                    Xem khóa học
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
