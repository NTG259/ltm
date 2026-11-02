import { useMemo, useState } from 'react'
import { AlertCircle, Check, Code2, Copy, Lightbulb, TriangleAlert } from 'lucide-react'
import { explainCompileLog } from '../lib/compilerExplainer'
import { Alert, AlertDescription, AlertTitle } from './ui/alert'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'

export default function CompilerErrorExplainer({ compileLog }) {
  const [viewMode, setViewMode] = useState('vi')
  const [copied, setCopied] = useState(false)
  const analysis = useMemo(() => explainCompileLog(compileLog), [compileLog])

  const copyLog = () => {
    if (!compileLog) return
    navigator.clipboard?.writeText(compileLog).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  if (!compileLog?.trim()) {
    return <p className="text-sm text-muted-foreground">Không có thông tin lỗi biên dịch.</p>
  }

  return (
    <div className="grid w-full gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="destructive"><AlertCircle data-icon="inline-start" /> Lỗi biên dịch g++ (CE)</Badge>
          {analysis.errors.length > 0 && <Badge variant="outline">{analysis.errors.length} lỗi phát hiện</Badge>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border bg-muted/40 p-1">
            <Button size="sm" variant={viewMode === 'vi' ? 'default' : 'ghost'} onClick={() => setViewMode('vi')}>
              <Lightbulb data-icon="inline-start" /> Giải thích
            </Button>
            <Button size="sm" variant={viewMode === 'raw' ? 'default' : 'ghost'} onClick={() => setViewMode('raw')}>
              <Code2 data-icon="inline-start" /> Log gốc
            </Button>
          </div>
          <Button size="sm" variant="outline" onClick={copyLog}>
            {copied ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}
            {copied ? 'Đã chép' : 'Sao chép'}
          </Button>
        </div>
      </div>

      {viewMode === 'raw' ? (
        <pre className="console-log m-0 max-h-96 overflow-y-auto">{compileLog}</pre>
      ) : analysis.hasExplanation ? (
        <div className="grid gap-3">
          {analysis.errors.map((error, index) => (
            <Card key={`${error.line || 'unknown'}-${index}`} size="sm">
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center gap-2">
                  {error.severity === 'warning' ? <TriangleAlert /> : <AlertCircle />}
                  {error.titleVi}
                  {error.line && <Badge variant="outline">Dòng {error.line}{error.column ? `, cột ${error.column}` : ''}</Badge>}
                </CardTitle>
                <CardDescription>{error.explanationVi}</CardDescription>
              </CardHeader>
              {error.suggestionVi && (
                <CardContent>
                  <Alert>
                    <Lightbulb />
                    <AlertTitle>Gợi ý sửa</AlertTitle>
                    <AlertDescription>{error.suggestionVi}</AlertDescription>
                  </Alert>
                </CardContent>
              )}
            </Card>
          ))}
          <Alert>
            <Lightbulb />
            <AlertTitle>Mẹo</AlertTitle>
            <AlertDescription>Sửa các dòng được đánh dấu, sau đó chạy thử hoặc nộp bài lại.</AlertDescription>
          </Alert>
        </div>
      ) : (
        <div className="grid gap-2">
          <Alert variant="destructive">
            <TriangleAlert />
            <AlertTitle>Chưa có giải thích cụ thể</AlertTitle>
            <AlertDescription>Kiểm tra thông báo gốc từ g++ bên dưới.</AlertDescription>
          </Alert>
          <pre className="console-log">{compileLog}</pre>
        </div>
      )}
    </div>
  )
}
