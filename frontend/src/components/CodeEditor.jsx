import { useEffect, useRef } from 'react'
import Editor from '@monaco-editor/react'

// Cờ đánh dấu đã đăng ký completion provider cho C++ một lần duy nhất
let cppSnippetsRegistered = false

function registerCppSnippets(monaco) {
  if (cppSnippetsRegistered) return
  cppSnippetsRegistered = true

  monaco.languages.registerCompletionItemProvider('cpp', {
    provideCompletionItems: (model, position) => {
      const word = model.getWordUntilPosition(position)
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      }

      const suggestions = [
        {
          label: 'for',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: 'for (int ${1:i} = 0; ${1:i} < ${2:n}; ++${1:i}) {\n\t$0\n}',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          detail: 'Vòng lặp for tăng dần (0 -> n - 1)',
          documentation: 'Tạo vòng lặp for cơ bản từ 0 đến n - 1',
          range,
        },
        {
          label: 'forr',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: 'for (int ${1:i} = ${2:n} - 1; ${1:i} >= 0; --${1:i}) {\n\t$0\n}',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          detail: 'Vòng lặp for lùi ngược (n - 1 -> 0)',
          documentation: 'Tạo vòng lặp for duyệt ngược',
          range,
        },
        {
          label: 'for1',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: 'for (int ${1:i} = 1; ${1:i} <= ${2:n}; ++${1:i}) {\n\t$0\n}',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          detail: 'Vòng lặp for (1 -> n)',
          documentation: 'Tạo vòng lặp for đánh số từ 1',
          range,
        },
        {
          label: 'while',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: 'while (${1:condition}) {\n\t$0\n}',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          detail: 'Vòng lặp while',
          range,
        },
        {
          label: 'whilet',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: 'int ${1:t};\ncin >> ${1:t};\nwhile (${1:t}--) {\n\t$0\n}',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          detail: 'Xử lý nhiều bộ test (while (t--))',
          documentation: 'Đọc số lượng test t và lặp qua từng test case',
          range,
        },
        {
          label: 'cin',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: 'cin >> ${1:x};',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          detail: 'Nhập dữ liệu từ stdin',
          range,
        },
        {
          label: 'cout',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: 'cout << ${1:ans} << "\\n";',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          detail: 'In kết quả ra stdout kèm xuống dòng',
          range,
        },
        {
          label: 'fastio',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: 'ios_base::sync_with_stdio(false);\ncin.tie(NULL);',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          detail: 'Tối ưu tốc độ nhập xuất cin/cout (Fast I/O)',
          documentation: 'Tăng tốc độ cin/cout để tránh bị Time Limit Exceeded (TLE)',
          range,
        },
        {
          label: 'vec',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: 'vector<${1:int}> ${2:a}(${3:n});$0',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          detail: 'Khai báo vector 1 chiều',
          range,
        },
        {
          label: 'vec2d',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: 'vector<vector<${1:int}>> ${2:dp}(${3:n}, vector<${1:int}>(${4:m}, ${5:0}));$0',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          detail: 'Khai báo mảng/vector 2 chiều (bảng quy hoạch động n x m)',
          range,
        },
        {
          label: 'all',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: '${1:a}.begin(), ${1:a}.end()$0',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          detail: 'Viết tắt a.begin(), a.end()',
          range,
        },
        {
          label: 'sort',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: 'sort(${1:a}.begin(), ${1:a}.end());$0',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          detail: 'Sắp xếp mảng/vector tăng dần',
          range,
        },
        {
          label: 'sortdesc',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: 'sort(${1:a}.begin(), ${1:a}.end(), greater<${2:int}>());$0',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          detail: 'Sắp xếp mảng/vector giảm dần',
          range,
        },
        {
          label: 'map',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: 'map<${1:string}, ${2:int}> ${3:mp};$0',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          detail: 'Khai báo bảng băm / từ điển map',
          range,
        },
        {
          label: 'gcd',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: 'long long gcd(long long a, long long b) {\n\treturn b == 0 ? a : gcd(b, a % b);\n}',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          detail: 'Hàm tìm ước chung lớn nhất (GCD - Euclid)',
          range,
        },
        {
          label: 'isPrime',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: 'bool isPrime(long long n) {\n\tif (n < 2) return false;\n\tfor (long long i = 2; i * i <= n; ++i) {\n\t\tif (n % i == 0) return false;\n\t}\n\treturn true;\n}',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          detail: 'Hàm kiểm tra số nguyên tố O(sqrt(N))',
          range,
        },
        {
          label: 'struct',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: 'struct ${1:Point} {\n\tint ${2:x}, ${3:y};\n};$0',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          detail: 'Định nghĩa cấu trúc struct',
          range,
        },
      ]

      return { suggestions }
    },
  })
}

export default function CodeEditor({ value = '', onChange, readOnly = false, markedLines = [], onSubmit, onCursor }) {
  const editorRef = useRef(null)
  const monacoRef = useRef(null)
  const decorationsRef = useRef([])

  // Cấu hình phím tắt và sự kiện khi Monaco Editor sẵn sàng
  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor
    monacoRef.current = monaco

    // Đăng ký C++ Snippets thông minh
    registerCppSnippets(monaco)

    // Lắng nghe thay đổi vị trí con trỏ chuột
    editor.onDidChangeCursorPosition((e) => {
      if (typeof onCursor === 'function') {
        onCursor({ line: e.position.lineNumber, col: e.position.column })
      }
    })

    // Phím tắt Ctrl + Enter (hoặc Cmd + Enter) để nộp bài
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      if (typeof onSubmit === 'function') {
        onSubmit()
      }
    })
  }

  // Đánh dấu các dòng lỗi biên dịch (markedLines)
  useEffect(() => {
    const editor = editorRef.current
    const monaco = monacoRef.current
    if (!editor || !monaco) return

    if (!markedLines || markedLines.length === 0) {
      decorationsRef.current = editor.deltaDecorations(decorationsRef.current, [])
      return
    }

    const newDecorations = markedLines.map((line) => ({
      range: new monaco.Range(line, 1, line, 1),
      options: {
        isWholeLine: true,
        className: 'editor-marked-error-line',
        glyphMarginClassName: 'editor-marked-error-glyph',
      },
    }))

    decorationsRef.current = editor.deltaDecorations(decorationsRef.current, newDecorations)
  }, [markedLines])

  return (
    <div style={{ height: '100%', width: '100%', position: 'relative', overflow: 'hidden' }}>
      <Editor
        height="100%"
        language="cpp"
        theme="vs-dark"
        value={value}
        onChange={(val) => {
          if (typeof onChange === 'function') {
            onChange(val || '')
          }
        }}
        onMount={handleEditorDidMount}
        loading={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--muted)' }}>
            Đang khởi tạo trình soạn thảo Monaco…
          </div>
        }
        options={{
          readOnly,
          fontSize: 14,
          fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', 'Courier New', monospace",
          fontLigatures: true,
          tabSize: 4,
          insertSpaces: true,
          autoClosingBrackets: 'always',
          autoClosingQuotes: 'always',
          suggestOnTriggerCharacters: true,
          quickSuggestions: { other: true, comments: false, strings: false },
          snippetSuggestions: 'top',
          wordBasedSuggestions: 'currentDocument',
          minimap: { enabled: !readOnly, maxColumn: 80 },
          scrollBeyondLastLine: false,
          automaticLayout: true,
          smoothScrolling: true,
          cursorBlinking: 'smooth',
          renderLineHighlight: 'all',
          lineNumbersMinChars: 3,
          lineDecorationsWidth: 6,
          overviewRulerBorder: false,
          hideCursorInOverviewRuler: true,
        }}
      />
    </div>
  )
}
