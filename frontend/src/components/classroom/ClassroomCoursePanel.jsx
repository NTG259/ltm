import { useMemo, useState } from 'react'
import { Button, Empty, Skeleton, Tag, Typography } from 'antd'
import {
  CheckCircleFilled,
  CodeOutlined,
  DownloadOutlined,
  FilePdfOutlined,
  LockOutlined,
  PlayCircleOutlined,
  ReadOutlined,
  RightOutlined,
} from '@ant-design/icons'
import { Link } from 'react-router-dom'

const difficultyLabel = { EASY: 'Dễ', MEDIUM: 'Trung bình', HARD: 'Khó' }
const difficultyColor = { EASY: 'green', MEDIUM: 'gold', HARD: 'red' }

export default function ClassroomCoursePanel({ course, loading, progress }) {
  const units = useMemo(() => course?.units || [], [course])
  const completedIds = useMemo(
    () => new Set(progress?.completedUnitIds || []),
    [progress?.completedUnitIds],
  )
  const [selectedUnitId, setSelectedUnitId] = useState(null)

  const suggestedUnit = units.find((unit) => !completedIds.has(unit.id)) || units.at(-1)
  const activeUnit = units.find((unit) => unit.id === selectedUnitId) || suggestedUnit

  if (loading) {
    return <div className="classroom-course__loading" aria-busy="true"><Skeleton active paragraph={{ rows: 6 }} /></div>
  }

  if (!course) {
    return (
      <Empty
        className="classroom-course__empty"
        image={<ReadOutlined />}
        description="Lớp học chưa được gắn khóa học"
      />
    )
  }

  return (
    <div className="classroom-course">
      <aside className="classroom-course__sidebar" aria-label="Danh sách chủ đề">
        <div className="classroom-course__sidebar-head">
          <span>Lộ trình khóa học</span>
          <Tag>{units.length} chủ đề</Tag>
        </div>
        <div className="classroom-course__unit-list">
          {units.map((unit, index) => {
            const completed = completedIds.has(unit.id)
            const locked = index > 0 && !completedIds.has(units[index - 1].id)
            return (
              <button
                key={unit.id}
                type="button"
                className={`classroom-course__unit${activeUnit?.id === unit.id ? ' is-active' : ''}`}
                onClick={() => !locked && setSelectedUnitId(unit.id)}
                disabled={locked}
                aria-current={activeUnit?.id === unit.id ? 'step' : undefined}
              >
                <span className="classroom-course__unit-index">
                  {completed ? <CheckCircleFilled /> : locked ? <LockOutlined /> : index + 1}
                </span>
                <span className="classroom-course__unit-copy">
                  <strong>{unit.title}</strong>
                  <small>{completed ? 'Đã hoàn thành' : locked ? 'Chưa mở khóa' : 'Sẵn sàng học'}</small>
                </span>
              </button>
            )
          })}
        </div>
      </aside>

      <section className="classroom-course__lesson" aria-live="polite">
        {activeUnit ? (
          <>
            <header className="classroom-course__lesson-head">
              <div>
                <span>Chủ đề {units.findIndex((unit) => unit.id === activeUnit.id) + 1}</span>
                <Typography.Title level={2}>{activeUnit.title}</Typography.Title>
              </div>
              <Button
                type="primary"
                icon={<PlayCircleOutlined />}
                href={`#/courses/${course.courseId}/learn/${activeUnit.id}`}
              >
                Vào bài học
              </Button>
            </header>

            <div className="classroom-course__section-head">
              <div><FilePdfOutlined /><span><strong>Tài liệu bài học</strong><small>Slide và tài liệu tham khảo</small></span></div>
              <Tag>{activeUnit.files?.length || 0} tệp</Tag>
            </div>
            <div className="classroom-course__resources">
              {(activeUnit.files || []).length ? activeUnit.files.map((file) => (
                <div className="classroom-course__resource" key={file.id}>
                  <span className="classroom-course__resource-icon"><FilePdfOutlined /></span>
                  <span className="classroom-course__resource-copy">
                    <strong>{file.filename}</strong>
                    <small>{file.fileSize ? `${(file.fileSize / 1024 / 1024).toFixed(1)} MB` : 'Tài liệu PDF'}</small>
                  </span>
                  <Button
                    type="text"
                    icon={<DownloadOutlined />}
                    aria-label={`Tải ${file.filename}`}
                    onClick={() => window.open(`/api/courses/units/${activeUnit.id}/files/${file.id}/download`, '_blank')}
                  />
                </div>
              )) : <p className="classroom-course__placeholder">Chưa có tài liệu đính kèm cho chủ đề này.</p>}
            </div>

            <div className="classroom-course__section-head">
              <div><CodeOutlined /><span><strong>Bài tập thực hành</strong><small>Luyện tập ngay trên máy chấm</small></span></div>
              <Tag>{activeUnit.problems?.length || 0} bài</Tag>
            </div>
            <div className="classroom-course__problems">
              {(activeUnit.problems || []).length ? activeUnit.problems.map((problem) => (
                <Link className="classroom-course__problem" key={problem.id} to={`/problems/${problem.id}`}>
                  <span className="classroom-course__problem-icon"><CodeOutlined /></span>
                  <span><strong>{problem.title}</strong><small>Giải bài trên CodeJudge</small></span>
                  <Tag color={difficultyColor[problem.difficulty]}>{difficultyLabel[problem.difficulty] || problem.difficulty}</Tag>
                  <RightOutlined />
                </Link>
              )) : <p className="classroom-course__placeholder">Chưa có bài tập cho chủ đề này.</p>}
            </div>
          </>
        ) : (
          <Empty description="Chưa có chủ đề học tập" />
        )}
      </section>
    </div>
  )
}
