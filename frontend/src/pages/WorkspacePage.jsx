import { useCallback, useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
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
  SafetyCertificateOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth/context'
import { useFetch, useLiveSubmission, useNow, useSocket } from '../lib/hooks'
import { useProctoring } from '../lib/useProctoring'
import { DIFFICULTIES } from '../lib/verdicts'
import { formatMemory, formatRelative, formatTime } from '../lib/format'
import { SAMPLE_SOURCES, STARTER_CODE } from '../api/mock/data'
import CodeEditor from '../components/CodeEditor'
import CustomTestRunner from '../components/CustomTestRunner'
import ResultSummary from '../components/ResultSummary'
import TestResults from '../components/TestResults'
import VerdictTag from '../components/VerdictTag'
import ContestClock from '../components/ContestClock'

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
  return <ReactMarkdown>{text || ''}</ReactMarkdown>
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
          width: 80,
          render: (id) => (
            <Link
              to={`/submissions/${id}`}
              target="_blank"
              onClick={(e) => e.stopPropagation()}
              className="mono"
              style={{ fontWeight: 600 }}
              title="Mở trang chi tiết bài nộp này"
            >
              #{id}
            </Link>
          ),
        },
        { title: 'Kết quả', render: (_, r) => <VerdictTag submission={r} /> },
        { title: 'Điểm', dataIndex: 'score', width: 65, render: (v) => v ?? '—' },
        { title: 'Thời gian', dataIndex: 'timeMs', width: 85, render: (v) => <span className="mono">{formatTime(v)}</span> },
        { title: 'Bộ nhớ', dataIndex: 'memoryKb', width: 80, render: (v) => <span className="mono">{formatMemory(v)}</span> },
        { title: 'Nộp lúc', dataIndex: 'createdAt', render: (v) => formatRelative(v, now) },
        {
          title: '',
          key: 'action',
          width: 85,
          align: 'right',
          render: (_, r) => (
            <Link
              to={`/submissions/${r.id}`}
              target="_blank"
              onClick={(e) => e.stopPropagation()}
              style={{ fontSize: 12, fontWeight: 500 }}
            >
              Xem bài ↗
            </Link>
          ),
        },
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
  const [language, setLanguage] = useState('cpp17')
  const [customInput, setCustomInput] = useState(null)
  const [runningTest, setRunningTest] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const { data: availableLanguages } = useFetch(() => api.languages(), [])
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

  const handleViolation = useCallback(
    (count, type) => {
      modal.warning({
        title: '⚠️ CẢNH BÁO GIÁM SÁT THI CỬ',
        centered: true,
        okText: 'Tôi hiểu và tiếp tục làm bài',
        okButtonProps: { danger: true },
        content: (
          <div style={{ marginTop: 8 }}>
            <p style={{ color: '#ef4444', fontWeight: 600 }}>
              Hệ thống phát hiện bạn vừa rời khỏi màn hình làm bài thi!
            </p>
            <ul style={{ paddingLeft: 20, margin: '8px 0', color: 'var(--text-2)' }}>
              <li>
                Hành vi:{' '}
                <b>{type === 'TAB_SWITCH' ? 'Chuyển tab / Thu nhỏ trình duyệt' : 'Mất tiêu điểm cửa sổ làm bài'}</b>
              </li>
              <li>
                Số lần vi phạm đã ghi nhận: <b style={{ color: '#ef4444', fontSize: 16 }}>{count}</b> lần
              </li>
            </ul>
            <p style={{ fontSize: 12, color: 'var(--muted)', margin: 0 }}>
              Hành vi này đã được gửi trực tiếp tới Giám thị phòng thi theo thời gian thực.
              Vui lòng không chuyển tab hoặc mở ứng dụng khác để tránh bị huỷ tư cách dự thi.
            </p>
          </div>
        ),
      })
    },
    [modal],
  )

  const { violationCount } = useProctoring({
    contest,
    user,
    enabled: !!contest && !user?.role?.includes('admin'),
    onViolation: handleViolation,
  })

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
      const s = await api.submit({ problemId: Number(id), language, sourceCode: code, contestId: contest?.id }, user)
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
        language,
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

  const LANG_EXT = {
    cpp17: /\.(cpp|cc|cxx|h|hpp)$/i,
  }
  const loadFile = (file) => {
    const pattern = LANG_EXT[language] || LANG_EXT.cpp17
    if (!pattern.test(file.name)) {
      message.error(`Ngôn ngữ ${language} không nhận tệp này`)
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
            <span className={`diff-pill diff-pill-${problem.difficulty}`} style={{ margin: 0 }}>
              {DIFFICULTIES[problem.difficulty].label}
            </span>
          </>
        )}
        <span style={{ flex: 1 }} />
        {contest && (
          <Space size={8}>
            {violationCount > 0 ? (
              <Tooltip title={`Hệ thống ghi nhận bạn đã rời màn hình thi ${violationCount} lần`}>
                <Tag color="error" icon={<WarningOutlined />} style={{ fontWeight: 600 }}>
                  Vi phạm: {violationCount} lần
                </Tag>
              </Tooltip>
            ) : (
              <Tooltip title="Chế độ giám sát thi đang bật">
                <Tag color="success" icon={<SafetyCertificateOutlined />}>
                  Giám sát: Nghiêm túc
                </Tag>
              </Tooltip>
            )}
            <ContestClock contest={contest} compact />
          </Space>
        )}
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ display: 'flex', gap: 5, marginRight: 2 }}>
                      <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#ef4444', opacity: 0.8 }} />
                      <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#f59e0b', opacity: 0.8 }} />
                      <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#10b981', opacity: 0.8 }} />
                    </div>
                    <Dropdown
                      trigger={['click']}
                      menu={{
                        items: (availableLanguages || [{ code: 'cpp17', label: 'C++17' }]).map((l) => ({
                          key: l.code,
                          label: <span className="mono">{l.label}</span>,
                        })),
                        selectedKeys: [language],
                        onClick: ({ key }) => setLanguage(key),
                      }}
                    >
                      <Typography.Text
                        className="mono"
                        style={{ fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}
                        title="Chọn ngôn ngữ"
                      >
                        {(availableLanguages || []).find((l) => l.code === language)?.label ?? 'C++17'}
                        <span className="muted" style={{ fontWeight: 400, marginLeft: 4 }}>▾</span>
                      </Typography.Text>
                    </Dropdown>
                  </div>
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
                              <Space size={8} wrap>
                                {active.sourceCode && (
                                  <Button
                                    size="small"
                                    onClick={() => {
                                      setCode(active.sourceCode)
                                      message.success(`Đã nạp lại mã của bài nộp #${active.id} vào trình soạn thảo`)
                                    }}
                                  >
                                    Nạp code này vào editor
                                  </Button>
                                )}
                                <Link to={`/submissions/${active.id}`} target="_blank" style={{ fontSize: 12 }}>
                                  Xem toàn bộ bài nộp ↗
                                </Link>
                              </Space>
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
