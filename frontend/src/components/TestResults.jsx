import { useState } from 'react'
import { Alert, Empty, Space, Typography } from 'antd'
import { SafetyOutlined } from '@ant-design/icons'
import VerdictTag from './VerdictTag'
import { testTone, VERDICTS } from '../lib/verdicts'
import { formatMemory, formatTime } from '../lib/format'

function DiffText({ output, expected }) {
  if (output == null) return <Typography.Text type="secondary">(không có)</Typography.Text>
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
  return (
    <Space orientation="vertical" size={10} style={{ width: '100%' }}>
      <Space wrap>
        <Typography.Text strong>Test #{test.index}</Typography.Text>
        {VERDICTS[test.status] ? (
          <VerdictTag verdict={test.status} />
        ) : (
          <span className={`verdict tone-${testTone(test.status)}`}>{test.status}</span>
        )}
        {test.timeMs != null && (
          <Typography.Text type="secondary" className="mono" style={{ fontSize: 12 }}>
            {formatTime(test.timeMs)} · {formatMemory(test.memoryKb)}
          </Typography.Text>
        )}
      </Space>
      <div className="io-grid">
        <div className="io-box">
          <div className="io-box-head">Input (stdin)</div>
          <pre>{test.input}</pre>
        </div>
        <div className={`io-box ${failed ? 'bad' : test.status === 'AC' ? 'good' : ''}`}>
          <div className="io-box-head">Output của bạn</div>
          <pre>{test.status === 'WA' ? <DiffText output={test.output} expected={test.expected} /> : (test.output ?? '—')}</pre>
        </div>
        <div className="io-box good">
          <div className="io-box-head">Đáp án mong đợi</div>
          <pre>{test.expected}</pre>
        </div>
      </div>
      {test.stderr && <Alert type="error" showIcon title={test.stderr} />}
      {test.status === 'WA' && (
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          Các token được tô đỏ là chỗ đầu ra khác đáp án (so sánh sau khi chuẩn hoá khoảng trắng).
        </Typography.Text>
      )}
    </Space>
  )
}

/** Bảng test case realtime + chi tiết diff, log biên dịch (CE) và cảnh báo bảo mật (SEC). */
export default function TestResults({ submission: s }) {
  const [picked, setPicked] = useState(null)
  if (!s) return <Empty description="Chưa có bài nộp" />

  if (s.verdict === 'CE') {
    return (
      <Space orientation="vertical" style={{ width: '100%' }}>
        <Alert type="error" showIcon title="Compile Error – g++ -std=c++17 -O2 báo lỗi" />
        <pre className="console-log">{s.compileLog || 'Không có log biên dịch'}</pre>
      </Space>
    )
  }
  if (s.verdict === 'SEC') {
    return (
      <Alert
        type="error"
        showIcon
        icon={<SafetyOutlined />}
        title="Security Violation – bài bị chặn trước khi biên dịch"
        description={
          <>
            {s.securityMessage}. Bộ quét tĩnh Regex trên Worker cấm các thư viện/lời gọi nguy hiểm như{' '}
            <span className="inline-code">windows.h</span>, <span className="inline-code">system()</span>,{' '}
            <span className="inline-code">fork()</span>, <span className="inline-code">exec*()</span>.
          </>
        }
      />
    )
  }
  if (!s.tests?.length) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={s.status === 'IN_QUEUE' ? 'Đang chờ Worker rảnh…' : 'Đang biên dịch…'}
      />
    )
  }

  const firstFail = s.tests.find((t) => VERDICTS[t.status] && t.status !== 'AC')
  const lastRun = [...s.tests].reverse().find((t) => t.status !== 'PENDING' && t.status !== 'SKIPPED')
  const selected = s.tests.find((t) => t.index === picked) || firstFail || lastRun || s.tests[0]
  const skipped = s.tests.filter((t) => t.status === 'SKIPPED').length

  return (
    <Space orientation="vertical" size={14} style={{ width: '100%' }}>
      <div className="test-chips">
        {s.tests.map((t) => (
          <span
            key={t.index}
            role="button"
            tabIndex={0}
            className={`test-chip tone-${testTone(t.status)}${selected.index === t.index ? ' selected' : ''}`}
            title={`Test #${t.index}: ${t.status}`}
            onClick={() => setPicked(t.index)}
            onKeyDown={(e) => e.key === 'Enter' && setPicked(t.index)}
          >
            {t.status === 'AC' || t.status === 'PENDING' || t.status === 'SKIPPED' || t.status === 'RUNNING' ? t.index : t.status}
          </span>
        ))}
      </div>
      <TestDetail test={selected} />
      {skipped > 0 && s.status === 'FINISHED' && (
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {skipped} test còn lại không được chạy (dừng sớm khi gặp test sai).
        </Typography.Text>
      )}
    </Space>
  )
}
