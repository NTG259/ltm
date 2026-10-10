import { useState } from 'react'
import { Button, Empty, Space, Tooltip, Typography } from 'antd'
import {
  CaretRightOutlined,
  CopyOutlined,
  LoadingOutlined,
  RedoOutlined,
} from '@ant-design/icons'
import { formatMemory, formatTime } from '../lib/format'
import { VERDICTS } from '../lib/verdicts'

function DiffText({ output, expected }) {
  if (!expected) return output
  const a = (output || '').split(/(\s+)/)
  const b = (expected || '').split(/(\s+)/)
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

export default function CustomTestRunner({
  problem,
  running,
  result,
  onRun,
  input,
  setInput,
}) {
  const samples = problem?.samples || []
  const [selectedCase, setSelectedCase] = useState(0)

  // Lấy expected output của sample nếu đang chọn Case mẫu
  const currentSampleExpected =
    typeof selectedCase === 'number' && samples[selectedCase]
      ? samples[selectedCase].output
      : null

  const pickSample = (idx) => {
    setSelectedCase(idx)
    if (idx >= 0 && idx < samples.length) {
      setInput(samples[idx].input || '')
    }
  }

  const pickCustom = () => {
    setSelectedCase('custom')
  }

  const copy = (text) => {
    if (!text) return
    navigator.clipboard?.writeText(text)
  }

  const handleRun = () => {
    // Nếu đang ở test mẫu của đề bài, gửi kèm expected output để đối chiếu
    // Nếu tự nhập thì không gửi expected output (để không bị bắt lỗi WA giả)
    const expected = currentSampleExpected || ''
    onRun(input, expected)
  }

  const meta = result?.verdict ? VERDICTS[result.verdict] : null
  const isWA = result?.verdict === 'WA'
  const isCE = result?.verdict === 'CE'
  const isSEC = result?.verdict === 'SEC'
  const hasExpected = !!result?.hasExpected && !!result?.expectedOutput

  return (
    <div className="custom-test-runner" style={{ display: 'grid', gap: 14 }}>
      {/* Thanh chọn test case và nút chạy */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <Typography.Text type="secondary" style={{ fontSize: 12, marginRight: 2 }}>
            Bộ test:
          </Typography.Text>
          {samples.map((s, idx) => (
            <button
              key={idx}
              type="button"
              className={`test-chip ${selectedCase === idx ? 'selected' : ''}`}
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
            className={`test-chip ${selectedCase === 'custom' ? 'selected' : ''}`}
            style={{
              background: selectedCase === 'custom' ? 'var(--primary-soft)' : 'var(--inset)',
              borderColor: selectedCase === 'custom' ? 'var(--primary)' : 'var(--border)',
              color: selectedCase === 'custom' ? 'var(--primary)' : 'var(--text)',
            }}
            onClick={pickCustom}
          >
            Tự nhập
          </button>
          {typeof selectedCase === 'number' && samples[selectedCase] && (
            <Tooltip title="Khôi phục dữ liệu ban đầu của test mẫu này">
              <Button
                size="small"
                type="text"
                icon={<RedoOutlined />}
                onClick={() => pickSample(selectedCase)}
                style={{ fontSize: 12, color: 'var(--text-2)' }}
              >
                Đặt lại
              </Button>
            </Tooltip>
          )}
        </div>

        <Button
          type="primary"
          icon={<CaretRightOutlined />}
          loading={running}
          onClick={handleRun}
        >
          {running ? 'Đang chạy…' : 'Chạy thử'}
        </Button>
      </div>

      {/* Hiển thị gợi ý đáp án mẫu nếu đang chọn Test mẫu của đề bài */}
      {currentSampleExpected && (
        <div style={{ fontSize: 12, color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>Đáp án mẫu của đề bài:</span>
          <code className="inline-code">{currentSampleExpected.trim()}</code>
        </div>
      )}

      {/* Ô nhập input (stdin) duy nhất */}
      <div className="io-box">
        <div className="io-box-head">
          <span>Dữ liệu vào (Input - stdin)</span>
          <Button
            size="small"
            type="text"
            icon={<CopyOutlined />}
            onClick={() => copy(input)}
            title="Sao chép"
          />
        </div>
        <textarea
          className="custom-test-editor"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Nhập stdin cho chương trình (ví dụ: 10 20)..."
          rows={4}
          spellCheck={false}
        />
      </div>

      {/* Khu vực kết quả chạy thử */}
      {running ? (
        <div className="result-summary tone-running">
          <div className="result-main">
            <div className="result-title">
              <LoadingOutlined /> Đang biên dịch và chạy trên Worker…
            </div>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Đang thực thi mã nguồn với dữ liệu đầu vào đã nhập...
            </Typography.Text>
          </div>
        </div>
      ) : result ? (
        <Space orientation="vertical" size={12} style={{ width: '100%' }}>
          {/* Thanh tóm tắt trạng thái */}
          <div className={`result-summary tone-${meta?.tone || (result.verdict === 'AC' ? 'ac' : 'rte')}`}>
            <div className="result-main">
              <div className="result-title">
                {hasExpected
                  ? (meta?.label || result.verdict)
                  : (result.verdict === 'AC' ? 'Thực thi thành công' : (meta?.label || result.verdict))}
              </div>
              <div style={{ fontSize: 13 }}>
                {result.verdict === 'AC' && (
                  hasExpected
                    ? 'Chương trình chạy hoàn tất và khớp kết quả mẫu của đề.'
                    : 'Chương trình đã thực thi xong và xuất ra kết quả bên dưới.'
                )}
                {result.verdict === 'WA' && 'Kết quả in ra không trùng khớp với đáp án mẫu.'}
                {result.verdict === 'TLE' && `Vượt quá giới hạn thời gian chạy (${(problem?.timeLimitMs || 1000) / 1000}s).`}
                {result.verdict === 'MLE' && `Vượt quá giới hạn bộ nhớ (${problem?.memoryLimitMb || 256}MB).`}
                {result.verdict === 'RTE' && 'Chương trình gặp lỗi khi chạy (Runtime Error).'}
                {result.verdict === 'CE' && 'Biên dịch thất bại g++.'}
                {result.verdict === 'SEC' && `Vi phạm quy tắc bảo mật: ${result.securityMessage}`}
              </div>
            </div>
            {!isCE && !isSEC && (
              <div className="result-side">
                <div className="mono" style={{ fontSize: 13, fontWeight: 600 }}>
                  {formatTime(result.timeMs)} · {formatMemory(result.memoryKb)}
                </div>
              </div>
            )}
          </div>

          {/* Lỗi biên dịch g++ nếu có */}
          {result.compileLog && (
            <div style={{ display: 'grid', gap: 4 }}>
              <Typography.Text strong style={{ fontSize: 12, color: 'var(--text-2)' }}>
                Chi tiết lỗi biên dịch:
              </Typography.Text>
              <pre className="console-log">{result.compileLog}</pre>
            </div>
          )}

          {/* Lỗi bảo mật nếu có */}
          {result.securityMessage && (
            <div style={{ display: 'grid', gap: 4 }}>
              <Typography.Text strong style={{ fontSize: 12, color: 'var(--wa-fg)' }}>
                Cảnh báo an toàn:
              </Typography.Text>
              <pre className="console-log" style={{ color: 'var(--wa-fg)' }}>
                {result.securityMessage}
              </pre>
            </div>
          )}

          {/* Khung hiển thị Output (stdout) */}
          {!isCE && (
            <div className={hasExpected ? 'io-grid' : ''}>
              <div className={`io-box ${isWA ? 'bad' : 'good'}`}>
                <div className="io-box-head">
                  <span>Kết quả xuất ra (Output - stdout)</span>
                  <Button
                    size="small"
                    type="text"
                    icon={<CopyOutlined />}
                    onClick={() => copy(result.output)}
                    title="Sao chép"
                  />
                </div>
                <pre>
                  {result.output == null || result.output === '' ? (
                    <span className="muted">(Chương trình không in ra gì)</span>
                  ) : isWA && result.expectedOutput ? (
                    <DiffText output={result.output} expected={result.expectedOutput} />
                  ) : (
                    result.output
                  )}
                </pre>
              </div>

              {/* Nếu có đáp án mẫu đối chiếu */}
              {hasExpected && result.expectedOutput && (
                <div className="io-box">
                  <div className="io-box-head">
                    <span>Đáp án mẫu của đề bài</span>
                    <Button
                      size="small"
                      type="text"
                      icon={<CopyOutlined />}
                      onClick={() => copy(result.expectedOutput)}
                      title="Sao chép"
                    />
                  </div>
                  <pre>{result.expectedOutput}</pre>
                </div>
              )}
            </div>
          )}

          {/* stderr nếu có */}
          {result.stderr ? (
            <div className="io-box bad">
              <div className="io-box-head">
                <span>Thông báo lỗi stderr</span>
                <Button
                  size="small"
                  type="text"
                  icon={<CopyOutlined />}
                  onClick={() => copy(result.stderr)}
                  title="Sao chép"
                />
              </div>
              <pre>{result.stderr}</pre>
            </div>
          ) : null}

          {isWA && hasExpected && (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Phần tô đỏ là chỗ khác biệt so với đáp án mẫu.
            </Typography.Text>
          )}
        </Space>
      ) : (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="Nhập dữ liệu vào (stdin) rồi bấm 'Chạy thử' để xem kết quả xuất ra màn hình (stdout)"
        />
      )}
    </div>
  )
}
