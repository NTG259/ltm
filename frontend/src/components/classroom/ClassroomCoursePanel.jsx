import { useMemo, useState } from 'react'
import {
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Code2,
  Download,
  FileText,
  LockKeyhole,
  Play,
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '../ui/empty'
import { Skeleton } from '../ui/skeleton'

const difficultyLabel = { EASY: 'Dễ', MEDIUM: 'Trung bình', HARD: 'Khó' }
const difficultyVariant = { EASY: 'secondary', MEDIUM: 'outline', HARD: 'destructive' }

function CoursePanelSkeleton() {
  return (
    <div className="flex flex-col gap-3 p-4" aria-busy="true" aria-label="Đang tải nội dung khóa học">
      <Skeleton className="h-10 w-2/3" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-28 w-full" />
    </div>
  )
}

export default function ClassroomCoursePanel({ course, loading, progress, classroomId }) {
  const navigate = useNavigate()
  const units = useMemo(() => course?.units || [], [course])
  const completedIds = useMemo(
    () => new Set(progress?.completedUnitIds || []),
    [progress?.completedUnitIds],
  )
  const [selectedUnitId, setSelectedUnitId] = useState(null)

  const suggestedUnit = units.find((unit) => !completedIds.has(unit.id)) || units.at(-1)
  const activeUnit = units.find((unit) => unit.id === selectedUnitId) || suggestedUnit

  if (loading) return <CoursePanelSkeleton />

  if (!course) {
    return (
      <Empty className="min-h-64">
        <EmptyHeader>
          <EmptyMedia variant="icon"><BookOpen /></EmptyMedia>
          <EmptyTitle>Chưa có khóa học</EmptyTitle>
          <EmptyDescription>Lớp học chưa được gắn nội dung khóa học.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <div className="classroom-course">
      <aside className="classroom-course__sidebar" aria-label="Danh sách chủ đề">
        <div className="classroom-course__sidebar-head">
          <span>Lộ trình khóa học</span>
          <Badge variant="secondary">{units.length} chủ đề</Badge>
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
                  {completed
                    ? <CheckCircle2 className="size-4" />
                    : locked ? <LockKeyhole className="size-4" /> : index + 1}
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
                <h2 className="text-lg font-semibold">{activeUnit.title}</h2>
              </div>
              <Button
                onClick={() => navigate(`/courses/${course.courseId}/learn/${activeUnit.id}?from=classroom&classroomId=${classroomId}`)}
              >
                <Play data-icon="inline-start" />
                Vào bài học
              </Button>
            </header>

            <div className="classroom-course__section-head">
              <div><FileText /><span><strong>Tài liệu bài học</strong><small>Slide và tài liệu tham khảo</small></span></div>
              <Badge variant="secondary">{activeUnit.files?.length || 0} tệp</Badge>
            </div>
            <div className="classroom-course__resources">
              {(activeUnit.files || []).length ? activeUnit.files.map((file) => (
                <div className="classroom-course__resource" key={file.id}>
                  <span className="classroom-course__resource-icon"><FileText /></span>
                  <span className="classroom-course__resource-copy">
                    <strong>{file.filename}</strong>
                    <small>{file.fileSize ? `${(file.fileSize / 1024 / 1024).toFixed(1)} MB` : 'Tài liệu PDF'}</small>
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Tải ${file.filename}`}
                    onClick={() => window.open(`/api/courses/units/${activeUnit.id}/files/${file.id}/download`, '_blank')}
                  >
                    <Download />
                  </Button>
                </div>
              )) : <p className="classroom-course__placeholder">Chưa có tài liệu đính kèm cho chủ đề này.</p>}
            </div>

            <div className="classroom-course__section-head">
              <div><Code2 /><span><strong>Bài tập thực hành</strong><small>Luyện tập ngay trên máy chấm</small></span></div>
              <Badge variant="secondary">{activeUnit.problems?.length || 0} bài</Badge>
            </div>
            <div className="classroom-course__problems">
              {(activeUnit.problems || []).length ? activeUnit.problems.map((problem) => (
                <Link className="classroom-course__problem" key={problem.id} to={`/problems/${problem.id}`}>
                  <span className="classroom-course__problem-icon"><Code2 /></span>
                  <span><strong>{problem.title}</strong><small>Giải bài trên CodeJudge</small></span>
                  <Badge variant={difficultyVariant[problem.difficulty] || 'outline'}>
                    {difficultyLabel[problem.difficulty] || problem.difficulty}
                  </Badge>
                  <ChevronRight className="size-4" />
                </Link>
              )) : <p className="classroom-course__placeholder">Chưa có bài tập cho chủ đề này.</p>}
            </div>
          </>
        ) : (
          <Empty className="min-h-56">
            <EmptyHeader>
              <EmptyMedia variant="icon"><BookOpen /></EmptyMedia>
              <EmptyTitle>Chưa có chủ đề học tập</EmptyTitle>
            </EmptyHeader>
          </Empty>
        )}
      </section>
    </div>
  )
}
