import { useMemo, useRef, useState } from 'react'
import { highlightCpp } from '../lib/highlight'

const INDENT = '    '

/**
 * Trình soạn thảo C++ nhẹ: đánh số dòng, tô màu cú pháp, Tab thụt lề,
 * Shift+Tab bỏ thụt lề, Enter giữ thụt lề, Ctrl+Enter gọi onSubmit.
 */
export default function CodeEditor({ value, onChange, readOnly, markedLines = [], onSubmit, onCursor }) {
  const preRef = useRef(null)
  const gutterRef = useRef(null)
  const [activeLine, setActiveLine] = useState(1)
  const html = useMemo(() => highlightCpp(value) + '\n', [value])
  const lineCount = value.split('\n').length
  const marked = useMemo(() => new Set(markedLines), [markedLines])

  const syncScroll = (e) => {
    if (preRef.current) {
      preRef.current.scrollTop = e.target.scrollTop
      preRef.current.scrollLeft = e.target.scrollLeft
    }
    if (gutterRef.current) gutterRef.current.scrollTop = e.target.scrollTop
  }

  const updateCursor = (el) => {
    const before = el.value.slice(0, el.selectionStart)
    const line = before.split('\n').length
    const col = el.selectionStart - before.lastIndexOf('\n')
    setActiveLine(line)
    onCursor?.({ line, col })
  }

  const edit = (el, start, end, text, caret) => {
    const next = el.value.slice(0, start) + text + el.value.slice(end)
    onChange(next)
    requestAnimationFrame(() => {
      el.selectionStart = el.selectionEnd = caret ?? start + text.length
      updateCursor(el)
    })
  }

  const onKeyDown = (e) => {
    const el = e.target
    const { selectionStart: s, selectionEnd: t, value: v } = el
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      onSubmit?.()
      return
    }
    if (e.key === 'Tab') {
      e.preventDefault()
      const lineStart = v.lastIndexOf('\n', s - 1) + 1
      if (e.shiftKey) {
        const line = v.slice(lineStart)
        const remove = line.match(/^( {1,4}|\t)/)?.[0].length ?? 0
        if (remove) edit(el, lineStart, lineStart + remove, '', Math.max(lineStart, s - remove))
      } else if (s !== t && v.slice(s, t).includes('\n')) {
        const block = v.slice(lineStart, t)
        const indented = block.replace(/^/gm, INDENT)
        edit(el, lineStart, t, indented, lineStart + indented.length)
      } else {
        edit(el, s, t, INDENT)
      }
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      const lineStart = v.lastIndexOf('\n', s - 1) + 1
      const indent = v.slice(lineStart, s).match(/^\s*/)[0]
      const prevChar = v.slice(0, s).trimEnd().slice(-1)
      const nextChar = v.slice(t).trimStart()[0]
      if (prevChar === '{' && nextChar === '}') {
        const text = `\n${indent}${INDENT}\n${indent}`
        edit(el, s, t, text, s + indent.length + INDENT.length + 1)
      } else {
        edit(el, s, t, `\n${indent}${prevChar === '{' ? INDENT : ''}`)
      }
    }
  }

  const gutter = (
    <div className="editor-gutter" ref={gutterRef}>
      {Array.from({ length: lineCount }, (_, i) => (
        <div key={i} className={marked.has(i + 1) ? 'marked' : !readOnly && activeLine === i + 1 ? 'active' : undefined}>
          {i + 1}
        </div>
      ))}
    </div>
  )

  if (readOnly) {
    return (
      <div className="editor readonly">
        {gutter}
        <div className="editor-body">
          <pre dangerouslySetInnerHTML={{ __html: html }} />
        </div>
      </div>
    )
  }

  return (
    <div className="editor">
      {gutter}
      <div className="editor-body">
        <pre ref={preRef} aria-hidden dangerouslySetInnerHTML={{ __html: html }} />
        <textarea
          value={value}
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          aria-label="Mã nguồn C++"
          onChange={(e) => {
            onChange(e.target.value)
            updateCursor(e.target)
          }}
          onKeyDown={onKeyDown}
          onKeyUp={(e) => updateCursor(e.target)}
          onClick={(e) => updateCursor(e.target)}
          onScroll={syncScroll}
        />
      </div>
    </div>
  )
}
