import { useCallback, useEffect, useState } from 'react'
import {
  App,
  Badge,
  Button,
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
  CaretRightOutlined,
  CloudUploadOutlined,
  CopyOutlined,
  EllipsisOutlined,
  FolderOpenOutlined,
  LoadingOutlined,
} from '@ant-design/icons'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth/context'
import { useFetch, useLiveSubmission, useNow, useSocket } from '../lib/hooks'
import { DIFFICULTIES } from '../lib/verdicts'
import { formatMemory, formatRelative, formatTime } from '../lib/format'
import { SAMPLE_SOURCES, STARTER_CODE } from '../api/mock/data'
import CodeEditor from '../components/CodeEditor'
import CustomTestRunner from '../components/CustomTestRunner'
import ResultSummary from '../components/ResultSummary'
import TestResults from '../components/TestResults'
import VerdictTag from '../components/VerdictTag'
import ContestClock from '../components/ContestClock'

const DIFF_COLOR = { easy: 'green', medium: 'gold', hard: 'red' }
const draftKey = (pid, uid) => `cj.draft.${uid}.${pid}`

function readDraft(pid, uid) {
  try {
    const val = localStorage.getItem(draftKey(pid, uid))
    // Nếu draft cũ là code A+B nhưng bài hiện tại không phải bài 1, dọn dẹp để nạp template sạch
    if (val && Number(pid) !== 1 && val.includes('cin >> a >> b') && val.includes('cout << a + b')) {
      localStorage.removeItem(draftKey(pid, uid))
      return null
    }
    return val
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
      <div className="limits-inline">
        <span>
          Thời gian: <b>{problem.timeLimitMs / 1000} s</b>
        </span>
        <span>
          Bộ nhớ: <b>{problem.memoryLimitMb} MB</b>
        </span>
        <span>
          {problem.tags.map((t) => (
            <Tag key={t} variant="filled" style={{ marginInlineEnd: 4 }}>
              {t}
            </Tag>
          ))}
        </span>
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

function MySubmissions({ problemId, userId, contestId, onPick, refreshKey }) {
  const now = useNow(15000)
  const { data, loading } = useFetch(
    () => api.listSubmissions({ userId, problemId, contestId }),
    [problemId, userId, contestId, refreshKey],
  )
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
          render: (id) => <span className="mono">#{id}</span>,
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

/** contest/label có giá trị khi làm bài trong kỳ thi (route /contests/:cid/problems/:label). */
export function Workspace({ id, contest, label }) {
  const { user } = useAuth()
  const { message, modal } = App.useApp()
  const navigate = useNavigate()
  const { data: problem, error, loading } = useFetch(() => api.getProblem(id), [id])
  const [code, setCode] = useState(() => readDraft(id, user.id) ?? STARTER_CODE)
  const [cursor, setCursor] = useState({ line: 1, col: 1 })
  const [submitting, setSubmitting] = useState(false)
  const [activeId, setActiveId] = useState(null)
  const [tab, setTab] = useState('testcase')
  const [refreshKey, setRefreshKey] = useState(0)
  const [customInput, setCustomInput] = useState(null)
  const [runningTest, setRunningTest] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const { sub: active } = useLiveSubmission(activeId)

  const activeInput = customInput ?? (problem?.samples?.[0]?.input || '')

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
    if (contest && Date.now() > contest.endAt) {
      message.error('Kỳ thi đã kết thúc, không thể nộp bài')
      return
    }
    setSubmitting(true)
    setActiveId(null)
    setTab('result')
    try {
      const s = await api.submit({ problemId: Number(id), language: 'cpp17', sourceCode: code, contestId: contest?.id }, user)
      setActiveId(s.id)
      setTab('result')
      setRefreshKey((k) => k + 1)
    } catch (e) {
      message.error(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  const runTest = async (overrideInput, overrideExpected) => {
    if (!code.trim()) {
      message.warning('Mã nguồn đang trống')
      return
    }
    setRunningTest(true)
    setTab('testcase')
    const inVal = overrideInput !== undefined ? overrideInput : activeInput
    const expVal = overrideExpected !== undefined ? overrideExpected : ''
    try {
      const res = await api.runTest({
        problemId: Number(id),
        sourceCode: code,
        input: inVal,
        expectedOutput: expVal,
      })
      setTestResult(res)
    } catch (e) {
      message.error(e.message || 'Lỗi khi chạy thử')
    } finally {
      setRunningTest(false)
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
      title: 'Khôi phục mã ban đầu?',
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
        <Tooltip title={contest ? 'Về trang kỳ thi' : 'Danh sách bài'}>
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate(contest ? `/contests/${contest.id}` : '/problems')}
          />
        </Tooltip>
        {contest ? (
          <>
            <span className="title">
              <b>{label}.</b> {problem.title}
            </span>
            <Typography.Text type="secondary" ellipsis style={{ maxWidth: 260 }}>
              {contest.title}
            </Typography.Text>
          </>
        ) : (
          <>
            <span className="title">
              <span className="mono muted">#{problem.id}</span> {problem.title}
            </span>
            <Tag color={DIFF_COLOR[problem.difficulty]} style={{ margin: 0 }}>
              {DIFFICULTIES[problem.difficulty].label}
            </Tag>
          </>
        )}
        <span style={{ flex: 1 }} />
        {contest && <ContestClock contest={contest} compact />}
        <Tooltip title="Ctrl + Enter">
          <Button type="primary" icon={<CloudUploadOutlined />} loading={submitting || judging} onClick={submit}>
            {judging ? 'Đang chấm…' : 'Nộp bài'}
          </Button>
        </Tooltip>
      </div>

      <Splitter style={{ flex: 1, minHeight: 0 }}>
        <Splitter.Panel defaultSize="42%" min="24%" collapsible>
          <div className="pane">
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
                  <Typography.Text className="mono" style={{ fontSize: 12 }}>
                    solution.cpp <span className="muted">· C++17</span>
                  </Typography.Text>
                  <Space size={4}>
                    <Typography.Text type="secondary" className="mono" style={{ fontSize: 12, marginInlineEnd: 4 }}>
                      Dòng {cursor.line}, Cột {cursor.col}
                    </Typography.Text>
                    <Upload accept=".cpp,.cc,.cxx" showUploadList={false} beforeUpload={loadFile}>
                      <Button size="small" type="text" icon={<FolderOpenOutlined />}>
                        Tải tệp .cpp
                      </Button>
                    </Upload>
                    <Dropdown
                      trigger={['click']}
                      menu={{
                        items: [
                          {
                            key: 'samples',
                            label: 'Nạp mã mẫu',
                            children: Object.keys(SAMPLE_SOURCES).map((k) => ({
                              key: k,
                              label: <span className="mono">{k}</span>,
                            })),
                          },
                          { type: 'divider' },
                          { key: 'reset', label: 'Khôi phục mã ban đầu', danger: true },
                        ],
                        onClick: ({ key }) => {
                          if (key === 'reset') resetCode()
                          else setCode(SAMPLE_SOURCES[key])
                        },
                      }}
                    >
                      <Button size="small" type="text" icon={<EllipsisOutlined />} aria-label="Thao tác khác" />
                    </Dropdown>
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
                  items={[
                    {
                      key: 'testcase',
                      label: (
                        <span>
                          <CaretRightOutlined style={{ marginRight: 4, color: 'var(--primary)' }} />
                          Chạy thử
                        </span>
                      ),
                    },
                    {
                      key: 'result',
                      label: (
                        <Badge dot={!!judging} offset={[6, 0]}>
                          Kết quả nộp
                        </Badge>
                      ),
                    },
                    { key: 'history', label: 'Lịch sử nộp' },
                  ]}
                />
                <div className="pane-body" style={{ padding: '0 14px 14px' }}>
                  {tab === 'testcase' ? (
                    <CustomTestRunner
                      problem={problem}
                      running={runningTest}
                      result={testResult}
                      onRun={runTest}
                      input={activeInput}
                      setInput={setCustomInput}
                    />
                  ) : tab === 'result' ? (
                    active ? (
                      <Space orientation="vertical" size={14} style={{ width: '100%' }}>
                        <ResultSummary
                          submission={active}
                          problem={problem}
                          extra={
                            active.status === 'FINISHED' && (
                              <Link to={`/submissions/${active.id}`} style={{ fontSize: 12 }}>
                                Xem chi tiết →
                              </Link>
                            )
                          }
                        />
                        <TestResults submission={active} />
                      </Space>
                    ) : submitting || activeId ? (
                      <div className="result-summary tone-running">
                        <div className="result-title">
                          <LoadingOutlined /> Đang gửi bài…
                        </div>
                      </div>
                    ) : (
                      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Kết quả chấm sẽ hiện ở đây sau khi bạn nộp bài" />
                    )
                  ) : (
                    <MySubmissions
                      problemId={problem.id}
                      userId={user.id}
                      contestId={contest?.id}
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
