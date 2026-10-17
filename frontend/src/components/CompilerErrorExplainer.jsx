import { useMemo, useState } from 'react'
import {
  Alert,
  App,
  Badge,
  Button,
  Card,
  Radio,
  Space,
  Tag,
} from 'antd'
import {
  AlertOutlined,
  BulbOutlined,
  CheckOutlined,
  CodeOutlined,
  CopyOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import { explainCompileLog } from '../lib/compilerExplainer'

export default function CompilerErrorExplainer({ compileLog }) {
  const { message } = App.useApp()
  const [viewMode, setViewMode] = useState('vi') // 'vi' | 'raw'
  const [copied, setCopied] = useState(false)

  const analysis = useMemo(() => explainCompileLog(compileLog), [compileLog])

  const copyLog = () => {
    if (!compileLog) return
    navigator.clipboard?.writeText(compileLog).then(() => {
      setCopied(true)
      message.success('Đã sao chép log lỗi biên dịch')
      setTimeout(() => setCopied(false), 2000)
    })
  }

  if (!compileLog || !compileLog.trim()) {
    return (
      <div style={{ color: 'var(--muted)', fontSize: 13 }}>
        Không có thông tin lỗi biên dịch.
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gap: 10, width: '100%' }}>
      {/* Thanh điều khiển trên cùng */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <Space size={6} wrap>
          <Tag color="error" icon={<AlertOutlined />} style={{ fontWeight: 600 }}>
            Lỗi biên dịch g++ (CE)
          </Tag>
          {analysis.errors.length > 0 && (
            <Badge
              count={`${analysis.errors.length} lỗi phát hiện`}
              style={{ backgroundColor: '#ef4444', fontSize: 11 }}
            />
          )}
        </Space>

        <Space size={8}>
          <Radio.Group
            size="small"
            value={viewMode}
            onChange={(e) => setViewMode(e.target.value)}
            optionType="button"
            buttonStyle="solid"
          >
            <Radio.Button value="vi">
              <BulbOutlined style={{ marginRight: 4 }} />
              Giải thích Tiếng Việt
            </Radio.Button>
            <Radio.Button value="raw">
              <CodeOutlined style={{ marginRight: 4 }} />
              Log gốc g++ (English)
            </Radio.Button>
          </Radio.Group>
          <Button
            size="small"
            type="text"
            icon={copied ? <CheckOutlined /> : <CopyOutlined />}
            onClick={copyLog}
            title="Sao chép log lỗi"
          >
            {copied ? 'Đã chép' : 'Sao chép'}
          </Button>
        </Space>
      </div>

      {/* Xem giải thích tiếng Việt */}
      {viewMode === 'vi' ? (
        analysis.hasExplanation ? (
          <div style={{ display: 'grid', gap: 10 }}>
            {analysis.errors.map((err, idx) => (
              <Card
                key={idx}
                size="small"
                style={{
                  borderLeft: `4px solid ${err.severity === 'warning' ? '#f59e0b' : '#ef4444'}`,
                  background: 'var(--bg-elevated, #1c1c1f)',
                }}
                styles={{ body: { padding: '10px 14px' } }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 4 }}>
                  {err.severity === 'warning' ? (
                    <WarningOutlined style={{ color: '#f59e0b', marginTop: 3 }} />
                  ) : (
                    <AlertOutlined style={{ color: '#ef4444', marginTop: 3 }} />
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <b style={{ fontSize: 13, color: 'var(--text, #f4f4f5)' }}>
                        {err.titleVi}
                      </b>
                      {err.line && (
                        <Tag color="volcano" style={{ fontSize: 11, margin: 0 }}>
                          Dòng {err.line}
                          {err.column ? `, Cột ${err.column}` : ''}
                        </Tag>
                      )}
                    </div>

                    <div style={{ fontSize: 12, color: 'var(--text-secondary, #a1a1aa)', marginTop: 4 }}>
                      {err.explanationVi}
                    </div>

                    {err.suggestionVi && (
                      <div
                        style={{
                          marginTop: 6,
                          padding: '6px 10px',
                          background: 'rgba(234, 179, 8, 0.08)',
                          borderLeft: '2px solid #eab308',
                          borderRadius: 4,
                          fontSize: 12,
                          color: '#facc15',
                        }}
                      >
                        <b>💡 Gợi ý sửa:</b> {err.suggestionVi}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            ))}

            <Alert
              type="info"
              showIcon
              style={{ fontSize: 12 }}
              message={
                <span>
                  <b>Mẹo:</b> Các dòng code có lỗi đã được viền đỏ nổi bật trong trình soạn thảo. Sau khi sửa xong các gợi ý trên, hãy bấm <b>Chạy thử</b> hoặc <b>Nộp bài</b> lại nhé!
                </span>
              }
            />
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            <Alert
              type="warning"
              showIcon
              message="Chưa có mẫu giải thích cụ thể cho lỗi này. Dưới đây là chi tiết thông báo gốc từ g++:"
            />
            <pre className="console-log">{compileLog}</pre>
          </div>
        )
      ) : (
        /* Xem log thô tiếng Anh */
        <pre className="console-log" style={{ margin: 0, maxHeight: 360, overflowY: 'auto' }}>
          {compileLog}
        </pre>
      )}
    </div>
  )
}
