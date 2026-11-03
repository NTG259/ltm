import { useState } from 'react'
import { testStatusLabel, testTone, VERDICTS } from '../lib/verdicts'
import { formatMemory, formatTime } from '../lib/format'
import { useAuth } from '../auth/context'
import CompilerErrorExplainer from './CompilerErrorExplainer'
import { Progress } from './ui/progress'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'

function DiffLine({ actual, expected }) {
  const aTokens = (actual || '').split(/(\s+)/)
  const bTokens = (expected || '').split(/(\s+)/)
  return aTokens.map((tok, i) =>
    tok.trim() && tok !== bTokens[i] ? (
      <span key={i} className="diff-bad">{tok}</span>
    ) : (
      tok
    ),
  )
}

function DiffText({ output, expected }) {
  if (output == null) return <span className="muted">Không có đầu ra</span>
  if (expected == null) return <>{output}</>
  const aLines = output.split('\n')
  const bLines = expected.split('\n')
  return aLines.map((line, i) => (
    <span key={i}>
      {line !== bLines[i] ? <DiffLine actual={line} expected={bLines[i] || ''} /> : line}
      {i < aLines.length - 1 ? '\n' : ''}
    </span>
  ))
}

function TestDetail({ test }) {
  const failed = VERDICTS[test.status] && test.status !== 'AC'
  const ran = test.status !== 'PENDING' && test.status !== 'SKIPPED' && test.status !== 'RUNNING'
  return (
    <div className="flex w-full flex-col gap-2">
      <span>
        <b>Test #{test.index}</b>
        <span className="muted">
          {' · '}
          {testStatusLabel(test.status)}
          {test.timeMs != null && ` · ${formatTime(test.timeMs)} · ${formatMemory(test.memoryKb)}`}
        </span>
      </span>
      <div className="io-grid">
        <div className="io-box">
          <div className="io-box-head">Input</div>
          <pre>{test.input}</pre>
        </div>
        {ran && (
          <div className={`io-box ${failed ? 'bad' : 'good'}`}>
            <div className="io-box-head">Output của bạn</div>
            <pre>
              {test.output == null && !test.stderr ? (
                <span className="muted">Không có đầu ra</span>
              ) : test.output == null ? (
                <span className="muted">{test.stderr}</span>
              ) : test.status === 'WA' ? (
                <DiffText output={test.output} expected={test.expected} />
              ) : (
                test.output
              )}
            </pre>
          </div>
        )}
        <div className="io-box">
          <div className="io-box-head">Đáp án đúng</div>
          <pre>
            {test.expected != null ? test.expected : <span className="muted">Ẩn (test ẩn)</span>}
          </pre>
        </div>
      </div>
      {test.status === 'WA' && (
        <span className="text-xs text-muted-foreground">
          Phần tô đỏ là chỗ khác với đáp án.
        </span>
      )}
    </div>
  )
}

/** Danh sách test case (ô màu theo kết quả) và chi tiết test đang chọn. Admin thấy đủ; sinh viên chỉ thấy số đúng/tổng. */
export default function TestResults({ submission: s }) {
  const { isAdmin, isLecturer } = useAuth()
  const isStaff = isAdmin || isLecturer
  const [picked, setPicked] = useState(null)
  if (!s) return null

  if (s.verdict === 'CE') {
    return <CompilerErrorExplainer compileLog={s.compileLog} />
  }
  if (s.verdict === 'SEC') {
    return (
      <p className="text-sm text-muted-foreground">
        Không được dùng: <span className="inline-code">windows.h</span> <span className="inline-code">system()</span>{' '}
        <span className="inline-code">fork()</span> <span className="inline-code">exec…()</span> và các lệnh gọi hệ điều hành
        khác.
      </p>
    )
  }
  if (!s.tests?.length) return null

  const total = s.tests.length
  const passed = s.tests.filter((t) => t.status === 'AC').length
  const pct = total ? Math.round((passed / total) * 100) : 0

  // Sinh viên chỉ thấy tổng đúng/sai, không thấy test nào sai
  if (!isStaff) {
    return (
      <div className="flex w-full flex-col gap-2">
        <span>
          <b>{passed}/{total}</b> test đúng
        </span>
        <Progress
          value={pct}
          aria-label={`${passed}/${total} test đúng`}
        />
      </div>
    )
  }

  // Admin và Giảng viên: đầy đủ chip + chi tiết
  const firstFail = s.tests.find((t) => VERDICTS[t.status] && t.status !== 'AC')
  const lastRun = [...s.tests].reverse().find((t) => t.status !== 'PENDING' && t.status !== 'SKIPPED')
  const selected = s.tests.find((t) => t.index === picked) || firstFail || lastRun || s.tests[0]
  const skipped = s.tests.filter((t) => t.status === 'SKIPPED').length

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="test-chips">
          {s.tests.map((t) => (
            <Tooltip key={t.index}>
              <TooltipTrigger
                render={<button type="button" />}
                aria-label={`Test ${t.index}: ${testStatusLabel(t.status)}`}
                className={`test-chip tone-${testTone(t.status)}${selected.index === t.index ? ' selected' : ''}`}
                onClick={() => setPicked(t.index)}
              >
                {t.index}
              </TooltipTrigger>
              <TooltipContent>Test #{t.index}: {testStatusLabel(t.status)}</TooltipContent>
            </Tooltip>
          ))}
        </div>
        {skipped > 0 && s.status === 'FINISHED' && (
          <span className="text-xs text-muted-foreground">
            Dừng chấm sau test sai đầu tiên, {skipped} test còn lại không chạy.
          </span>
        )}
      </div>
      <TestDetail test={selected} />
    </div>
  )
}
