import { App, Button, Card, Progress, Skeleton, Tabs, Tag, Typography } from 'antd'
import {
  ArrowLeftOutlined,
  BookOutlined,
  CheckCircleFilled,
  PlayCircleOutlined,
  TrophyOutlined,
} from '@ant-design/icons'
import { useNavigate, useParams } from 'react-router-dom'
import ClassroomCoursePanel from '../components/classroom/ClassroomCoursePanel'
import ClassroomContestsPanel from '../components/classroom/ClassroomContestsPanel'
import { api } from '../api'
import { useFetch } from '../lib/hooks'

export default function MyClassroomDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const classroomState = useFetch(() => api.getClassroom(id), [id])
  const courseState = useFetch(() => api.getClassroomCourse(id).catch(() => null), [id])
  const courseId = courseState.data?.courseId
  const progressState = useFetch(
    () => courseId ? api.getCourseProgress(courseId) : Promise.resolve(null),
    [courseId],
  )

  const classroom = classroomState.data
  const course = courseState.data
  const progress = progressState.data
  const units = course?.units || []
  const completedIds = new Set(progress?.completedUnitIds || [])
  const continueUnit = units.find((unit) => !completedIds.has(unit.id)) || units.at(-1)
  const progressPercent = progress?.percent || 0

  if (classroomState.loading) {
    return (
      <div className="classroom-learning classroom-learning--loading" aria-busy="true">
        <Skeleton active paragraph={{ rows: 8 }} />
      </div>
    )
  }

  const tabItems = [
    {
      key: 'course',
      label: <span><BookOutlined /> Nội dung học tập</span>,
      children: <ClassroomCoursePanel course={course} loading={courseState.loading} progress={progress} />,
    },
    {
      key: 'contests',
      label: <span><TrophyOutlined /> Kỳ thi của lớp</span>,
      children: <ClassroomContestsPanel classroom={classroom} loading={classroomState.loading} />,
    },
  ]

  return (
    <App>
      <main className="classroom-learning">
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          className="classroom-learning__back"
          onClick={() => navigate('/my-classrooms')}
        >
          Lớp học của tôi
        </Button>

        <Card className="classroom-learning__hero" bordered={false}>
          <div className="classroom-learning__hero-grid">
            <div className="classroom-learning__hero-copy">
              <div className="classroom-learning__eyebrow">
                <Tag color="blue">Đang học</Tag>
                {classroom?.semester && <span>{classroom.semester}</span>}
              </div>
              <Typography.Title level={1}>{classroom?.name || 'Lớp học'}</Typography.Title>
              <Typography.Paragraph>
                {course?.description || 'Theo dõi lộ trình, học bài giảng và hoàn thành các bài tập trong lớp.'}
              </Typography.Paragraph>
              {course && continueUnit && (
                <Button
                  type="primary"
                  size="large"
                  icon={<PlayCircleOutlined />}
                  href={`#/courses/${course.courseId}/learn/${continueUnit.id}`}
                >
                  {progressPercent > 0 ? 'Tiếp tục học' : 'Bắt đầu khóa học'}
                </Button>
              )}
            </div>

            <section className="classroom-learning__progress" aria-label="Tiến độ khóa học">
              <div className="classroom-learning__progress-head">
                <div>
                  <span>Tiến độ khóa học</span>
                  <strong>{course?.title || 'Chưa có khóa học'}</strong>
                </div>
                <span className="classroom-learning__progress-value">{progressPercent}%</span>
              </div>
              <Progress percent={progressPercent} showInfo={false} />
              <div className="classroom-learning__stats">
                <div><strong>{units.length}</strong><span>Chủ đề</span></div>
                <div><strong>{progress?.completedCount || 0}</strong><span>Đã xong</span></div>
                <div><strong>{classroom?.contests?.length || 0}</strong><span>Kỳ thi</span></div>
              </div>
              {progressPercent === 100 && (
                <div className="classroom-learning__complete">
                  <CheckCircleFilled /> Bạn đã hoàn thành khóa học này
                </div>
              )}
            </section>
          </div>
        </Card>

        <Card className="classroom-learning__content" bordered={false}>
          <Tabs items={tabItems} defaultActiveKey="course" destroyOnHidden />
        </Card>
      </main>
    </App>
  )
}
