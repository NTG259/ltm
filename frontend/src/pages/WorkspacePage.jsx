import { useCallback, useEffect, useState } from 'react'
import {
  App,
  Button,
  Card,
  Dropdown,
  Empty,
  Result,
  Space,
  Spin,
  Splitter,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
  Upload,
} from 'antd'
import {
  ArrowLeftOutlined,
  CloudUploadOutlined,
  CopyOutlined,
  ExperimentOutlined,
  FileTextOutlined,
  FolderOpenOutlined,
  HistoryOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth/context'
import { useFetch, useLiveSubmission, useNow, useSocket } from '../lib/hooks'
import { DIFFICULTIES } from '../lib/verdicts'
import { formatMemory, formatRelative, formatTime } from '../lib/format'
import { SAMPLE_SOURCES, STARTER_CODE } from '../api/mock/data'
import CodeEditor from '../components/CodeEditor'
import JudgeProgress from '../components/JudgeProgress'
import TestResults from '../components/TestResults'
import VerdictTag from '../components/VerdictTag'

const DIFF_COLOR = { easy: 'green', medium: 'gold', hard: 'red' }
const draftKey = (pid, uid) => `cj.draft.${uid}.${pid}`

function readDraft(pid, uid) {
  try {
    return localStorage.getItem(draftKey(pid, uid))
  } catch {
    return null
  }
}

/** Hiển thị đoạn văn có `code` inline. */
function Rich({ text }) {
  return text
    .split('\n\n')
    .map((para, i) => (
      <p key={i}>
        {para.split(/(`[^`]+`)/).map((part, j) => (part.startsWith('`') ? <code key={j}>{part.slice(1, -1)}</code> : part))}
      </p>
    ))
}

function Statement({ problem }) {
  const { message } = App.useApp()
  const copy = (text) => {
    navigator.clipboard?.writeText(text).then(
      () => message.success('Đã sao chép'),
      () => message.error('Không sao chép được'),
    )
  }
  return (
    <div className="statement">
      <Space wrap size={6}>
        <Tag className="mono">#{problem.id}</Tag>
        <Tag color={DIFF_COLOR[problem.difficulty]}>{DIFFICULTIES[problem.difficulty].label}</Tag>
        {problem.tags.map((t) => (
          <Tag key={t} variant="filled">
            {t}
          </Tag>
        ))}
      </Space>
      <h2>{problem.title}</h2>
      <div className="limits">
        <div>
          <small>Thời gian</small>
          <b>{(problem.timeLimitMs / 1000).toFixed(2)} s</b>
        </div>
        <div>
          <small>Bộ nhớ</small>
          <b>{problem.memoryLimitMb} MB</b>
        </div>
        <div>
          <small>Vào / Ra</small>
          <b>stdin / stdout</b>
        </div>
        <div>
          <small>Ngôn ngữ</small>
          <b>C++17 (g++)</b>
        </div>
      </div>
      <Rich text={problem.statement} />
      <h3>Dữ liệu vào</h3>
      <Rich text={problem.inputSpec} />
      <h3>Kết quả</h3>
      <Rich text={problem.outputSpec} />
      {problem.samples.map((s, i) => (
        <div key={i}>
          <h3>Ví dụ {i + 1}</h3>
          <div className="io-grid">
            <div className="io-box">
              <div className="io-box-head">
                Input
                <Button
                  size="small"
                  type="text"
                  icon={<CopyOutlined />}
                  onClick={() => copy(s.input)}
                  aria-label="Sao chép input"
                />
              </div>
              <pre>{s.input}</pre>
            </div>
            <div className="io-box">
              <div className="io-box-head">Output</div>
              <pre>{s.output}</pre>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function MySubmissions({ problemId, userId, onPick, refreshKey }) {
  const now = useNow(15000)
  const { data, loading } = useFetch(() => api.listSubmissions({ userId, problemId }), [problemId, userId, refreshKey])
  return (
    <Table
      size="small"
      rowKey="id"
      loading={loading}
      dataSource={data || []}
      pagination={{ pageSize: 6, size: 'small' }}
      locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa nộp bài nào" /> }}
      onRow={(r) => ({ onClick: () => onPick(r.id), style: { cursor: 'pointer' } })}
      columns={[
        {
          title: 'ID',
          dataIndex: 'id',
          render: (id) => (
            <Link to={`/submissions/${id}`} className="mono">
              #{id}
            </Link>
          ),
        },
        { title: 'Kết quả', render: (_, r) => <VerdictTag submission={r} /> },
        { title: 'Điểm', dataIndex: 'score', render: (v) => v ?? '—' },
        { title: 'Thời gian', dataIndex: 'timeMs', render: (v) => <span className="mono">{formatTime(v)}</span> },
        { title: 'Bộ nhớ', dataIndex: 'memoryKb', render: (v) => <span className="mono">{formatMemory(v)}</span> },
        { title: 'Nộp lúc', dataIndex: 'createdAt', render: (v) => formatRelative(v, now) },
      ]}
    />
  )
}

function Workspace({ id }) {
  const { user } = useAuth()
  const { message, modal } = App.useApp()
  const navigate = useNavigate()
  const { data: problem, error, loading } = useFetch(() => api.getProblem(id), [id])
  const [code, setCode] = useState(() => readDraft(id, user.id) ?? STARTER_CODE)
  const [cursor, setCursor] = useState({ line: 1, col: 1 })
  const [submitting, setSubmitting] = useState(false)
  const [activeId, setActiveId] = useState(null)
  const [tab, setTab] = useState('result')
  const [refreshKey, setRefreshKey] = useState(0)
  const { sub: active } = useLiveSubmission(activeId)

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem(draftKey(id, user.id), code)
      } catch {
        /* ignore */
      }
    }, 400)
    return () => clearTimeout(t)
  }, [code, id, user.id])

  // Làm mới lịch sử nộp khi một bài của chính mình chấm xong.
  useSocket(
    useCallback(
      (msg) => {
        if (msg.type === 'SUBMISSION_UPDATE' && msg.submission.userId === user.id && msg.submission.status === 'FINISHED') {
          setRefreshKey((k) => k + 1)
        }
      },
      [user.id],
    ),
  )

  const submit = async () => {
    if (!code.trim()) {
      message.warning('Mã nguồn đang trống')
      return
    }
    setSubmitting(true)
    try {
      const s = await api.submit({ problemId: Number(id), language: 'cpp17', sourceCode: code }, user)
      setActiveId(s.id)
      setTab('result')
      setRefreshKey((k) => k + 1)
      message.success(`Đã nộp bài #${s.id} – đang chờ chấm`)
    } catch (e) {
      message.error(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  const loadFile = (file) => {
    if (!/\.(cpp|cc|cxx|h|hpp)$/i.test(file.name)) {
      message.error('Chỉ chấp nhận tệp .cpp')
      return Upload.LIST_IGNORE
    }
    if (file.size > 256 * 1024) {
      message.error('Tệp vượt quá 256 KB')
      return Upload.LIST_IGNORE
    }
    file.text().then((text) => {
      setCode(text.replace(/\r\n/g, '\n'))
      message.success(`Đã nạp ${file.name}`)
    })
    return false
  }

  const resetCode = () =>
    modal.confirm({
      title: 'Khôi phục mã nguồn mẫu?',
      content: 'Mã hiện tại trong trình soạn thảo sẽ bị thay thế.',
      okText: 'Khôi phục',
      cancelText: 'Huỷ',
      onOk: () => setCode(STARTER_CODE),
    })

  if (loading) return <Spin style={{ display: 'block', margin: 80 }} />
  if (error)
    return (
      <Result
        status="404"
        title="Không tìm thấy đề bài"
        extra={<Button onClick={() => navigate('/problems')}>Về danh sách</Button>}
      />
    )

  const marked =
    active?.verdict === 'CE' ? [...(active.compileLog || '').matchAll(/solution\.cpp:(\d+):/g)].map((m) => Number(m[1])) : []
  const judging = active && active.status !== 'FINISHED'

  return (
    <div className="workspace">
      <div className="workspace-bar">
        <Tooltip title="Danh sách bài">
          <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/problems')} />
        </Tooltip>
        <span className="title">
          <span className="mono muted">#{problem.id}</span> {problem.title}
        </span>
        <span style={{ flex: 1 }} />
        <Dropdown
          menu={{
            items: Object.keys(SAMPLE_SOURCES).map((k) => ({ key: k, label: <span className="mono">samples/{k}</span> })),
            onClick: ({ key }) => {
              setCode(SAMPLE_SOURCES[key])
              message.info(`Đã nạp samples/${key}`)
            },
          }}
        >
          <Button icon={<ExperimentOutlined />}>Mã mẫu</Button>
        </Dropdown>
        <Upload accept=".cpp,.cc,.cxx" showUploadList={false} beforeUpload={loadFile}>
          <Button icon={<FolderOpenOutlined />}>Tải tệp .cpp</Button>
        </Upload>
        <Tooltip title="Ctrl + Enter">
          <Button type="primary" icon={<CloudUploadOutlined />} loading={submitting} onClick={submit}>
            Nộp bài
          </Button>
        </Tooltip>
      </div>

      <Splitter style={{ flex: 1, minHeight: 0 }}>
        <Splitter.Panel defaultSize="42%" min="24%" collapsible>
          <div className="pane">
            <div className="pane-head">
              <Space>
                <FileTextOutlined />
                <Typography.Text strong>Đề bài</Typography.Text>
              </Space>
            </div>
            <div className="pane-body">
              <Statement problem={problem} />
            </div>
          </div>
        </Splitter.Panel>
        <Splitter.Panel min="30%">
          <Splitter orientation="vertical">
            <Splitter.Panel defaultSize="58%" min="20%">
              <div className="pane">
                <div className="pane-head">
                  <Space size={8}>
                    <Tag color="blue" className="mono" style={{ margin: 0 }}>
                      solution.cpp
                    </Tag>
                    <Typography.Text type="secondary" className="mono" style={{ fontSize: 12 }}>
                      C++17 · g++ -O2
                    </Typography.Text>
                  </Space>
                  <Space size={8}>
                    <Typography.Text type="secondary" className="mono" style={{ fontSize: 12 }}>
                      Dòng {cursor.line}, Cột {cursor.col} · {code.split('\n').length} dòng
                    </Typography.Text>
                    <Tooltip title="Khôi phục mã mẫu">
                      <Button size="small" type="text" icon={<ReloadOutlined />} onClick={resetCode} />
                    </Tooltip>
                  </Space>
                </div>
                <div className="pane-body" style={{ overflow: 'hidden' }}>
                  <CodeEditor value={code} onChange={setCode} onSubmit={submit} onCursor={setCursor} markedLines={marked} />
                </div>
              </div>
            </Splitter.Panel>
            <Splitter.Panel min="15%">
              <div className="pane">
                <Tabs
                  activeKey={tab}
                  onChange={setTab}
                  size="small"
                  style={{ padding: '0 12px' }}
                  tabBarExtraContent={judging ? <Tag color="processing">Đang chấm realtime</Tag> : null}
                  items={[
                    { key: 'result', label: 'Kết quả chấm' },
                    { key: 'history', label: 'Lịch sử nộp', icon: <HistoryOutlined /> },
                  ]}
                />
                <div className="pane-body" style={{ padding: '0 14px 14px' }}>
                  {tab === 'result' ? (
                    active ? (
                      <Space orientation="vertical" size={14} style={{ width: '100%' }}>
                        <Card size="small">
                          <JudgeProgress submission={active} />
                        </Card>
                        <TestResults submission={active} />
                        {active.status === 'FINISHED' && (
                          <Link to={`/submissions/${active.id}`}>Xem chi tiết bài nộp #{active.id} →</Link>
                        )}
                      </Space>
                    ) : (
                      <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description="Nộp bài để xem tiến trình chấm từng test case theo thời gian thực"
                      />
                    )
                  ) : (
                    <MySubmissions
                      problemId={problem.id}
                      userId={user.id}
                      refreshKey={refreshKey}
                      onPick={(sid) => {
                        setActiveId(sid)
                        setTab('result')
                      }}
                    />
                  )}
                </div>
              </div>
            </Splitter.Panel>
          </Splitter>
        </Splitter.Panel>
      </Splitter>
    </div>
  )
}

// key={id} để reset trình soạn thảo khi chuyển sang đề khác.
export default function WorkspacePage() {
  const { id } = useParams()
  return <Workspace key={id} id={id} />
}
