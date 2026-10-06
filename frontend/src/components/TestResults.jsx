import { useState } from 'react'
import { Space, Tooltip, Typography } from 'antd'
import { testStatusLabel, testTone, VERDICTS } from '../lib/verdicts'
import { formatMemory, formatTime } from '../lib/format'

function DiffText({ output, expected }) {
  const a = output.split(/(\s+)/)
  const b = expected.split(/(\s+)/)
  return a.map((tok, i) =>
    tok.trim() && tok !== b[i] ? (
      <span key={i} className="diff-bad">
        {tok}
      </span>
    ) : (
      tok
    ),
  )
}

function TestDetail({ test }) {
  const failed = VERDICTS[test.status] && test.status !== 'AC'
  const ran = test.status !== 'PENDING' && test.status !== 'SKIPPED' && test.status !== 'RUNNING'
  return (
    <Space orientation="vertical" size={8} style={{ width: '100%' }}>
      <Typography.Text>
        <b>Test #{test.index}</b>
        <span className="muted">
          {' · '}
          {testStatusLabel(test.status)}
          {test.timeMs != null && ` · ${formatTime(test.timeMs)} · ${formatMemory(test.memoryKb)}`}
        </span>
      </Typography.Text>
      <div className="io-grid">
        <div className="io-box">
          <div className="io-box-head">Input</div>
          <pre>{test.input}</pre>
        </div>
        {ran && (
          <div className={`io-box ${failed ? 'bad' : 'good'}`}>
            <div className="io-box-head">Output của bạn</div>
            <pre>
              {test.output == null ? (
                <span className="muted">{test.stderr || 'Không có đầu ra'}</span>
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
          <pre>{test.expected}</pre>
        </div>
      </div>
      {test.status === 'WA' && (
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          Phần tô đỏ là chỗ khác với đáp án.
        </Typography.Text>
      )}
    </Space>
  )
}

/** Danh sách test case (ô màu theo kết quả) và chi tiết test đang chọn. Trạng thái tổng nằm ở ResultSummary. */
export default function TestResults({ submission: s }) {
  const [picked, setPicked] = useState(null)
  if (!s) return null

  if (s.verdict === 'CE') {
    return (
      <div>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          Thông báo từ trình biên dịch g++
        </Typography.Text>
        <pre className="console-log" style={{ marginTop: 6 }}>
          {s.compileLog || 'Không có thông báo'}
        </pre>
      </div>
    )
  }
  if (s.verdict === 'SEC') {
    return (
      <Typography.Text type="secondary" style={{ fontSize: 13 }}>
        Không được dùng: <span className="inline-code">windows.h</span> <span className="inline-code">system()</span>{' '}
        <span className="inline-code">fork()</span> <span className="inline-code">exec…()</span> và các lệnh gọi hệ điều hành
        khác.
      </Typography.Text>
    )
  }
  if (!s.tests?.length) return null

  const firstFail = s.tests.find((t) => VERDICTS[t.status] && t.status !== 'AC')
  const lastRun = [...s.tests].reverse().find((t) => t.status !== 'PENDING' && t.status !== 'SKIPPED')
  const selected = s.tests.find((t) => t.index === picked) || firstFail || lastRun || s.tests[0]
  const skipped = s.tests.filter((t) => t.status === 'SKIPPED').length

  return (
    <Space orientation="vertical" size={12} style={{ width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div className="test-chips">
          {s.tests.map((t) => (
            <Tooltip key={t.index} title={`Test #${t.index}: ${testStatusLabel(t.status)}`}>
              <span
                role="button"
                tabIndex={0}
                aria-label={`Test ${t.index}: ${testStatusLabel(t.status)}`}
                className={`test-chip tone-${testTone(t.status)}${selected.index === t.index ? ' selected' : ''}`}
                onClick={() => setPicked(t.index)}
                onKeyDown={(e) => e.key === 'Enter' && setPicked(t.index)}
              >
                {t.index}
              </span>
            </Tooltip>
          ))}
        </div>
        {skipped > 0 && s.status === 'FINISHED' && (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Dừng chấm sau test sai đầu tiên, {skipped} test còn lại không chạy.
          </Typography.Text>
        )}
      </div>
      <TestDetail test={selected} />
    </Space>
  )
}
