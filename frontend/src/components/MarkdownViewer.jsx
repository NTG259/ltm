import { useState } from 'react'
import { Alert, Button, Typography } from 'antd'
import { CheckOutlined, CopyOutlined } from '@ant-design/icons'

function CodeBlock({ language, code }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      style={{
        margin: '16px 0',
        borderRadius: 8,
        overflow: 'hidden',
        border: '1px solid var(--border)',
        background: 'var(--inset)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '6px 14px',
          background: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <span style={{ fontSize: 12, color: 'var(--text-2)', fontWeight: 600, textTransform: 'uppercase' }}>
          {language || 'C++'}
        </span>
        <Button
          type="text"
          size="small"
          icon={copied ? <CheckOutlined style={{ color: '#22c55e' }} /> : <CopyOutlined />}
          style={{ color: 'var(--text-2)', fontSize: 12 }}
          onClick={handleCopy}
        >
          {copied ? 'Đã sao chép' : 'Sao chép'}
        </Button>
      </div>
      <pre
        style={{
          margin: 0,
          padding: '14px 16px',
          fontFamily: "'JetBrains Mono', Consolas, Monaco, monospace",
          fontSize: 13.5,
          color: 'var(--text)',
          overflowX: 'auto',
          lineHeight: 1.6,
        }}
      >
        <code>{code}</code>
      </pre>
    </div>
  )
}

function renderInline(text) {
  if (!text) return null

  // Split by inline code `...`
  const codeParts = text.split(/(`[^`]+`)/g)
  return codeParts.map((part, i) => {
    if (part.startsWith('`') && part.endsWith('`')) {
      const code = part.slice(1, -1)
      return (
        <code
          key={i}
          style={{
            background: 'var(--inset)',
            border: '1px solid var(--border)',
            color: 'var(--primary)',
            padding: '2px 6px',
            borderRadius: 4,
            fontSize: '0.9em',
            fontFamily: "'JetBrains Mono', Consolas, Monaco, monospace",
          }}
        >
          {code}
        </code>
      )
    }

    // Split by bold **...**
    const boldParts = part.split(/(\*\*[^*]+\*\*)/g)
    return boldParts.map((bPart, j) => {
      if (bPart.startsWith('**') && bPart.endsWith('**')) {
        return <strong key={j}>{bPart.slice(2, -2)}</strong>
      }
      return bPart
    })
  })
}

export default function MarkdownViewer({ content = '' }) {
  if (!content || !content.trim()) {
    return (
      <div style={{ color: '#94a3b8', fontStyle: 'italic', padding: '16px 0' }}>
        Chưa có nội dung bài giảng cho chủ đề này.
      </div>
    )
  }

  const lines = content.split('\n')
  const elements = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // 1. Code fence ```
    if (line.trim().startsWith('```')) {
      const lang = line.trim().replace('```', '').trim()
      const codeLines = []
      i++
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i])
        i++
      }
      elements.push(
        <CodeBlock
          key={`code-${elements.length}`}
          language={lang}
          code={codeLines.join('\n')}
        />
      )
      i++
      continue
    }

    // 2. Callout / Alert blockquote (> [!TIP], > [!NOTE], > text)
    if (line.trim().startsWith('>')) {
      const quoteLines = []
      let alertType = 'info'
      let alertTitle = 'Ghi chú quan trọng'

      while (i < lines.length && lines[i].trim().startsWith('>')) {
        let clean = lines[i].trim().replace(/^>\s?/, '')
        if (clean.startsWith('[!TIP]')) {
          alertType = 'success'
          alertTitle = 'Mẹo tối ưu (Tip)'
          clean = clean.replace('[!TIP]', '').trim()
        } else if (clean.startsWith('[!NOTE]')) {
          alertType = 'info'
          alertTitle = 'Lưu ý (Note)'
          clean = clean.replace('[!NOTE]', '').trim()
        } else if (clean.startsWith('[!WARNING]')) {
          alertType = 'warning'
          alertTitle = 'Cảnh báo'
          clean = clean.replace('[!WARNING]', '').trim()
        }
        if (clean) quoteLines.push(clean)
        i++
      }

      elements.push(
        <Alert
          key={`alert-${elements.length}`}
          type={alertType}
          showIcon
          message={alertTitle}
          description={
            <div style={{ fontSize: 13.5, lineHeight: 1.6, marginTop: 4 }}>
              {quoteLines.map((q, idx) => (
                <div key={idx}>{renderInline(q)}</div>
              ))}
            </div>
          }
          style={{ margin: '16px 0', borderRadius: 8 }}
        />
      )
      continue
    }

    // 3. Headings
    if (line.startsWith('#### ')) {
      elements.push(
        <Typography.Title
          key={`h4-${elements.length}`}
          level={5}
          style={{ marginTop: 18, marginBottom: 8, color: 'var(--text)' }}
        >
          {renderInline(line.replace('#### ', ''))}
        </Typography.Title>
      )
      i++
      continue
    }
    if (line.startsWith('### ')) {
      elements.push(
        <Typography.Title
          key={`h3-${elements.length}`}
          level={4}
          style={{ marginTop: 22, marginBottom: 8, color: 'var(--primary)' }}
        >
          {renderInline(line.replace('### ', ''))}
        </Typography.Title>
      )
      i++
      continue
    }
    if (line.startsWith('## ')) {
      elements.push(
        <Typography.Title
          key={`h2-${elements.length}`}
          level={3}
          style={{
            marginTop: 26,
            marginBottom: 12,
            paddingBottom: 6,
            borderBottom: '1px solid var(--border)',
          }}
        >
          {renderInline(line.replace('## ', ''))}
        </Typography.Title>
      )
      i++
      continue
    }
    if (line.startsWith('# ')) {
      elements.push(
        <Typography.Title
          key={`h1-${elements.length}`}
          level={2}
          style={{
            marginTop: 16,
            marginBottom: 16,
            paddingBottom: 8,
            borderBottom: '2px solid var(--border)',
          }}
        >
          {renderInline(line.replace('# ', ''))}
        </Typography.Title>
      )
      i++
      continue
    }

    // 4. Bullet list (- or * )
    if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
      const listItems = []
      while (
        i < lines.length &&
        (lines[i].trim().startsWith('- ') || lines[i].trim().startsWith('* '))
      ) {
        listItems.push(lines[i].trim().replace(/^[-*]\s+/, ''))
        i++
      }
      elements.push(
        <ul
          key={`ul-${elements.length}`}
          style={{ paddingLeft: 22, margin: '10px 0', lineHeight: 1.7 }}
        >
          {listItems.map((item, idx) => (
            <li key={idx} style={{ marginBottom: 4 }}>
              {renderInline(item)}
            </li>
          ))}
        </ul>
      )
      continue
    }

    // 5. Normal text paragraph
    if (line.trim()) {
      elements.push(
        <p
          key={`p-${elements.length}`}
          style={{ margin: '8px 0', lineHeight: 1.75, fontSize: 14.5 }}
        >
          {renderInline(line)}
        </p>
      )
    }

    i++
  }

  return (
    <div className="markdown-viewer" style={{ color: 'var(--text)' }}>
      {elements}
    </div>
  )
}
