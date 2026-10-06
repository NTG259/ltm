import { App, Breadcrumb, Button, Card, Col, Descriptions, Result, Row, Space, Spin, Timeline, Typography } from 'antd'
import { CopyOutlined, DownloadOutlined, EditOutlined } from '@ant-design/icons'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth/context'
import { useLiveSubmission } from '../lib/hooks'
import { formatClock, formatDateTime, formatMemory, formatTime } from '../lib/format'
import CodeEditor from '../components/CodeEditor'
import JudgeProgress from '../components/JudgeProgress'
import TestResults from '../components/TestResults'

const HISTORY_COLOR = {
  IN_QUEUE: 'gray',
  ASSIGNED: 'blue',
  COMPILING: 'blue',
  TESTING: 'blue',
  SCAN: 'red',
  FAILOVER: 'orange',
  FINISHED: 'green',
}

export default function SubmissionDetailPage() {
  const { id } = useParams()
  const { user, isAdmin } = useAuth()
  const { sub: s, error } = useLiveSubmission(id)
  const { message } = App.useApp()
  const navigate = useNavigate()

  if (error)
    return <Result status="404" title="Không tìm thấy bài nộp" extra={<Button onClick={() => navigate(-1)}>Quay lại</Button>} />
  if (!s) return <Spin style={{ display: 'block', margin: 80 }} />
  if (!isAdmin && s.userId !== user.id) return <Result status="403" title="Bạn không có quyền xem bài nộp này" />

  const download = () => {
    const url = URL.createObjectURL(new Blob([s.sourceCode], { type: 'text/x-c++src' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `submission-${s.id}.cpp`
    a.click()
    URL.revokeObjectURL(url)
  }
  const marked = s.verdict === 'CE' ? [...(s.compileLog || '').matchAll(/solution\.cpp:(\d+):/g)].map((m) => Number(m[1])) : []
  // Tô dòng có lời gọi bị cấm khi SEC.
  if (s.verdict === 'SEC') {
    s.sourceCode
      .split('\n')
      .forEach((l, i) => /windows\.h|system\s*\(|fork\s*\(|exec|popen|unistd|socket\.h/.test(l) && marked.push(i + 1))
  }

  return (
    <div className="page">
      <Breadcrumb
        style={{ marginBottom: 12 }}
        items={[
          { title: <Link to={isAdmin ? '/admin/submissions' : '/submissions'}>Bài nộp</Link> },
          { title: <span className="mono">#{s.id}</span> },
        ]}
      />
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Space orientation="vertical" size={16} style={{ width: '100%' }}>
            <Card>
              <JudgeProgress submission={s} />
            </Card>
            <Card title="Kết quả từng test case">
              <TestResults submission={s} />
            </Card>
            <Card
              title={<span className="mono">solution.cpp</span>}
              extra={
                <Space>
                  <Button
                    size="small"
                    icon={<CopyOutlined />}
                    onClick={() => navigator.clipboard?.writeText(s.sourceCode).then(() => message.success('Đã sao chép mã'))}
                  >
                    Sao chép
                  </Button>
                  <Button size="small" icon={<DownloadOutlined />} onClick={download}>
                    Tải .cpp
                  </Button>
                  {!isAdmin && (
                    <Button
                      size="small"
                      type="primary"
                      icon={<EditOutlined />}
                      onClick={() => {
                        try {
                          localStorage.setItem(`cj.draft.${user.id}.${s.problemId}`, s.sourceCode)
                        } catch {
                          /* ignore */
                        }
                        navigate(`/problems/${s.problemId}`)
                      }}
                    >
                      Sửa & nộp lại
                    </Button>
                  )}
                </Space>
              }
              styles={{ body: { padding: 0 } }}
            >
              <CodeEditor value={s.sourceCode} readOnly markedLines={marked} />
            </Card>
          </Space>
        </Col>
        <Col xs={24} lg={8}>
          <Space orientation="vertical" size={16} style={{ width: '100%' }}>
            <Card title="Thông tin">
              <Descriptions
                column={1}
                size="small"
                items={[
                  {
                    key: 'p',
                    label: 'Bài',
                    children: (
                      <Link to={`/problems/${s.problemId}`}>
                        #{s.problemId} {s.problemTitle}
                      </Link>
                    ),
                  },
                  {
                    key: 'u',
                    label: 'Thí sinh',
                    children: (
                      <span>
                        {s.userName}{' '}
                        <Typography.Text type="secondary" className="mono">
                          ({s.userId})
                        </Typography.Text>
                      </span>
                    ),
                  },
                  { key: 'l', label: 'Ngôn ngữ', children: <span className="mono">{s.language} · g++ -O2</span> },
                  { key: 't', label: 'Thời gian chạy', children: <span className="mono">{formatTime(s.timeMs)}</span> },
                  { key: 'm', label: 'Bộ nhớ', children: <span className="mono">{formatMemory(s.memoryKb)}</span> },
                  { key: 'w', label: 'Worker', children: <span className="mono">{s.workerId || '—'}</span> },
                  { key: 'c', label: 'Nộp lúc', children: formatDateTime(s.createdAt) },
                ]}
              />
            </Card>
            <Card title="Dòng thời gian xử lý">
              <Timeline
                items={(s.history || [])
                  .filter((h, i, arr) => !(h.status === 'TESTING' && arr[i + 1]?.status === 'TESTING'))
                  .map((h, i) => ({
                    key: i,
                    color: HISTORY_COLOR[h.status] || 'gray',
                    title: (
                      <span className="mono" style={{ fontSize: 12 }}>
                        {formatClock(h.time)}
                      </span>
                    ),
                    content: (
                      <div>
                        <Typography.Text strong className="mono" style={{ fontSize: 12 }}>
                          {h.status}
                        </Typography.Text>
                        {h.workerId && (
                          <Typography.Text type="secondary" className="mono" style={{ fontSize: 12 }}>
                            {' '}
                            @ {h.workerId}
                          </Typography.Text>
                        )}
                        <div style={{ fontSize: 13, color: 'var(--text-2)' }}>{h.note}</div>
                      </div>
                    ),
                  }))}
              />
            </Card>
          </Space>
        </Col>
      </Row>
    </div>
  )
}
