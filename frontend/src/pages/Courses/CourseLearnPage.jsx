import { useState, useEffect, useMemo } from 'react'
import {
  Alert,
  Button,
  Card,
  Divider,
  Empty,
  List,
  Progress,
  Result,
  Space,
  Spin,
  Tabs,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import {
  ArrowLeftOutlined,
  BookOutlined,
  CheckCircleFilled,
  CodeOutlined,
  DownloadOutlined,
  FilePdfOutlined,
  LeftOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  RightOutlined,
  TrophyOutlined,
} from '@ant-design/icons'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../auth/context'
import { api } from '../../api'
import { useFetch } from '../../lib/hooks'

export default function CourseLearnPage() {
  const { courseId, unitId } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const fromClassroom = searchParams.get('from') === 'classroom'
  const fromClassroomId = searchParams.get('classroomId')
  const learnQuery = fromClassroom ? `?from=classroom&classroomId=${fromClassroomId}` : ''

  // Sidebar trạng thái thu gọn
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  const { user, isAdmin, isLecturer } = useAuth()
  const { data: mySubmissions } = useFetch(
    () => (user?.id ? api.listSubmissions({ userId: user.id }) : Promise.resolve([])),
    [user?.id]
  )
  const solvedProblemIds = useMemo(() => {
    const set = new Set()
    ;(mySubmissions || []).forEach((s) => {
      if (s.verdict === 'AC') set.add(Number(s.problemId))
    })
    return set
  }, [mySubmissions])

  const triedProblemIds = useMemo(() => {
    const set = new Set()
    ;(mySubmissions || []).forEach((s) => {
      if (s.verdict && s.verdict !== 'AC') set.add(Number(s.problemId))
    })
    return set
  }, [mySubmissions])

  // Dữ liệu khóa học & tiến độ
  const { data: course, loading: courseLoading } = useFetch(() => api.getCourse(courseId), [courseId])
  const { data: progress } = useFetch(() => api.getCourseProgress(courseId), [courseId])

  // Cache tiến độ vào localStorage để hiển thị tức thì không bị chớp 0%
  const cacheKey = `cj.cache_progress_${courseId}`
  const cachedProgress = useMemo(() => {
    try {
      const raw = localStorage.getItem(cacheKey)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  }, [cacheKey])

  // Ưu tiên: progress API riêng -> course.progress đi kèm -> cached progress
  const activeProgress = progress || course?.progress || cachedProgress

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

  // Danh sách các unit được sắp xếp theo orderIndex
  const units = useMemo(() => {
    if (!course?.units) return []
    return [...course.units].sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
  }, [course])

  // Set các unit đã hoàn thành
  const completedSet = useMemo(() => {
    if (!activeProgress?.completedUnitIds) return new Set()
    return new Set(activeProgress.completedUnitIds)
  }, [activeProgress])

  // Tìm unit hiện tại
  const currentUnit = useMemo(() => {
    if (units.length === 0) return null
    if (unitId) {
      const found = units.find((u) => String(u.id) === String(unitId))
      if (found) return found
    }
    // Nếu không có unitId trên URL, tìm bài đầu tiên chưa hoàn thành
    const firstUncompleted = units.find((u) => !completedSet.has(u.id))
    return firstUncompleted || units[0]
  }, [units, unitId, completedSet])

  // Index của unit hiện tại
  const currentIndex = useMemo(() => {
    if (!currentUnit || units.length === 0) return -1
    return units.findIndex((u) => u.id === currentUnit.id)
  }, [units, currentUnit])

  const prevUnit = currentIndex > 0 ? units[currentIndex - 1] : null
  const nextUnit = currentIndex >= 0 && currentIndex < units.length - 1 ? units[currentIndex + 1] : null

  // Điều hướng nếu URL chưa có unitId
  useEffect(() => {
    if (currentUnit && (!unitId || String(unitId) !== String(currentUnit.id))) {
      navigate(`/courses/${courseId}/learn/${currentUnit.id}${learnQuery}`, { replace: true })
    }
  }, [currentUnit, unitId, courseId, learnQuery, navigate])

  // Nạp dữ liệu bài học & bài tập liên kết qua useFetch
  const unitIdKey = currentUnit?.id
  const { data: lessonBundle, loading: lessonLoading } = useFetch(
    () => {
      if (!unitIdKey) return Promise.resolve(null)
      return Promise.all([
        api.getLesson(unitIdKey),
        api.getUnitProblems(unitIdKey),
        api.listUnitFiles(unitIdKey).catch(() => []),
      ]).then(([resLesson, resProblems, resFiles]) => ({
        theoryContent: resLesson?.theoryContent || '',
        sampleCode: resLesson?.sampleCode || '#include <iostream>\nusing namespace std;\n\nint main() {\n    // Viết code của bạn ở đây\n    return 0;\n}',
        sampleInput: resLesson?.sampleInput || '',
        problems: resProblems || [],
        files: resFiles || [],
      })).catch(() => ({
        theoryContent: '',
        sampleCode: '#include <iostream>\nusing namespace std;\n\nint main() {\n    // Viết code của bạn ở đây\n    return 0;\n}',
        sampleInput: '',
        problems: [],
        files: [],
      }))
    },
    [unitIdKey]
  )

  const unitProblems = lessonBundle?.problems || []
  const unitFiles = lessonBundle?.files || []

  // Tab học đang chọn
  const [activeTab, setActiveTab] = useState('exercises')

  const handleSelectUnit = (targetUnit) => {
    navigate(`/courses/${courseId}/learn/${targetUnit.id}${learnQuery}`)
  }

  const handleGoNext = () => {
    if (nextUnit) {
      navigate(`/courses/${courseId}/learn/${nextUnit.id}${learnQuery}`)
    }
  }

  if (courseLoading) {
    return (
      <div style={{ padding: 100, textAlign: 'center' }}>
        <Spin size="large" tip="Đang tải không gian học tập..." />
      </div>
    )
  }

  if (!course) {
    return (
      <Result
        status="404"
        title="Không tìm thấy khóa học"
        extra={
          <Button type="primary" onClick={() => navigate(fromClassroom ? `/my-classrooms/${fromClassroomId}` : '/my-classrooms')}>
            Về lớp học
          </Button>
        }
      />
    )
  }

  if (!course.published && !isAdmin && !isLecturer) {
    return (
      <Result
        status="403"
        title="Khóa học đang ở bản nháp"
        subTitle="Nội dung khóa học này hiện đang được biên soạn và chưa được công khai cho sinh viên."
        extra={
          <Button type="primary" onClick={() => navigate(fromClassroom ? `/my-classrooms/${fromClassroomId}` : '/my-classrooms')}>
            Về lớp học
          </Button>
        }
      />
    )
  }

  const progressPercent = activeProgress?.percent ?? 0
  const progressSolved = activeProgress?.solvedProblems ?? 0
  const progressTotal = activeProgress?.totalProblems ?? 0
  const isCurrentDone = currentUnit ? completedSet.has(currentUnit.id) : false

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 56px)',
        background: 'var(--bg)',
        overflow: 'hidden',
      }}
    >
      {/* 1. Header Toolbar */}
      <div
        style={{
          height: 52,
          padding: '0 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface)',
          flexShrink: 0,
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <Tooltip title="Đóng/Mở mục lục bài học">
            <Button
              type="text"
              icon={sidebarCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            />
          </Tooltip>

          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate(fromClassroom ? `/my-classrooms/${fromClassroomId}` : '/my-classrooms')}
          >
            {fromClassroom ? 'Về lớp học' : 'Lớp học của tôi'}
          </Button>

          <Divider type="vertical" style={{ margin: 0 }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <BookOutlined style={{ color: '#2563eb' }} />
            <Typography.Text strong ellipsis style={{ maxWidth: 360, fontSize: 14 }}>
              {course.title}
            </Typography.Text>
          </div>
        </div>

        {/* Tiến độ */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Typography.Text type="secondary" style={{ fontSize: 13, whiteSpace: 'nowrap' }}>
            Tiến độ: <b style={{ color: 'var(--text)' }}>{progressSolved}/{progressTotal} bài tập</b> ({progressPercent}%)
          </Typography.Text>
          <Progress
            percent={progressPercent}
            showInfo={false}
            strokeColor="#16a34a"
            style={{ width: 90, margin: 0 }}
          />
        </div>
      </div>

      {/* 2. Main Workspace Layout */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {/* Sidebar: Danh sách bài học */}
        {!sidebarCollapsed && (
          <div
            style={{
              width: 330,
              flexShrink: 0,
              background: 'var(--surface)',
              borderRight: '1px solid var(--border)',
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
            }}
          >
            <div
              style={{
                padding: '12px 16px',
                borderBottom: '1px solid var(--border)',
                background: 'var(--inset)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span style={{ fontWeight: 600, fontSize: 14 }}>Mục lục bài học</span>
              <Tag color="blue">{units.length} chủ đề</Tag>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
              <List
                dataSource={units}
                renderItem={(unit, index) => {
                  const isDone = completedSet.has(unit.id)
                  const isActive = currentUnit && unit.id === currentUnit.id
                  return (
                    <div
                      key={unit.id}
                      onClick={() => handleSelectUnit(unit)}
                      className={isDone && !isActive ? 'unit-item-completed' : ''}
                      style={{
                        padding: '12px 16px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        background: isActive
                          ? 'var(--primary-soft)'
                          : isDone
                          ? 'rgba(22, 163, 74, 0.12)'
                          : 'transparent',
                        borderLeft: isActive
                          ? '4px solid var(--primary)'
                          : isDone
                          ? '4px solid #16a34a'
                          : '4px solid transparent',
                        borderBottom: '1px solid var(--border)',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div
                        className={isDone ? 'badge-completed-solid' : ''}
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: '50%',
                          flexShrink: 0,
                          background: isDone ? '#16a34a' : isActive ? 'var(--primary)' : 'var(--inset)',
                          color: (isDone || isActive) ? '#ffffff' : 'var(--text-2)',
                          border: isDone ? '2px solid #22c55e' : isActive ? '2px solid var(--primary)' : '1px solid var(--border)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 13,
                          fontWeight: 700,
                          boxShadow: isDone ? '0 2px 6px rgba(22, 163, 74, 0.4)' : undefined,
                        }}
                      >
                        {isDone ? <CheckCircleFilled style={{ fontSize: 15 }} /> : index + 1}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontWeight: isActive || isDone ? 700 : 500,
                            color: isActive ? 'var(--primary)' : isDone ? '#15803d' : 'var(--text)',
                            fontSize: 13.5,
                            lineHeight: 1.4,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {unit.title}
                        </div>
                        {isActive && (
                          <div style={{ fontSize: 11, color: 'var(--primary)', marginTop: 2, fontWeight: 600 }}>
                            Đang học bài này {isDone && '(✓ Đã hoàn thành)'}
                          </div>
                        )}
                        {isDone && !isActive && (
                          <div style={{ fontSize: 11, color: '#16a34a', marginTop: 2, fontWeight: 700 }}>
                            ✓ Đã hoàn thành
                          </div>
                        )}
                      </div>
                    </div>
                  )
                }}
              />
            </div>
          </div>
        )}

        {/* Nội dung bài học chính */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            minWidth: 0,
            minHeight: 0,
            background: 'var(--bg)',
          }}
        >
          {/* Header của bài học */}
          <div
            style={{
              padding: '16px 28px',
              borderBottom: '1px solid var(--border)',
              background: 'var(--surface)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <Tag color="cyan">Bài {currentIndex + 1} / {units.length}</Tag>
              {isCurrentDone ? (
                <Tag color="success" icon={<CheckCircleFilled />}>
                  Đã hoàn thành
                </Tag>
              ) : (
                <Tag color="default">Chưa hoàn thành</Tag>
              )}
            </div>
            <Typography.Title level={3} style={{ margin: 0 }}>
              {currentUnit?.title}
            </Typography.Title>
          </div>

          {/* Vùng nội dung Tabs */}
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '0 28px', background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
              <Tabs
                activeKey={activeTab}
                onChange={setActiveTab}
                items={[
                  { key: 'exercises', label: `Bài tập (${unitProblems.length})` },
                  { key: 'files', label: `Tài liệu (${unitFiles.length})` },
                ]}
              />
            </div>

            {/* Chi tiết nội dung theo Tab */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}>
              {lessonLoading ? (
                <div style={{ textAlign: 'center', padding: '80px 0' }}>
                  <Spin size="large" tip="Đang tải nội dung bài học..." />
                </div>
              ) : (
                <>
                  {/* TAB BÀI TẬP THỰC HÀNH */}
                  {activeTab === 'exercises' && (
                    <div style={{ maxWidth: 1080, margin: '0 auto' }}>
                      <Alert
                        type="info"
                        showIcon
                        message="Tự động ghi nhận hoàn thành bài học"
                        description="Khi bạn nộp bài tập được gắn trong chủ đề này và đạt kết quả Accepted (AC), hệ thống sẽ tự động cập nhật tiến độ hoàn thành cho bạn!"
                        style={{ marginBottom: 20, borderRadius: 8 }}
                      />

                      {unitProblems.length === 0 ? (
                        <Card style={{ borderRadius: 12, textAlign: 'center', padding: '40px 0' }}>
                          <Empty description="Chưa có bài tập thực hành nào được gắn vào chủ đề này." />
                        </Card>
                      ) : (
                        <List
                          grid={{ gutter: 16, column: 1 }}
                          dataSource={unitProblems}
                          renderItem={(prob) => {
                            const pId = Number(prob.problemId ?? prob.id)
                            const isSolved = prob.solved === true || solvedProblemIds.has(pId)
                            const isFailed = !isSolved && triedProblemIds.has(pId)
                            return (
                              <List.Item>
                                <Card
                                  hoverable
                                  className={isSolved ? 'card-problem-solved' : isFailed ? 'card-problem-failed' : ''}
                                  style={{
                                    borderRadius: 12,
                                    border: isSolved
                                      ? '1.5px solid #22c55e'
                                      : isFailed
                                      ? '1.5px solid #ef4444'
                                      : '1px solid var(--border)',
                                    borderLeft: isSolved
                                      ? '5px solid #16a34a'
                                      : isFailed
                                      ? '5px solid #dc2626'
                                      : '1px solid var(--border)',
                                    background: isSolved
                                      ? 'rgba(22, 163, 74, 0.12)'
                                      : isFailed
                                      ? 'rgba(239, 68, 68, 0.09)'
                                      : 'var(--surface)',
                                  }}
                                  styles={{ body: { padding: '18px 24px' } }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                                    <div style={{ flex: 1, minWidth: 260 }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                                        <span style={{ fontWeight: 700, fontSize: 16, color: isSolved ? '#15803d' : isFailed ? '#b91c1c' : 'var(--text)' }}>
                                          #{pId} - {prob.title}
                                        </span>
                                        {isSolved && (
                                          <Tag
                                            color="success"
                                            style={{
                                              fontWeight: 700,
                                              fontSize: 12,
                                              borderRadius: 999,
                                              background: '#16a34a',
                                              color: '#fff',
                                              border: 'none',
                                              padding: '1px 10px',
                                            }}
                                          >
                                            ✓ ĐÃ GIẢI (AC)
                                          </Tag>
                                        )}
                                        {isFailed && (
                                          <Tag
                                            color="error"
                                            style={{
                                              fontWeight: 700,
                                              fontSize: 12,
                                              borderRadius: 999,
                                              background: '#dc2626',
                                              color: '#fff',
                                              border: 'none',
                                              padding: '1px 10px',
                                            }}
                                          >
                                            ✗ CHƯA ĐẠT (WA)
                                          </Tag>
                                        )}
                                        <Tag color={prob.difficulty === 'hard' ? 'red' : prob.difficulty === 'medium' ? 'gold' : 'green'}>
                                          {prob.difficulty === 'hard' ? 'Khó' : prob.difficulty === 'medium' ? 'Trung bình' : 'Dễ'}
                                        </Tag>
                                        <Tag color="blue">{prob.points || 100} điểm</Tag>
                                      </div>
                                      <Typography.Paragraph
                                        ellipsis={{ rows: 2 }}
                                        style={{ color: isSolved ? '#166534' : isFailed ? '#991b1b' : 'var(--text-2)', margin: 0, maxWidth: 700 }}
                                      >
                                        {prob.description || 'Thực hành áp dụng kiến thức của bài học để giải bài toán này trên máy chấm.'}
                                      </Typography.Paragraph>
                                    </div>

                                    <Link to={`/problems/${pId}`}>
                                      <Button
                                        type={isSolved ? 'default' : isFailed ? 'default' : 'primary'}
                                        icon={isSolved ? <CheckCircleFilled /> : <CodeOutlined />}
                                        size="large"
                                        style={
                                          isSolved
                                            ? { borderColor: '#16a34a', color: '#16a34a', fontWeight: 700 }
                                            : isFailed
                                            ? { borderColor: '#dc2626', color: '#dc2626', fontWeight: 700 }
                                            : undefined
                                        }
                                      >
                                        {isSolved ? 'Làm lại bài' : isFailed ? 'Sửa bài (Làm tiếp)' : 'Làm bài tập'}
                                      </Button>
                                    </Link>
                                  </div>
                                </Card>
                              </List.Item>
                            )
                          }}
                        />
                      )}
                    </div>
                  )}
                  {/* TAB TÀI LIỆU ĐÍNH KÈM */}
                  {activeTab === 'files' && (
                    <div style={{ maxWidth: 960, margin: '0 auto' }}>
                      {unitFiles.length === 0 ? (
                        <Card style={{ textAlign: 'center', padding: '40px 0', background: 'var(--surface)', borderRadius: 12 }}>
                          <Empty
                            image={<FilePdfOutlined style={{ fontSize: 48, color: 'var(--muted)' }} />}
                            description={<span style={{ color: 'var(--muted)' }}>Chưa có tài liệu hoặc slide bài giảng đính kèm cho chủ đề này</span>}
                          />
                        </Card>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                          {unitFiles.map((f) => (
                            <Card
                              key={f.id}
                              style={{
                                borderRadius: 10,
                                border: '1px solid var(--border)',
                                background: 'var(--surface)',
                              }}
                              styles={{ body: { padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' } }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                                <div style={{
                                  width: 44, height: 44, borderRadius: 8,
                                  background: 'rgba(239, 68, 68, 0.1)',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  color: '#ef4444', fontSize: 22,
                                }}>
                                  <FilePdfOutlined />
                                </div>
                                <div>
                                  <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--text)' }}>{f.fileName}</div>
                                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                                    {f.fileSize ? `${(f.fileSize / 1024).toFixed(1)} KB` : 'Tài liệu học tập'} · Tải lên ngày {f.createdAt ? new Date(f.createdAt).toLocaleDateString('vi-VN') : '—'}
                                  </div>
                                </div>
                              </div>
                              <Space>
                                <a href={`/api/courses/units/${unitIdKey}/files/${f.id}`} download={f.fileName} target="_blank" rel="noreferrer">
                                  <Button type="primary" icon={<DownloadOutlined />}>Tải về máy</Button>
                                </a>
                              </Space>
                            </Card>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* 3. Bottom Navigation Bar */}
          <div
            style={{
              height: 58,
              padding: '0 28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderTop: '1px solid var(--border)',
              background: 'var(--surface)',
              flexShrink: 0,
            }}
          >
            <div>
              {prevUnit ? (
                <Button
                  icon={<LeftOutlined />}
                  onClick={() => handleSelectUnit(prevUnit)}
                >
                  Bài trước ({prevUnit.title})
                </Button>
              ) : (
                <Button disabled icon={<LeftOutlined />}>
                  Bài đầu tiên
                </Button>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                Bài <b>{currentIndex + 1}</b> / <b>{units.length}</b>
              </Typography.Text>
            </div>

            <div>
              {nextUnit ? (
                <Button type="primary" icon={<RightOutlined />} onClick={handleGoNext}>
                  Tiếp theo ({nextUnit.title})
                </Button>
              ) : (
                <Button
                  type="primary"
                  icon={<TrophyOutlined />}
                  style={{ background: '#16a34a', borderColor: '#16a34a' }}
                  disabled
                >
                  Bài cuối khóa học
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
