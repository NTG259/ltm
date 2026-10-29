import { useCallback, useEffect, useRef, useState } from 'react'
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
  FolderOpenOutlined,
  LoadingOutlined,
  PlusOutlined,
  RedoOutlined,
  SafetyCertificateOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import { Link, useBlocker, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth/context'
import { useFetch, useLiveSubmission, useNow, useSocket } from '../lib/hooks'
import { useProctoring } from '../lib/useProctoring'
import { DIFFICULTIES, VERDICTS } from '../lib/verdicts'
import { formatMemory, formatRelative, formatTime } from '../lib/format'
const STARTER_CODE = `#include <bits/stdc++.h>
using namespace std;

int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(nullptr);

    // TODO: Viết lời giải thuật toán tại đây

    return 0;
}
`
import CodeEditor from '../components/CodeEditor'
import CompilerErrorExplainer from '../components/CompilerErrorExplainer'
import TestResults from '../components/TestResults'
import VerdictTag from '../components/VerdictTag'
import ContestClock from '../components/ContestClock'

const draftKey = (pid, uid) => `cj.draft.${uid}.${pid}`

function readDraft(pid, uid) {
  try {
    const val = localStorage.getItem(draftKey(pid, uid))
    if (val && Number(pid) !== 1 && val.includes('cin >> a >> b') && val.includes('cout << a + b')) {
      localStorage.removeItem(draftKey(pid, uid))
      return null
    }
    return val
  } catch {
    return null
  }
}

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
        <span>Thời gian: <b>{problem.timeLimitMs / 1000} s</b></span>
        <span>Bộ nhớ: <b>{problem.memoryLimitMb} MB</b></span>
        <span>
          {problem.tags.map((t) => (
            <Tag key={t} variant="filled" style={{ marginInlineEnd: 4 }}>{t}</Tag>
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
                <Button size="small" type="text" icon={<CopyOutlined />} onClick={() => copy(s.input)} aria-label="Sao chép input" />
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
          width: 70,
          render: (id) => (
            <Link to={`/submissions/${id}`} target="_blank" onClick={(e) => e.stopPropagation()} className="mono" style={{ fontWeight: 600 }}>
              #{id}
            </Link>
          ),
        },
        { title: 'Kết quả', render: (_, r) => <VerdictTag submission={r} /> },
        { title: 'Điểm', dataIndex: 'score', width: 55, render: (v) => v ?? '—' },
        { title: 'Thời gian', dataIndex: 'timeMs', width: 80, render: (v) => <span className="mono">{formatTime(v)}</span> },
        { title: 'Nộp lúc', dataIndex: 'createdAt', render: (v) => formatRelative(v, now) },
        {
          title: '',
          key: 'action',
          width: 70,
          align: 'right',
          render: (_, r) => (
            <Link to={`/submissions/${r.id}`} target="_blank" onClick={(e) => e.stopPropagation()} style={{ fontSize: 12, fontWeight: 500 }}>
              Xem ↗
            </Link>
          ),
        },
      ]}
    />
  )
}

/** Panel testcase: chọn case + nhập input */
function TestcasePanel({ problem, input, setInput, selectedCase, setSelectedCase, onRun, running }) {
  const samples = problem?.samples || []

  const pickSample = (idx) => {
    setSelectedCase(idx)
    setInput(samples[idx]?.input || '')
  }

  return (
    <div style={{ display: 'grid', gap: 10, paddingTop: 4 }}>
      {/* Case tabs + Run button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', flex: 1 }}>
          {samples.map((_, idx) => (
            <button
              key={idx}
              type="button"
              className={`test-chip${selectedCase === idx ? ' selected' : ''}`}
              style={{
                background: selectedCase === idx ? 'var(--primary-soft)' : 'var(--inset)',
                borderColor: selectedCase === idx ? 'var(--primary)' : 'var(--border)',
                color: selectedCase === idx ? 'var(--primary)' : 'var(--text)',
              }}
              onClick={() => pickSample(idx)}
            >
              Case {idx + 1}
            </button>
          ))}
          <button
            type="button"
            className={`test-chip${selectedCase === 'custom' ? ' selected' : ''}`}
            style={{
              background: selectedCase === 'custom' ? 'var(--primary-soft)' : 'var(--inset)',
              borderColor: selectedCase === 'custom' ? 'var(--primary)' : 'var(--border)',
              color: selectedCase === 'custom' ? 'var(--primary)' : 'var(--text)',
            }}
            onClick={() => setSelectedCase('custom')}
          >
            <PlusOutlined style={{ fontSize: 10, marginRight: 3 }} />
            Tự nhập
          </button>
          {typeof selectedCase === 'number' && samples[selectedCase] && (
            <Tooltip title="Khôi phục dữ liệu ban đầu">
              <Button size="small" type="text" icon={<RedoOutlined />} onClick={() => pickSample(selectedCase)} />
            </Tooltip>
          )}
        </div>
        <Button type="primary" size="small" icon={<CaretRightOutlined />} loading={running} onClick={onRun}>
          {running ? 'Đang chạy…' : 'Chạy thử'}
        </Button>
      </div>

      {/* Input */}
      <div>
        <div style={{ fontSize: 12, color: 'var(--text-2)', fontWeight: 500, marginBottom: 5 }}>Input</div>
        <textarea
          className="custom-test-editor"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Nhập stdin cho chương trình…"
          rows={5}
          spellCheck={false}
        />
      </div>
    </div>
  )
}

function DiffText({ output, expected }) {
  if (!expected) return output
  const a = (output || '').split(/(\s+)/)
  const b = (expected || '').split(/(\s+)/)
  return a.map((tok, i) =>
    tok.trim() && tok !== b[i] ? <span key={i} className="diff-bad">{tok}</span> : tok,
  )
}

/** Panel kết quả: hiện kết quả chạy thử HOẶC kết quả nộp bài */
function TestResultPanel({ mode, running, testResult, active, submitting, problem, setCode, message }) {
  if (running) {
    return (
      <div className="result-summary tone-running" style={{ marginTop: 4 }}>
        <div className="result-title"><LoadingOutlined /> Đang biên dịch và chạy…</div>
      </div>
    )
  }

  // Kết quả nộp bài
  if (mode === 'submit') {
    if (submitting || (active && active.status !== 'FINISHED')) {
      return (
        <div className="result-summary tone-running" style={{ marginTop: 4 }}>
          <div className="result-title">
            <LoadingOutlined /> {submitting ? 'Đang gửi bài…' : active?.status === 'IN_QUEUE' ? 'Đang chờ chấm…' : 'Đang chấm…'}
          </div>
        </div>
      )
    }
    if (active) {
      return (
        <Space direction="vertical" size={10} style={{ width: '100%', paddingTop: 4 }}>
          <Space size={8} wrap>
            {active.sourceCode && (
              <Button size="small" onClick={() => {
                setCode(active.sourceCode)
                message.success(`Đã nạp lại mã bài nộp #${active.id}`)
              }}>
                Nạp code vào editor
              </Button>
            )}
            <Link to={`/submissions/${active.id}`} target="_blank" style={{ fontSize: 12 }}>
              Xem toàn bộ bài nộp ↗
            </Link>
          </Space>
          <TestResults submission={active} />
        </Space>
      )
    }
  }

  // Kết quả chạy thử
  if (mode === 'run' && testResult) {
    const meta = testResult.verdict ? VERDICTS[testResult.verdict] : null
    const isWA = testResult.verdict === 'WA'
    const isCE = testResult.verdict === 'CE'
    const isSEC = testResult.verdict === 'SEC'
    const hasExpected = !!testResult.hasExpected && !!testResult.expectedOutput

    return (
      <Space direction="vertical" size={10} style={{ width: '100%', paddingTop: 4 }}>
        <div className={`result-summary tone-${meta?.tone || 'ac'}`}>
          <div className="result-main">
            <div className="result-title">
              {hasExpected ? (meta?.label || testResult.verdict) : (testResult.verdict === 'AC' ? 'Thực thi thành công' : (meta?.label || testResult.verdict))}
            </div>
            <div style={{ fontSize: 13 }}>
              {testResult.verdict === 'AC' && (hasExpected ? 'Khớp kết quả mẫu.' : 'Chương trình đã chạy xong.')}
              {testResult.verdict === 'WA' && 'Kết quả không khớp đáp án mẫu.'}
              {testResult.verdict === 'TLE' && `Vượt giới hạn thời gian (${(problem?.timeLimitMs || 1000) / 1000}s).`}
              {testResult.verdict === 'MLE' && `Vượt giới hạn bộ nhớ (${problem?.memoryLimitMb || 256}MB).`}
              {testResult.verdict === 'RTE' && 'Lỗi khi chạy (Runtime Error).'}
              {testResult.verdict === 'CE' && 'Biên dịch thất bại.'}
              {testResult.verdict === 'SEC' && `Vi phạm bảo mật: ${testResult.securityMessage}`}
            </div>
          </div>
          {!isCE && !isSEC && (
            <div className="result-side">
              <div className="mono" style={{ fontSize: 13, fontWeight: 600 }}>
                {formatTime(testResult.timeMs)} · {formatMemory(testResult.memoryKb)}
              </div>
            </div>
          )}
        </div>

        {isCE && <CompilerErrorExplainer compileLog={testResult.compileLog} />}

        {!isCE && !isSEC && (
          <div className={hasExpected ? 'io-grid' : ''}>
            <div className={`io-box ${isWA ? 'bad' : 'good'}`}>
              <div className="io-box-head">Output</div>
              <pre>
                {testResult.output == null || testResult.output === '' ? (
                  <span className="muted">(Chương trình không in ra gì)</span>
                ) : isWA && testResult.expectedOutput ? (
                  <DiffText output={testResult.output} expected={testResult.expectedOutput} />
                ) : (
                  testResult.output
                )}
              </pre>
            </div>
            {hasExpected && testResult.expectedOutput && (
              <div className="io-box">
                <div className="io-box-head">Đáp án mẫu</div>
                <pre>{testResult.expectedOutput}</pre>
              </div>
            )}
          </div>
        )}

        {testResult.stderr && (
          <div className="io-box bad">
            <div className="io-box-head">stderr</div>
            <pre>{testResult.stderr}</pre>
          </div>
        )}
      </Space>
    )
  }

  return (
    <Empty
      image={Empty.PRESENTED_IMAGE_SIMPLE}
      description="Bấm 'Chạy thử' để xem kết quả hoặc 'Nộp bài' để chấm điểm"
      style={{ marginTop: 16 }}
    />
  )
}

export function Workspace({ id, contest, label }) {
  const { user } = useAuth()
  const { message, modal } = App.useApp()
  const navigate = useNavigate()
  const { data: problem, error, loading } = useFetch(() => api.getProblem(id), [id])
  const [code, setCode] = useState(() => readDraft(id, user.id) ?? STARTER_CODE)
  const [cursor, setCursor] = useState({ line: 1, col: 1 })
  const [submitting, setSubmitting] = useState(false)
  const [activeId, setActiveId] = useState(null)
  const [leftTab, setLeftTab] = useState('statement')
  const [bottomTab, setBottomTab] = useState('testcase')
  const [resultMode, setResultMode] = useState(null) // 'run' | 'submit'
  const [refreshKey, setRefreshKey] = useState(0)
  const [language, setLanguage] = useState('cpp17')
  const [selectedCase, setSelectedCase] = useState(0)
  const [customInput, setCustomInput] = useState(null)
  const [runningTest, setRunningTest] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const { data: availableLanguages } = useFetch(() => api.languages(), [])
  const { sub: active } = useLiveSubmission(activeId)
  const now = useNow(1000)
  const leaving = useRef(false)
  const examActive = !!contest && user.role === 'student' && now >= contest.startAt && now < contest.endAt
  const blocker = useBlocker(({ nextLocation }) =>
    examActive && !leaving.current &&
    !contest.problems.some((p) => nextLocation.pathname === `/contests/${contest.id}/problems/${p.label}`),
  )

  useEffect(() => {
    if (!examActive) return
    const warn = (event) => {
      if (leaving.current) return
      try {
        localStorage.setItem(draftKey(id, user.id), code)
      } catch { /* Vẫn cảnh báo nếu bộ nhớ trình duyệt đầy. */ }
      event.preventDefault()
      event.returnValue = ''
    }
    const preventLogout = (event) => {
      if (leaving.current) return
      event.preventDefault()
      message.warning('Hãy bấm “Hoàn thành” trước khi đăng xuất.')
    }
    window.addEventListener('beforeunload', warn)
    window.addEventListener('cj:before-logout', preventLogout)
    return () => {
      window.removeEventListener('beforeunload', warn)
      window.removeEventListener('cj:before-logout', preventLogout)
    }
  }, [examActive, code, id, user.id, message])

  useEffect(() => {
    if (blocker.state !== 'blocked') return
    const dialog = modal.warning({
      title: 'Bạn đang làm bài thi',
      content: 'Hãy bấm “Hoàn thành” trong phòng thi trước khi rời trang. Chuyển tab hoặc ứng dụng khác sẽ được ghi nhận là vi phạm.',
      okText: 'Tiếp tục làm bài',
      onOk: () => blocker.reset(),
    })
    return () => dialog.destroy()
  }, [blocker, modal])

  const finishExam = () => modal.confirm({
    title: 'Hoàn thành và rời phòng thi?',
    content: 'Kết quả được tính từ những bài đã nộp. Mã đang soạn chỉ được lưu nháp, hãy nộp bài trước khi hoàn thành.',
    okText: 'Hoàn thành',
    cancelText: 'Tiếp tục làm bài',
    onOk: () => {
      try {
        localStorage.setItem(draftKey(id, user.id), code)
      } catch {
        message.error('Không lưu được bản nháp. Hãy nộp bài trước khi hoàn thành.')
        return Promise.reject(new Error('Không lưu được bản nháp'))
      }
      leaving.current = true
      navigate(`/contests/${contest.id}`)
    },
  })

  const activeInput = customInput ?? (problem?.samples?.[0]?.input || '')

  useEffect(() => {
    const t = setTimeout(() => {
      try { localStorage.setItem(draftKey(id, user.id), code) } catch { /* ignore */ }
    }, 400)
    return () => clearTimeout(t)
  }, [code, id, user.id])

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
            <p style={{ color: '#ef4444', fontWeight: 600 }}>Hệ thống phát hiện bạn vừa rời khỏi màn hình làm bài thi!</p>
            <ul style={{ paddingLeft: 20, margin: '8px 0', color: 'var(--text-2)' }}>
              <li>Hành vi: <b>{type === 'TAB_SWITCH' ? 'Chuyển tab / Thu nhỏ trình duyệt' : 'Mất tiêu điểm cửa sổ làm bài'}</b></li>
              <li>Số lần vi phạm: <b style={{ color: '#ef4444', fontSize: 16 }}>{count}</b> lần</li>
            </ul>
            <p style={{ fontSize: 12, color: 'var(--muted)', margin: 0 }}>
              Hành vi này đã được gửi trực tiếp tới Giám thị phòng thi theo thời gian thực.
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
    enabled: examActive,
    onViolation: handleViolation,
  })

  const submit = async () => {
    if (!code.trim()) { message.warning('Mã nguồn đang trống'); return }
    if (contest && Date.now() > contest.endAt) { message.error('Kỳ thi đã kết thúc, không thể nộp bài'); return }
    setSubmitting(true)
    setActiveId(null)
    setResultMode('submit')
    setBottomTab('testresult')
    try {
      const s = await api.submit({ problemId: Number(id), language, sourceCode: code, contestId: contest?.id }, user)
      setActiveId(s.id)
      setRefreshKey((k) => k + 1)
    } catch (e) {
      message.error(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  const runTest = async () => {
    if (!code.trim()) { message.warning('Mã nguồn đang trống'); return }
    setRunningTest(true)
    setResultMode('run')
    setBottomTab('testresult')
    const expected = typeof selectedCase === 'number' && problem?.samples?.[selectedCase]
      ? problem.samples[selectedCase].output
      : ''
    try {
      const res = await api.runTest({ problemId: Number(id), language, sourceCode: code, input: activeInput, expectedOutput: expected })
      setTestResult(res)
    } catch (e) {
      message.error(e.message || 'Lỗi khi chạy thử')
    } finally {
      setRunningTest(false)
    }
  }

  const LANG_EXT = { cpp17: /\.(cpp|cc|cxx|h|hpp)$/i }
  const loadFile = (file) => {
    const pattern = LANG_EXT[language] || LANG_EXT.cpp17
    if (!pattern.test(file.name)) { message.error(`Ngôn ngữ ${language} không nhận tệp này`); return Upload.LIST_IGNORE }
    if (file.size > 256 * 1024) { message.error('Tệp vượt quá 256 KB'); return Upload.LIST_IGNORE }
    file.text().then((text) => { setCode(text.replace(/\r\n/g, '\n')); message.success(`Đã nạp ${file.name}`) })
    return false
  }

if (loading) return <Spin style={{ display: 'block', margin: 80 }} />
  if (error)
    return (
      <Result status="404" title="Không tìm thấy đề bài"
        extra={<Button onClick={() => navigate('/problems')}>Về danh sách</Button>} />
    )

  const marked = active?.verdict === 'CE'
    ? [...(active.compileLog || '').matchAll(/solution\.cpp:(\d+):/g)].map((m) => Number(m[1]))
    : []
  const judging = active && active.status !== 'FINISHED'

  return (
    <div className="workspace">
      {/* ── Top bar ── */}
      <div className="workspace-bar">
        <Tooltip title={contest ? 'Về trang kỳ thi' : 'Danh sách bài'}>
          <Button type="text" icon={<ArrowLeftOutlined />}
            onClick={() => navigate(contest ? `/contests/${contest.id}` : '/problems')} />
        </Tooltip>
        {contest ? (
          <>
            <span className="title"><b>{label}.</b> {problem.title}</span>
            <Typography.Text type="secondary" ellipsis style={{ maxWidth: 260 }}>{contest.title}</Typography.Text>
          </>
        ) : (
          <>
            <span className="title"><span className="mono muted">#{problem.id}</span> {problem.title}</span>
            <span className={`diff-pill diff-pill-${problem.difficulty}`} style={{ margin: 0 }}>
              {DIFFICULTIES[problem.difficulty].label}
            </span>
          </>
        )}
        <span style={{ flex: 1 }} />
        {examActive && <Button type="primary" onClick={finishExam} disabled={submitting || (active && active.status !== 'FINISHED')}>Hoàn thành</Button>}
        {contest && (
          <Space size={8}>
            {violationCount > 0 ? (
              <Tooltip title={`Hệ thống ghi nhận bạn đã rời màn hình thi ${violationCount} lần`}>
                <Tag color="error" icon={<WarningOutlined />} style={{ fontWeight: 600 }}>Vi phạm: {violationCount} lần</Tag>
              </Tooltip>
            ) : (
              <Tooltip title="Chế độ giám sát thi đang bật">
                <Tag color="success" icon={<SafetyCertificateOutlined />}>Giám sát: Nghiêm túc</Tag>
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

      {/* ── Main 3-panel layout ── */}
      <Splitter style={{ flex: 1, minHeight: 0 }}>

        {/* LEFT: Đề bài + Bài nộp */}
        <Splitter.Panel defaultSize="42%" min="24%" collapsible>
          <div className="pane">
            <Tabs
              activeKey={leftTab}
              onChange={setLeftTab}
              size="small"
              style={{ padding: '0 12px' }}
              items={[
                { key: 'statement', label: 'Đề bài' },
                {
                  key: 'submissions',
                  label: (
                    <Badge dot={judging} offset={[6, 0]}>
                      Bài nộp
                    </Badge>
                  ),
                },
              ]}
            />
            <div className="pane-body" style={{ padding: leftTab === 'submissions' ? '0 8px 12px' : undefined }}>
              {leftTab === 'statement' ? (
                <Statement problem={problem} />
              ) : (
                <MySubmissions
                  problemId={problem.id}
                  userId={user.id}
                  contestId={contest?.id}
                  refreshKey={refreshKey}
                  onPick={(sid) => {
                    setActiveId(sid)
                    setResultMode('submit')
                    setBottomTab('testresult')
                  }}
                />
              )}
            </div>
          </div>
        </Splitter.Panel>

        {/* RIGHT: Editor + Testcase/Result */}
        <Splitter.Panel min="30%">
          <Splitter orientation="vertical">

            {/* Editor */}
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
                      <Typography.Text className="mono" style={{ fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }} title="Chọn ngôn ngữ">
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
                      <Button size="small" type="text" icon={<FolderOpenOutlined />}>Tải tệp .cpp</Button>
                    </Upload>
                  </Space>
                </div>
                <div className="pane-body" style={{ overflow: 'hidden' }}>
                  <CodeEditor value={code} onChange={setCode} onSubmit={submit} onCursor={setCursor} markedLines={marked} />
                </div>
              </div>
            </Splitter.Panel>

            {/* Bottom: Testcase / Test Result */}
            <Splitter.Panel min="15%">
              <div className="pane">
                <Tabs
                  activeKey={bottomTab}
                  onChange={setBottomTab}
                  size="small"
                  style={{ padding: '0 12px' }}
                  items={[
                    {
                      key: 'testcase',
                      label: (
                        <span>
                          <CaretRightOutlined style={{ marginRight: 4, color: 'var(--primary)', fontSize: 11 }} />
                          Testcase
                        </span>
                      ),
                    },
                    {
                      key: 'testresult',
                      label: (
                        <Badge dot={runningTest || judging} offset={[6, 0]}>
                          Test Result
                        </Badge>
                      ),
                    },
                  ]}
                />
                <div className="pane-body" style={{ padding: '0 14px 14px' }}>
                  {bottomTab === 'testcase' ? (
                    <TestcasePanel
                      problem={problem}
                      input={activeInput}
                      setInput={setCustomInput}
                      selectedCase={selectedCase}
                      setSelectedCase={setSelectedCase}
                      onRun={runTest}
                      running={runningTest}
                    />
                  ) : (
                    <TestResultPanel
                      mode={resultMode}
                      running={runningTest}
                      testResult={testResult}
                      active={active}
                      submitting={submitting}
                      problem={problem}
                      code={code}
                      setCode={setCode}
                      message={message}
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

export default function WorkspacePage() {
  const { id } = useParams()
  return <Workspace key={id} id={id} />
}
