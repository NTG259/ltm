import { App, Breadcrumb, Button, Card, Col, Descriptions, Result, Row, Space, Spin, Tag, Timeline, Typography } from 'antd'
import { ArrowLeftOutlined, CopyOutlined, DownloadOutlined, EditOutlined } from '@ant-design/icons'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth/context'
import { useLiveSubmission } from '../lib/hooks'
import { formatClock, formatDateTime } from '../lib/format'
import CodeEditor from '../components/CodeEditor'
import TestResults from '../components/TestResults'
import VerdictTag from '../components/VerdictTag'

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
  const { user, isAdmin, isLecturer } = useAuth()
  const { sub: s, error } = useLiveSubmission(id)
  const { message } = App.useApp()
  const navigate = useNavigate()

  if (error)
    return <Result status="404" title="Không tìm thấy bài nộp" extra={<Button onClick={() => navigate(-1)}>Quay lại</Button>} />
  if (!s) return <Spin style={{ display: 'block', margin: 80 }} />
  if (!isAdmin && !isLecturer && s.userId !== user.id) return <Result status="403" title="Bạn không có quyền xem bài nộp này" />

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

  const returnPath = isAdmin ? '/admin/submissions' : isLecturer ? '/teacher/submissions' : '/submissions'

  return (
    <div className="page">
      <div style={{ marginBottom: 16 }}>
        <Breadcrumb
          style={{ marginBottom: 10 }}
          items={[
            { title: <Link to={returnPath}>Danh sách bài nộp</Link> },
            { title: <span className="mono">Bài nộp #{s.id}</span> },
          ]}
        />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <Space size={12} align="center">
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(returnPath)}>
              Quay lại
            </Button>
            <Typography.Title level={4} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span>Bài nộp #{s.id}</span>
              <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>·</span>
              <Link to={`/problems/${s.problemId}`} style={{ color: 'inherit' }}>
                #{s.problemId}. {s.problemTitle}
              </Link>
            </Typography.Title>
          </Space>
          <VerdictTag submission={s} size="large" full />
        </div>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            {(s.tests?.length > 0 || ['CE', 'SEC'].includes(s.verdict)) && (
              <Card title="Test case">
                <TestResults submission={s} />
              </Card>
            )}
            <Card
              title={
                <Space>
                  <span className="mono" style={{ fontWeight: 600 }}>solution.cpp</span>
                  <Tag color="blue">{s.language || 'cpp17'}</Tag>
                </Space>
              }
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
              <div style={{ height: '500px', minHeight: '400px', width: '100%' }}>
                <CodeEditor value={s.sourceCode} readOnly markedLines={marked} height="500px" minHeight="400px" />
              </div>
            </Card>
          </Space>
        </Col>

        <Col xs={24} lg={8}>
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Card title="Thông tin">
              <Descriptions
                column={1}
                size="small"
                items={[
                  {
                    key: 'p',
                    label: 'Đề bài',
                    children: (
                      <span>
                        #{s.problemId} · {s.problemTitle}{' '}
                        <Link to={`/problems/${s.problemId}`} target="_blank" style={{ fontSize: 12, marginLeft: 6 }}>
                          [Xem đề ↗]
                        </Link>
                      </span>
                    ),
                  },
                  {
                    key: 'u',
                    label: 'Thí sinh',
                    children: (
                      <span>
                        {s.userName || s.userId}
                        {s.userName && s.userName !== s.userId && (
                          <Typography.Text type="secondary" className="mono" style={{ marginLeft: 6 }}>
                            ({s.userId})
                          </Typography.Text>
                        )}
                      </span>
                    ),
                  },
                  { key: 'l', label: 'Ngôn ngữ', children: <span className="mono">{s.language || 'cpp17'} · g++ -O2</span> },
                  { key: 'c', label: 'Nộp lúc', children: formatDateTime(s.createdAt) },
                ]}
              />
            </Card>

            {(isAdmin || isLecturer) && (
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
            )}
          </Space>
        </Col>
      </Row>
    </div>
  )
}
