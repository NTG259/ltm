import { useState } from 'react'
import { ArrowLeft, Clipboard, Download, FileQuestion, PencilLine, Server, ShieldAlert, Trophy } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth/context'
import { useLiveSubmission } from '../lib/hooks'
import { formatClock, formatDateTime, formatMemory, formatTime } from '../lib/format'
import CodeEditor from '../components/CodeEditor'
import TestResults from '../components/TestResults'
import VerdictTag from '../components/VerdictTag'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from '../components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '../components/ui/empty'
import { Separator } from '../components/ui/separator'
import { Skeleton } from '../components/ui/skeleton'

function SubmissionLoading() {
  return (
    <div className="page flex flex-col gap-4" aria-busy="true" aria-label="Đang tải bài nộp">
      <Skeleton className="h-8 w-72" />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <Skeleton className="h-[560px] w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    </div>
  )
}

function SubmissionUnavailable({ forbidden, onBack }) {
  return (
    <div className="page">
      <Card>
        <CardContent>
          <Empty className="min-h-72">
            <EmptyHeader>
              <EmptyMedia variant="icon">{forbidden ? <ShieldAlert /> : <FileQuestion />}</EmptyMedia>
              <EmptyTitle>{forbidden ? 'Bạn không có quyền xem bài nộp này' : 'Không tìm thấy bài nộp'}</EmptyTitle>
              <EmptyDescription>
                {forbidden ? 'Chỉ chủ sở hữu hoặc giảng viên phụ trách mới có thể xem nội dung.' : 'Bài nộp có thể đã bị xóa hoặc đường dẫn không hợp lệ.'}
              </EmptyDescription>
            </EmptyHeader>
            <Button variant="outline" onClick={onBack}>Quay lại</Button>
          </Empty>
        </CardContent>
      </Card>
    </div>
  )
}

export default function SubmissionDetailPage() {
  const { id } = useParams()
  const { user, isAdmin, isLecturer } = useAuth()
  const { sub: submission, error } = useLiveSubmission(id)
  const navigate = useNavigate()
  const [copied, setCopied] = useState(false)

  const returnPath = isAdmin ? '/admin/submissions' : isLecturer ? '/teacher/submissions' : '/submissions'

  if (error) return <SubmissionUnavailable onBack={() => navigate(returnPath)} />
  if (!submission) return <SubmissionLoading />
  if (!isAdmin && !isLecturer && submission.userId !== user.id) {
    return <SubmissionUnavailable forbidden onBack={() => navigate(returnPath)} />
  }

  const problemPath = isAdmin
    ? `/admin/problems/${submission.problemId}`
    : isLecturer ? `/teacher/problems/${submission.problemId}` : `/problems/${submission.problemId}`

  const download = () => {
    const url = URL.createObjectURL(new Blob([submission.sourceCode], { type: 'text/x-c++src' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `submission-${submission.id}.cpp`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const copySource = async () => {
    await navigator.clipboard?.writeText(submission.sourceCode)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  const editAndResubmit = () => {
    try {
      localStorage.setItem(`cj.draft.${user.id}.${submission.problemId}`, submission.sourceCode)
    } catch {
      // The workspace still opens when draft persistence is unavailable.
    }
    navigate(problemPath)
  }

  const marked = submission.verdict === 'CE'
    ? [...(submission.compileLog || '').matchAll(/solution\.cpp:(\d+):/g)].map((match) => Number(match[1]))
    : []
  if (submission.verdict === 'SEC') {
    submission.sourceCode
      .split('\n')
      .forEach((line, index) => /windows\.h|system\s*\(|fork\s*\(|exec|popen|unistd|socket\.h/.test(line) && marked.push(index + 1))
  }

  const history = (submission.history || []).filter(
    (item, index, items) => !(item.status === 'TESTING' && items[index + 1]?.status === 'TESTING'),
  )

  return (
    <div className={`page page--fill flex flex-col gap-4${(isAdmin || isLecturer) ? ' page--fluid' : ''}`}>
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" className="w-fit" onClick={() => navigate(returnPath)}>
          <ArrowLeft data-icon="inline-start" />
          Danh sách bài nộp
        </Button>
        <span className="text-sm text-muted-foreground">Bài nộp #{submission.id}</span>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 overflow-hidden lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <div className="flex min-h-0 min-w-0 flex-col gap-4 overflow-y-auto">
          {(submission.tests?.length > 0 || ['CE', 'SEC'].includes(submission.verdict)) && (
            <Card>
              <CardHeader>
                <CardTitle>Kết quả test case</CardTitle>
              </CardHeader>
              <CardContent><TestResults submission={submission} /></CardContent>
            </Card>
          )}

          <Card className="flex min-h-0 flex-1 flex-col">
            <CardHeader className="border-b">
              <CardTitle className="font-mono">solution.cpp</CardTitle>
              <CardAction className="flex flex-wrap justify-end gap-2">
                <Badge variant="secondary">{submission.language || 'cpp17'}</Badge>
                <Button variant="outline" size="sm" onClick={copySource}>
                  <Clipboard data-icon="inline-start" />
                  {copied ? 'Đã sao chép' : 'Sao chép'}
                </Button>
                <Button variant="outline" size="sm" onClick={download}>
                  <Download data-icon="inline-start" />
                  Tải .cpp
                </Button>
                {!isAdmin && (
                  <Button size="sm" onClick={editAndResubmit}>
                    <PencilLine data-icon="inline-start" />
                    Làm lại
                  </Button>
                )}
              </CardAction>
            </CardHeader>
            <CardContent className="min-h-0 flex-1 px-0">
              <CodeEditor value={submission.sourceCode} readOnly markedLines={marked} height="100%" minHeight="300px" />
            </CardContent>
          </Card>
        </div>

        <aside className="flex min-h-0 min-w-0 flex-col gap-4 overflow-y-auto">
          <Card>
            <CardHeader>
              <CardTitle>Thông tin bài nộp</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">Kết quả</span>
                <VerdictTag submission={submission} size="large" full />
              </div>
              <Separator />
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">Điểm số</span>
                <span className="font-semibold text-base">
                  {submission.score != null ? `${submission.score} / 100` : '—'}
                </span>
              </div>
              {((submission.progress && submission.progress.total > 0) || submission.tests?.length > 0) && (
                <>
                  <Separator />
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">Test case</span>
                    <span className="font-mono text-sm font-medium">
                      {submission.progress?.total
                        ? `${submission.progress.current} / ${submission.progress.total} (${Math.round((submission.progress.current / submission.progress.total) * 100)}%)`
                        : `${(submission.tests || []).filter((t) => t.status === 'AC').length} / ${submission.tests?.length || 0}`}
                    </span>
                  </div>
                </>
              )}
              <Separator />
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">Thời gian chạy</span>
                <span className="font-mono font-medium">{formatTime(submission.timeMs)}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">Bộ nhớ</span>
                <span className="font-mono font-medium">{formatMemory(submission.memoryKb)}</span>
              </div>
              <Separator />
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Đề bài</span>
                <Link to={problemPath} target="_blank" className="font-medium hover:underline">
                  #{submission.problemId} · {submission.problemTitle} ↗
                </Link>
              </div>
              <Separator />
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Thí sinh</span>
                <span className="font-medium">{submission.userName || submission.userId}</span>
                {submission.userName && submission.userName !== submission.userId && (
                  <span className="font-mono text-xs text-muted-foreground">{submission.userId}</span>
                )}
              </div>
              <Separator />
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Kỳ thi / Phạm vi</span>
                {submission.contestId ? (
                  <Link
                    to={isAdmin ? `/admin/contests/${submission.contestId}` : isLecturer ? `/teacher/contests/${submission.contestId}` : `/contests/${submission.contestId}`}
                    target="_blank"
                    className="font-medium text-primary hover:underline flex items-center gap-1"
                  >
                    <Trophy className="size-3.5" />
                    <span>{submission.contestTitle || `Kỳ thi #${submission.contestId}`} ↗</span>
                  </Link>
                ) : (
                  <span className="text-muted-foreground text-sm">Luyện tập tự do</span>
                )}
              </div>
              <Separator />
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Ngôn ngữ</span>
                <span className="font-mono">{submission.language || 'cpp17'} · g++ -O2</span>
              </div>
              <Separator />
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Thời điểm</span>
                <span>{formatDateTime(submission.createdAt)}</span>
              </div>
              {(isAdmin || isLecturer) && (
                <>
                  <Separator />
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">Máy chấm (Worker)</span>
                    {submission.workerId ? (
                      <Badge variant="outline" className="font-mono">
                        <Server data-icon="inline-start" className="mr-1 size-3" />
                        {submission.workerId}
                      </Badge>
                    ) : (
                      <span className="font-mono text-xs text-muted-foreground">—</span>
                    )}
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">Lần thử</span>
                    <span className="font-mono text-xs">{submission.attempts || 1} / 3</span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">Trạng thái</span>
                    <Badge variant="secondary" className="font-mono text-xs">
                      {submission.status || 'FINISHED'}
                    </Badge>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {(isAdmin || isLecturer) && history.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Dòng thời gian xử lý</CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="flex flex-col gap-0 border-l pl-4">
                  {history.map((item, index) => (
                    <li className="relative pb-4 last:pb-0" key={`${item.time}-${index}`}>
                      <span className="absolute -left-[21px] top-1.5 size-2 rounded-full bg-primary" aria-hidden="true" />
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground">{formatClock(item.time)}</span>
                        <Badge variant="outline" className="font-mono">{item.status}</Badge>
                        {item.workerId && <span className="font-mono text-xs text-muted-foreground">@ {item.workerId}</span>}
                      </div>
                      {item.note && <p className="mt-1 text-sm text-muted-foreground">{item.note}</p>}
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          )}
        </aside>
      </div>
    </div>
  )
}
