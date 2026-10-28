import { useState, useEffect, useMemo } from 'react'
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Divider,
  Empty,
  Input,
  List,
  Progress,
  Result,
  Row,
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
  CaretRightOutlined,
  CheckCircleFilled,
  CheckCircleOutlined,
  CodeOutlined,
  CopyOutlined,
  LeftOutlined,
  LockOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  ReadOutlined,
  RightOutlined,
  RocketOutlined,
  ThunderboltOutlined,
  TrophyOutlined,
} from '@ant-design/icons'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../auth/context'
import { api } from '../../api'
import { useFetch } from '../../lib/hooks'
import MarkdownViewer from '../../components/MarkdownViewer'
import CodeEditor from '../../components/CodeEditor'
import VerdictTag from '../../components/VerdictTag'
import { formatMemory, formatTime } from '../../lib/format'

// eslint-disable-next-line no-unused-vars
const _SAMPLE_LESSONS_REMOVED = {
  io: {
    theory: `### 1. Luồng nhập xuất cơ bản trong C++
C++ sử dụng thư viện \`<iostream>\` để xử lý việc nhập dữ liệu từ bàn phím và in kết quả ra màn hình.
- **std::cin**: Đối tượng nhận luồng dữ liệu đầu vào (Standard Input).
- **std::cout**: Đối tượng xuất luồng dữ liệu ra màn hình (Standard Output).
- **toán tử >>**: Trích xuất dữ liệu từ \`cin\` gán vào biến.
- **toán tử <<**: Đẩy dữ liệu ra \`cout\`.
- **std::endl**: Xuống dòng và xóa bộ nhớ đệm (flush buffer).

### 2. Ví dụ minh họa
Khi nhập nhiều biến cùng lúc, các biến được ngăn cách bởi dấu cách hoặc ký tự xuống dòng:
\`\`\`cpp
int a, b;
std::cin >> a >> b;
std::cout << "Tổng: " << (a + b) << std::endl;
\`\`\``,
    code: `#include <iostream>
using namespace std;

int main() {
    int a, b;
    if (cin >> a >> b) {
        cout << "Tong 2 so la: " << (a + b) << endl;
    }
    return 0;
}`,
    input: '15 25',
  },
  branches: {
    theory: `### 1. Cấu trúc rẽ nhánh if - else
Dùng để kiểm tra điều kiện logic và phân nhánh luồng thực thi của chương trình.
\`\`\`cpp
if (điều_kiện) {
    // Khối lệnh thực thi khi điều kiện Đúng (true)
} else {
    // Khối lệnh thực thi khi điều kiện Sai (false)
}
\`\`\`

### 2. Cấu trúc switch - case
Thường dùng khi so sánh một biến số nguyên/ký tự với nhiều giá trị hằng số rời rạc.`,
    code: `#include <iostream>
using namespace std;

int main() {
    int n;
    if (cin >> n) {
        if (n % 2 == 0) {
            cout << n << " la so chan" << endl;
        } else {
            cout << n << " la so le" << endl;
        }
    }
    return 0;
}`,
    input: '42',
  },
  loop: {
    theory: `### 1. Vòng lặp trong C++
- **for**: Dùng khi biết trước số lần lặp cụ thể.
- **while**: Kiểm tra điều kiện trước khi thực hiện thân vòng lặp.
- **do-while**: Thực thi ít nhất 1 lần trước khi kiểm tra điều kiện.

### 2. Điều khiển luồng lặp
- **break**: Thoát ngay lập tức khỏi vòng lặp trong cùng.
- **continue**: Bỏ qua phần còn lại của vòng lặp hiện tại và nhảy tới bước lặp kế tiếp.`,
    code: `#include <iostream>
using namespace std;

int main() {
    int n;
    if (cin >> n) {
        long long sum = 0;
        for (int i = 1; i <= n; i++) {
            sum += i;
        }
        cout << "Tong tu 1 den " << n << " la: " << sum << endl;
    }
    return 0;
}`,
    input: '10',
  },
  default: {
    theory: `### Chào mừng bạn đến với bài học này!
Nội dung bài giảng đang được ban quản trị tiếp tục cập nhật và bổ sung.

**Lời khuyên:**
- Đọc kỹ lý thuyết và phân tích các trường hợp biên.
- Tự gõ lại mã nguồn mẫu để rèn luyện thói quen tư duy và cú pháp.
- Hoàn thành các bài tập thực hành liên kết để củng cố kỹ năng lập trình.`,
    code: `#include <iostream>
using namespace std;

int main() {
    cout << "Chao mung ban den voi CodeJudge!" << endl;
    return 0;
}`,
    input: '',
  },
}

export default function CourseLearnPage() {
  const { courseId, unitId } = useParams()
  const navigate = useNavigate()
  const { message } = App.useApp()

  // Sidebar trạng thái thu gọn
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  const { user, isAdmin } = useAuth()
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
  const { data: progress, reload: reloadProgress } = useFetch(() => api.getCourseProgress(courseId), [courseId])

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
      // Don't navigate to a locked unit; fall through to find unlocked one
      if (found && !(found.locked && !isAdmin)) return found
    }
    // Nếu không có unitId trên URL (hoặc unit bị khóa), tìm bài đầu tiên chưa hoàn thành và chưa bị khóa
    const firstAccessible = units.find((u) => !completedSet.has(u.id) && !(u.locked && !isAdmin))
    return firstAccessible || units[0]
  }, [units, unitId, completedSet, isAdmin])

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
      navigate(`/courses/${courseId}/learn/${currentUnit.id}`, { replace: true })
    }
  }, [currentUnit, unitId, courseId, navigate])

  // Nạp dữ liệu bài học & bài tập liên kết qua useFetch
  const unitIdKey = currentUnit?.id
  const { data: lessonBundle, loading: lessonLoading } = useFetch(
    () => {
      if (!unitIdKey) return Promise.resolve(null)
      return Promise.all([
        api.getLesson(unitIdKey),
        api.getUnitProblems(unitIdKey),
      ]).then(([resLesson, resProblems]) => ({
        theoryContent: resLesson?.theoryContent || '',
        sampleCode: resLesson?.sampleCode || '#include <iostream>\nusing namespace std;\n\nint main() {\n    // Viết code của bạn ở đây\n    return 0;\n}',
        sampleInput: resLesson?.sampleInput || '',
        problems: resProblems || [],
      })).catch(() => ({
        theoryContent: '',
        sampleCode: '#include <iostream>\nusing namespace std;\n\nint main() {\n    // Viết code của bạn ở đây\n    return 0;\n}',
        sampleInput: '',
        problems: [],
      }))
    },
    [unitIdKey]
  )

  const lessonData = lessonBundle || null
  const unitProblems = lessonBundle?.problems || []

  // Quản lý code & input khi người dùng gõ
  const [editedCode, setEditedCode] = useState(null)
  const [editedInput, setEditedInput] = useState(null)
  const [codeRunning, setCodeRunning] = useState(false)
  const [runResult, setRunResult] = useState(null)

  const currentCode = editedCode !== null ? editedCode : (lessonData?.sampleCode || '')
  const currentInput = editedInput !== null ? editedInput : (lessonData?.sampleInput || '')

  // Tab học đang chọn
  const [activeTab, setActiveTab] = useState('theory')

  // Đang bấm đánh dấu hoàn thành
  const [updatingProgress, setUpdatingProgress] = useState(false)

  const handleSelectUnit = (targetUnit) => {
    if (targetUnit.locked && !isAdmin) {
      message.warning('Hãy hoàn thành chủ đề trước để mở khóa chủ đề này.')
      return
    }
    setEditedCode(null)
    setEditedInput(null)
    setRunResult(null)
    navigate(`/courses/${courseId}/learn/${targetUnit.id}`)
  }

  // Toggle trạng thái hoàn thành
  const handleToggleComplete = async (uId = currentUnit?.id) => {
    if (!uId) return
    setUpdatingProgress(true)
    try {
      await api.toggleUnitProgress(uId)
      message.success('Đã cập nhật tiến độ học tập!')
      reloadProgress()
    } catch (e) {
      message.error(e.message || 'Không thể cập nhật tiến độ')
    } finally {
      setUpdatingProgress(false)
    }
  }

  // Đánh dấu hoàn thành và chuyển sang bài kế tiếp
  const handleCompleteAndNext = async () => {
    if (!currentUnit) return
    if (!completedSet.has(currentUnit.id)) {
      await handleToggleComplete(currentUnit.id)
    }
    setEditedCode(null)
    setEditedInput(null)
    setRunResult(null)
    if (nextUnit) {
      navigate(`/courses/${courseId}/learn/${nextUnit.id}`)
    } else {
      message.success('Chúc mừng bạn đã hoàn thành tất cả các bài học trong khóa này! 🎉')
    }
  }

  // Chạy thử code C++
  const handleRunCode = async () => {
    if (!currentCode.trim()) {
      message.warning('Mã nguồn C++ đang trống')
      return
    }
    setCodeRunning(true)
    setRunResult(null)
    try {
      const res = await api.runTest({
        problemId: null,
        sourceCode: currentCode,
        input: currentInput || '',
        expectedOutput: '',
      })
      setRunResult(res)
    } catch (e) {
      setRunResult({
        verdict: 'RTE',
        output: '',
        stderr: e.message || 'Lỗi khi gửi yêu cầu thực thi',
        timeMs: 0,
        memoryKb: 0,
      })
    } finally {
      setCodeRunning(false)
    }
  }

  const handleCopyCode = () => {
    navigator.clipboard.writeText(currentCode)
    message.success('Đã sao chép mã nguồn C++!')
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
          <Button type="primary" onClick={() => navigate('/courses')}>
            Về danh sách khóa học
          </Button>
        }
      />
    )
  }

  if (!course.published && !isAdmin) {
    return (
      <Result
        status="403"
        title="Khóa học đang ở bản nháp"
        subTitle="Nội dung khóa học này hiện đang được biên soạn và chưa được công khai cho sinh viên."
        extra={
          <Button type="primary" onClick={() => navigate('/courses')}>
            Về danh sách khóa học
          </Button>
        }
      />
    )
  }

  const completedCount = completedSet.size
  const progressPercent = units.length > 0 ? Math.round((completedCount / units.length) * 100) : 0
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
            onClick={() => navigate(`/courses/${courseId}`)}
          >
            Quay lại khóa học
          </Button>

          <Divider type="vertical" style={{ margin: 0 }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <BookOutlined style={{ color: '#2563eb' }} />
            <Typography.Text strong ellipsis style={{ maxWidth: 360, fontSize: 14 }}>
              {course.title}
            </Typography.Text>
          </div>
        </div>

        {/* Tiến độ và nút Đánh dấu hoàn thành */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Typography.Text type="secondary" style={{ fontSize: 13, whiteSpace: 'nowrap' }}>
              Tiến độ: <b style={{ color: 'var(--text)' }}>{completedCount}/{units.length} bài</b> ({progressPercent}%)
            </Typography.Text>
            <Progress
              percent={progressPercent}
              showInfo={false}
              strokeColor="#16a34a"
              style={{ width: 90, margin: 0 }}
            />
          </div>

          {currentUnit && (
            <Button
              type={isCurrentDone ? 'default' : 'primary'}
              icon={isCurrentDone ? <CheckCircleFilled style={{ color: '#16a34a' }} /> : <CheckCircleOutlined />}
              loading={updatingProgress}
              onClick={() => handleToggleComplete(currentUnit.id)}
            >
              {isCurrentDone ? 'Đã hoàn thành' : 'Đánh dấu hoàn thành'}
            </Button>
          )}
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
                  const isLocked = !isAdmin && unit.locked === true
                  return (
                    <div
                      key={unit.id}
                      onClick={() => handleSelectUnit(unit)}
                      className={isDone && !isActive ? 'unit-item-completed' : ''}
                      style={{
                        padding: '12px 16px',
                        cursor: isLocked ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        opacity: isLocked ? 0.55 : 1,
                        background: isActive
                          ? 'var(--primary-soft)'
                          : isDone
                          ? 'rgba(22, 163, 74, 0.12)'
                          : 'transparent',
                        borderLeft: isActive
                          ? '4px solid var(--primary)'
                          : isDone
                          ? '4px solid #16a34a'
                          : isLocked
                          ? '4px solid var(--border)'
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
                        {isDone ? <CheckCircleFilled style={{ fontSize: 15 }} /> : isLocked ? <LockOutlined style={{ fontSize: 13 }} /> : index + 1}
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
                        {isLocked && (
                          <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 2 }}>
                            Hoàn thành bài trước để mở khóa
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
                  {
                    key: 'theory',
                    label: (
                      <span>
                        <ReadOutlined /> Lý thuyết bài giảng
                      </span>
                    ),
                  },
                  {
                    key: 'code',
                    label: (
                      <span>
                        <ThunderboltOutlined /> Code mẫu & Chạy thử C++
                      </span>
                    ),
                  },
                  {
                    key: 'exercises',
                    label: (
                      <span>
                        <RocketOutlined /> Bài tập thực hành ({unitProblems.length})
                      </span>
                    ),
                  },
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
                  {/* TAB 1: LÝ THUYẾT */}
                  {activeTab === 'theory' && (
                    <Card
                      style={{
                        borderRadius: 12,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                        border: '1px solid var(--border)',
                        maxWidth: 1080,
                        margin: '0 auto',
                      }}
                      styles={{ body: { padding: '28px 36px' } }}
                    >
                      {lessonData?.theoryContent ? (
                        <MarkdownViewer content={lessonData.theoryContent} />
                      ) : (
                        <Empty
                          image={Empty.PRESENTED_IMAGE_SIMPLE}
                          description={
                            <span>
                              Nội dung lý thuyết đang được cập nhật.
                              {isAdmin && <><br /><Typography.Text type="secondary" style={{ fontSize: 12 }}>Nhấn <b>Chỉnh sửa khóa học</b> để thêm lý thuyết cho chủ đề này.</Typography.Text></>}
                            </span>
                          }
                        />
                      )}
                    </Card>
                  )}

                  {/* TAB 2: CODE MẪU & CHẠY THỬ */}
                  {activeTab === 'code' && (
                    <div style={{ maxWidth: 1180, margin: '0 auto' }}>
                      <Card
                        title={
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <CodeOutlined style={{ color: '#2563eb' }} />
                              <span style={{ fontWeight: 600 }}>Mã nguồn C++ mẫu</span>
                            </div>
                            <Space>
                              <Button icon={<CopyOutlined />} onClick={handleCopyCode}>
                                Sao chép code
                              </Button>
                              <Link
                                to="/playground"
                                state={{ code: currentCode, input: currentInput }}
                              >
                                <Button icon={<ThunderboltOutlined />}>
                                  Mở trong Playground đầy đủ
                                </Button>
                              </Link>
                            </Space>
                          </div>
                        }
                        style={{ borderRadius: 12, marginBottom: 20 }}
                        styles={{ body: { padding: 0 } }}
                      >
                        <div style={{ height: 320 }}>
                          <CodeEditor
                            value={currentCode}
                            onChange={setEditedCode}
                            language="cpp"
                          />
                        </div>
                      </Card>

                      {/* Trình chạy trực tiếp */}
                      <Card
                        title={
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontWeight: 600 }}>Thử nghiệm đầu vào & Kết quả thực thi</span>
                            <Button
                              type="primary"
                              icon={<CaretRightOutlined />}
                              loading={codeRunning}
                              onClick={handleRunCode}
                              style={{ background: '#16a34a', borderColor: '#16a34a' }}
                            >
                              Chạy thử code
                            </Button>
                          </div>
                        }
                        style={{ borderRadius: 12 }}
                      >
                        <Row gutter={16}>
                          <Col span={10}>
                            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, color: 'var(--text-2)' }}>
                              Dữ liệu đầu vào (STDIN):
                            </div>
                            <Input.TextArea
                              rows={5}
                              value={currentInput}
                              onChange={(e) => setEditedInput(e.target.value)}
                              placeholder="Nhập dữ liệu test (nếu có)..."
                              style={{ fontFamily: 'var(--mono)', fontSize: 13 }}
                            />
                          </Col>

                          <Col span={14}>
                            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, color: 'var(--text-2)' }}>
                              Kết quả đầu ra (STDOUT):
                            </div>
                            <div
                              style={{
                                height: 115,
                                padding: '10px 14px',
                                background: 'var(--surface)',
                                color: 'var(--text)',
                                border: '1px solid var(--border)',
                                borderRadius: 8,
                                fontFamily: 'var(--mono)',
                                fontSize: 13,
                                overflow: 'auto',
                                whiteSpace: 'pre-wrap',
                              }}
                            >
                              {runResult ? (
                                runResult.output || (
                                  <span style={{ color: 'var(--muted)', fontStyle: 'italic' }}>
                                    (Không có dữ liệu in ra màn hình)
                                  </span>
                                )
                              ) : (
                                <span style={{ color: 'var(--muted)' }}>
                                  Bấm "Chạy thử code" để xem kết quả xuất ra màn hình...
                                </span>
                              )}
                            </div>

                            {runResult && (
                              <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
                                <VerdictTag verdict={runResult.verdict} />
                                <span style={{ fontSize: 12, color: 'var(--text-2)' }}>
                                  Thời gian: <b>{formatTime(runResult.timeMs)}</b>
                                </span>
                                <span style={{ fontSize: 12, color: 'var(--text-2)' }}>
                                  Bộ nhớ: <b>{formatMemory(runResult.memoryKb)}</b>
                                </span>
                              </div>
                            )}

                            {runResult?.stderr && (
                              <Alert
                                type="error"
                                showIcon
                                message="Thông báo lỗi biên dịch / runtime"
                                description={
                                  <pre style={{ margin: 0, maxHeight: 100, overflow: 'auto', fontSize: 12 }}>
                                    {runResult.stderr}
                                  </pre>
                                }
                                style={{ marginTop: 10 }}
                              />
                            )}
                          </Col>
                        </Row>
                      </Card>
                    </div>
                  )}

                  {/* TAB 3: BÀI TẬP THỰC HÀNH */}
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

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {nextUnit ? (
                <Button
                  type="primary"
                  icon={<RightOutlined />}
                  onClick={handleCompleteAndNext}
                  style={{
                    display: 'flex',
                    flexDirection: 'row-reverse',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  {isCurrentDone ? `Bài tiếp theo (${nextUnit.title})` : `Hoàn thành & Tiếp theo`}
                </Button>
              ) : (
                <Button
                  type="primary"
                  icon={<TrophyOutlined />}
                  style={{ background: '#16a34a', borderColor: '#16a34a' }}
                  onClick={() => message.success('Bạn đã đến bài học cuối cùng của khóa học!')}
                >
                  {isCurrentDone ? 'Đã hoàn thành toàn bộ khóa học!' : 'Hoàn thành khóa học'}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
