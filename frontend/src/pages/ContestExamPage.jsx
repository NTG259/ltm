import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckCircle2, ChevronLeft, History, Trophy, TriangleAlert } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth/context'
import { useFetch, useNow, useSocket } from '../lib/hooks'
import { liveStatus } from '../lib/contest'
import { useProctoring } from '../lib/useProctoring'
import ContestClock from '../components/ContestClock'
import ContestStandings from '../components/ContestStandings'
import VerdictTag from '../components/VerdictTag'
import { Workspace } from './WorkspacePage'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '../components/ui/alert-dialog'
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '../components/ui/empty'
import { Skeleton } from '../components/ui/skeleton'
import { Spinner } from '../components/ui/spinner'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'

function SubmissionsTab({ contestId, user }) {
  const submissions = useFetch(
    () => api.listSubmissions({ contestId, userId: user?.id }),
    [contestId, user?.id],
  )

  if (submissions.loading && !submissions.data) {
    return <div className="space-y-2 p-4">{Array.from({ length: 5 }, (_, index) => <Skeleton key={index} className="h-10 w-full" />)}</div>
  }
  if (!submissions.data?.length) {
    return (
      <Empty className="border-0 py-12">
        <EmptyHeader><EmptyTitle>Chưa có bài nộp</EmptyTitle><EmptyDescription>Các lần nộp trong kỳ thi sẽ xuất hiện tại đây.</EmptyDescription></EmptyHeader>
      </Empty>
    )
  }
  return (
    <Table>
      <TableHeader><TableRow><TableHead>#</TableHead><TableHead>Bài</TableHead><TableHead>Kết quả</TableHead><TableHead>Điểm</TableHead><TableHead>Thời gian</TableHead></TableRow></TableHeader>
      <TableBody>
        {submissions.data.map((submission, index) => (
          <TableRow key={submission.id}>
            <TableCell className="text-muted-foreground">{index + 1}</TableCell>
            <TableCell className="font-medium">{submission.problemTitle || submission.problemId}</TableCell>
            <TableCell><VerdictTag submission={submission} showIcon={false} /></TableCell>
            <TableCell>{submission.score ?? '—'}</TableCell>
            <TableCell className="text-xs text-muted-foreground">{submission.createdAt ? new Date(submission.createdAt).toLocaleTimeString('vi-VN') : '—'}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

export default function ContestExamPage() {
  const { cid } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const now = useNow(1000)
  const contestQuery = useFetch(() => api.getContest(cid, user), [cid, user])
  const standings = useFetch(() => api.contestStandings(cid), [cid])
  const contest = contestQuery.data
  const contestId = contest?.id
  const isRegistered = contest?.registered
  const isRunning = contest ? liveStatus(contest, now) === 'RUNNING' : false
  const [registrationFailed, setRegistrationFailed] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [finishOpen, setFinishOpen] = useState(false)
  const [selectedLabel, setSelectedLabel] = useState(null)
  const [activeTab, setActiveTab] = useState('problems')
  const [feedback, setFeedback] = useState(null)
  const [violationModalOpen, setViolationModalOpen] = useState(false)
  const [modalViolationCount, setModalViolationCount] = useState(0)

  const reloadContest = contestQuery.reload
  const reloadStandings = standings.reload
  const isEnded = contest ? liveStatus(contest, now) === 'ENDED' : false
  const needsAutoRegistration = !!contestId && !isRegistered && isRunning && !registrationFailed
  useEffect(() => {
    if (!needsAutoRegistration) return undefined
    let alive = true
    api.registerContest(contestId)
      .then(() => alive && reloadContest())
      .catch(() => alive && setRegistrationFailed(true))
    return () => { alive = false }
  }, [contestId, needsAutoRegistration, reloadContest])

  useEffect(() => {
    if (contest?.finished) navigate(`/contests/${cid}`, { replace: true })
  }, [contest?.finished, cid, navigate])

  const handleViolation = useCallback((count) => {
    setModalViolationCount(count)
    setViolationModalOpen(true)
  }, [])

  const { violationCount } = useProctoring({
    contest,
    user,
    enabled: !!contest && isRunning && !contest.finished,
    onViolation: handleViolation,
  })

  useSocket(useCallback((message) => {
    if (message.type === 'SUBMISSION_UPDATE' && message.submission?.contestId === Number(cid)) reloadStandings()
  }, [cid, reloadStandings]))

  const problems = useMemo(() => contest?.problems || [], [contest])
  const mySubs = useFetch(
    () => (user?.id ? api.listSubmissions({ contestId: cid, userId: user.id }) : Promise.resolve([])),
    [cid, user?.id],
  )
  const solvedProblemIds = useMemo(() => new Set(
    (mySubs.data || []).filter((submission) => submission.verdict === 'AC').map((submission) => submission.problemId),
  ), [mySubs.data])

  const finishExam = async () => {
    setFinishing(true)
    setFeedback(null)
    try {
      await api.finishContest(cid)
      navigate(`/contests/${cid}`)
    } catch (error) {
      setFeedback(error.message || 'Không thể kết thúc bài thi')
      setFinishOpen(false)
    } finally {
      setFinishing(false)
    }
  }

  if (contestQuery.error) {
    return <Empty className="min-h-screen border-0"><EmptyHeader><EmptyTitle>Không tìm thấy kỳ thi</EmptyTitle><EmptyDescription>Kỳ thi không tồn tại hoặc bạn không có quyền truy cập.</EmptyDescription></EmptyHeader></Empty>
  }
  if (isEnded) {
    return <Empty className="min-h-screen border-0"><EmptyHeader><EmptyTitle>Kỳ thi đã kết thúc</EmptyTitle><EmptyDescription>Không thể vào phòng thi sau khi kỳ thi đã kết thúc.</EmptyDescription></EmptyHeader></Empty>
  }
  if (!contest || contestQuery.loading || needsAutoRegistration) {
    return <div className="flex min-h-screen items-center justify-center"><Spinner className="size-6" /></div>
  }

  const currentProblem = selectedLabel ? problems.find((problem) => problem.label === selectedLabel) : null

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b bg-card px-4">
        <div className="flex min-w-0 items-center gap-3">
          <h1 className="truncate font-heading text-sm font-medium sm:text-base">{contest.title}</h1>
          <ContestClock contest={contest} compact />
        </div>
        <div className="flex items-center gap-2">
          {violationCount > 0 && <Badge variant="destructive"><TriangleAlert data-icon="inline-start" /> {violationCount} vi phạm</Badge>}
          <Button variant="destructive" onClick={() => setFinishOpen(true)}>Kết thúc</Button>
        </div>
      </header>

      {feedback && <Alert variant="destructive" className="m-3"><TriangleAlert /><AlertTitle>Không thể kết thúc bài thi</AlertTitle><AlertDescription>{feedback}</AlertDescription></Alert>}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex min-h-0 flex-1 flex-col">
        <TabsList variant="line" className="h-12 w-full shrink-0 justify-start rounded-none border-b bg-card px-4">
          <TabsTrigger value="problems">Làm bài <Badge variant="secondary">{solvedProblemIds.size}/{problems.length}</Badge></TabsTrigger>
          <TabsTrigger value="history"><History /> Lịch sử nộp</TabsTrigger>
          <TabsTrigger value="standings"><Trophy /> Xếp hạng</TabsTrigger>
        </TabsList>
        <TabsContent value="problems" className="min-h-0 flex-1 overflow-auto">
          {currentProblem ? (
            <div className="flex h-full flex-col overflow-hidden">
              <div className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
                <Button size="sm" variant="ghost" onClick={() => setSelectedLabel(null)}><ChevronLeft data-icon="inline-start" /> Danh sách bài</Button>
                <span className="font-medium">{currentProblem.label}. {currentProblem.title}</span>
              </div>
              <div className="min-h-0 flex-1"><Workspace key={`${cid}-${currentProblem.label}`} id={String(currentProblem.problemId)} contest={contest} label={currentProblem.label} /></div>
            </div>
          ) : (
            <div className="mx-auto grid w-full max-w-4xl gap-3 p-4 sm:p-6">
              <div><h2 className="font-heading text-lg font-medium">Danh sách bài thi</h2><p className="text-sm text-muted-foreground">Chọn một bài để bắt đầu làm.</p></div>
              {problems.map((problem) => {
                const solved = solvedProblemIds.has(problem.problemId)
                return (
                  <Card key={problem.label} className="cursor-pointer transition-colors hover:bg-muted/40" onClick={() => setSelectedLabel(problem.label)}>
                    <CardHeader>
                      <CardTitle>{problem.label}. {problem.title}</CardTitle>
                      <CardDescription>{problem.timeLimitMs / 1000}s · {problem.memoryLimitMb}MB</CardDescription>
                      <CardAction>{solved ? <Badge><CheckCircle2 data-icon="inline-start" /> Đã giải</Badge> : <Button size="sm">Làm bài</Button>}</CardAction>
                    </CardHeader>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>
        <TabsContent value="history" className="min-h-0 flex-1 overflow-auto p-4"><SubmissionsTab contestId={cid} user={user} /></TabsContent>
        <TabsContent value="standings" className="min-h-0 flex-1 overflow-auto p-4">
          <ContestStandings data={standings.data} loading={standings.loading && !standings.data} currentUserId={user.id} problems={problems} contestTitle={contest.title} />
        </TabsContent>
      </Tabs>

      <AlertDialog open={finishOpen} onOpenChange={setFinishOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Kết thúc bài thi?</AlertDialogTitle><AlertDialogDescription>Sau khi kết thúc, bạn sẽ không thể vào lại phòng thi này.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Tiếp tục làm bài</AlertDialogCancel><AlertDialogAction variant="destructive" disabled={finishing} onClick={finishExam}>{finishing && <Spinner data-icon="inline-start" />} Kết thúc</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={violationModalOpen} onOpenChange={() => {}}>
        <DialogContent showCloseButton={false} onEscapeKeyDown={(event) => event.preventDefault()} onPointerDownOutside={(event) => event.preventDefault()}>
          <DialogHeader><DialogTitle className="flex items-center gap-2 text-destructive"><TriangleAlert /> Thí sinh đã vi phạm</DialogTitle><DialogDescription>Bạn vừa rời khỏi màn hình làm bài. Hành vi này đã được ghi lại.</DialogDescription></DialogHeader>
          <p className="text-sm">Số lần vi phạm: <strong>{modalViolationCount}</strong></p>
          <DialogFooter><Button variant="destructive" onClick={() => setViolationModalOpen(false)}>Tôi đã hiểu</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
