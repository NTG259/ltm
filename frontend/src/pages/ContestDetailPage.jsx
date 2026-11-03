import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { AlertCircle, CheckCircle2, Lock, SearchX, ShieldAlert } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth/context'
import { useFetch, useNow, useSocket } from '../lib/hooks'
import { formatDateTime, formatDuration, formatRelative } from '../lib/format'
import { CONTEST_STATUS, liveStatus } from '../lib/contest'
import ContestClock from '../components/ContestClock'
import ContestStandings from '../components/ContestStandings'
import ContestProctoring from '../components/ContestProctoring'
import ContestPlagiarism from '../components/ContestPlagiarism'
import VerdictTag from '../components/VerdictTag'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '../components/ui/alert-dialog'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '../components/ui/empty'
import { Spinner } from '../components/ui/spinner'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'

const STATUS_BADGE = {
  RUNNING: 'default',
  UPCOMING: 'secondary',
  ENDED: 'outline',
}

function ProblemsTab({ contest, status, mySubs, canSolve }) {
  const { isAdmin, isLecturer } = useAuth()
  const isStaff = isAdmin || isLecturer
  const navigate = useNavigate()
  if (status === 'UPCOMING')
    return (
      <Empty className="border-0 py-12">
        <EmptyHeader>
          <Lock className="size-8 text-muted-foreground/50 mb-2" />
          <EmptyTitle>Đề bài sẽ hiện khi kỳ thi bắt đầu</EmptyTitle>
        </EmptyHeader>
      </Empty>
    )

  if (status === 'RUNNING' && !isStaff)
    return (
      <Empty className="border-0 py-12">
        <EmptyHeader>
          <Lock className="size-8 text-muted-foreground/50 mb-2" />
          <EmptyTitle>Đề bài sẽ hiển thị sau khi bạn vào phòng thi</EmptyTitle>
        </EmptyHeader>
      </Empty>
    )

  const mine = {}
  mySubs.forEach((s) => {
    if (s.verdict === 'AC') mine[s.problemId] = 'solved'
    else if (!mine[s.problemId]) mine[s.problemId] = 'tried'
  })
  const open = (p) => navigate(isAdmin ? `/admin/contests/${contest.id}/problems/${p.label}` : isLecturer ? `/teacher/contests/${contest.id}/problems/${p.label}` : `/contests/${contest.id}/problems/${p.label}`)

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-10"><span className="sr-only">Trạng thái</span></TableHead>
          <TableHead className="w-16">Bài</TableHead>
          <TableHead>Tên bài</TableHead>
          <TableHead>Giới hạn</TableHead>
          <TableHead>Đã giải</TableHead>
          <TableHead><span className="sr-only">Thao tác</span></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {contest.problems.map((problem) => (
          <TableRow key={problem.label}>
            <TableCell className="text-center">
              {mine[problem.problemId] === 'solved' ? (
                <CheckCircle2 className="size-4 text-primary" aria-label="Đã giải" />
              ) : mine[problem.problemId] ? (
                <AlertCircle className="size-4 text-muted-foreground" aria-label="Đã thử" />
              ) : null}
            </TableCell>
            <TableCell className="font-mono text-base font-semibold">{problem.label}</TableCell>
            <TableCell className="font-medium">{problem.title}</TableCell>
            <TableCell className="font-mono text-xs text-muted-foreground">
              {problem.timeLimitMs / 1000}s · {problem.memoryLimitMb}MB
            </TableCell>
            <TableCell className="font-mono" title={`${problem.solvedCount} thí sinh AC / ${problem.attemptCount} thí sinh đã nộp`}>
              {problem.solvedCount}/{problem.attemptCount}
            </TableCell>
            <TableCell className="text-left">
              {canSolve && (
                <Button size="sm" variant={status === 'RUNNING' ? 'default' : 'outline'} onClick={() => open(problem)}>
                  {status === 'RUNNING' ? 'Làm bài' : 'Luyện tập'}
                </Button>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function SubmissionsTab({ subs, labels, showUser }) {
  const { isAdmin, isLecturer } = useAuth()
  const now = useNow(15000)
  const [page, setPage] = useState(1)
  const pageSize = 15
  const pageCount = Math.max(1, Math.ceil(subs.length / pageSize))
  const visibleSubs = subs.slice((page - 1) * pageSize, page * pageSize)

  if (!subs.length) {
    return (
      <Empty className="border-0 py-12">
        <EmptyHeader>
          <EmptyTitle>Chưa có bài nộp</EmptyTitle>
          <EmptyDescription>Các lần nộp bài trong kỳ thi sẽ xuất hiện tại đây.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ID</TableHead>
            <TableHead>Thời điểm</TableHead>
            {showUser && <TableHead>Thí sinh</TableHead>}
            <TableHead>Bài</TableHead>
            <TableHead>Kết quả</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visibleSubs.map((submission) => (
            <TableRow key={submission.id}>
              <TableCell>
                <Link
                  to={isAdmin ? `/admin/submissions/${submission.id}` : isLecturer ? `/teacher/submissions/${submission.id}` : `/submissions/${submission.id}`}
                  className="font-mono text-primary underline-offset-4 hover:underline"
                >
                  #{submission.id}
                </Link>
              </TableCell>
              <TableCell>{formatRelative(submission.createdAt, now)}</TableCell>
              {showUser && <TableCell>{submission.userName} ({submission.userId})</TableCell>}
              <TableCell>{labels[submission.problemId] ?? '?'}. {submission.problemTitle}</TableCell>
              <TableCell><VerdictTag submission={submission} showIcon={false} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {pageCount > 1 && (
        <div className="flex items-center justify-end gap-2 border-t px-4 py-3">
          <span className="mr-auto text-sm text-muted-foreground">Trang {page}/{pageCount}</span>
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((value) => value - 1)}>Trước</Button>
          <Button variant="outline" size="sm" disabled={page === pageCount} onClick={() => setPage((value) => value + 1)}>Sau</Button>
        </div>
      )}
    </div>
  )
}

export default function ContestDetailPage() {
  const { id } = useParams()
  const { user, isAdmin, isLecturer } = useAuth()
  const isStaff = isAdmin || isLecturer
  const navigate = useNavigate()
  const now = useNow(1000)
  const [tab, setTab] = useState('problems')
  const [examDialogOpen, setExamDialogOpen] = useState(false)
  const contest = useFetch(() => api.getContest(id, user), [id, user])
  const standings = useFetch(() => api.contestStandings(id), [id])
  const subs = useFetch(
    () => api.listSubmissions({ contestId: id, userId: isStaff ? undefined : user.id }),
    [id, user.id, isStaff],
  )
  const c = contest.data
  const status = c ? liveStatus(c, now) : null
  const { reload: reloadContest } = contest
  const { reload: reloadStandings } = standings
  const { reload: reloadSubs } = subs

  const prevStatus = useRef(null)
  useEffect(() => {
    if (prevStatus.current && status && prevStatus.current !== status) reloadContest()
    prevStatus.current = status
  }, [status, reloadContest])

  useSocket(
    useCallback(
      (msg) => {
        if (msg.type === 'CONTEST_UPDATE' && msg.contestId === Number(id)) reloadContest()
        if (msg.type === 'SUBMISSION_UPDATE' && msg.submission.contestId === Number(id)) {
          if (msg.submission.status === 'FINISHED' || msg.submission.status === 'IN_QUEUE') reloadStandings()
          reloadSubs()
        }
      },
      [id, reloadContest, reloadStandings, reloadSubs],
    ),
  )

  const labels = useMemo(() => Object.fromEntries((c?.problems || []).map((p) => [p.problemId, p.label])), [c])

  if (contest.error)
    return (
      <Card className="mx-auto max-w-xl">
        <CardContent>
          <Empty className="border-0 py-12">
            <EmptyHeader>
              <EmptyMedia variant="icon"><SearchX /></EmptyMedia>
              <EmptyTitle>Không tìm thấy kỳ thi</EmptyTitle>
              <EmptyDescription>Kỳ thi không tồn tại hoặc bạn không có quyền truy cập.</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button onClick={() => navigate('/contests')}>Danh sách kỳ thi</Button>
            </EmptyContent>
          </Empty>
        </CardContent>
      </Card>
    )
  if (!c) return <div className="flex justify-center py-20"><Spinner className="size-6 text-muted-foreground" /></div>

  const canSolve = isStaff || status === 'ENDED' || status === 'RUNNING'
  const badgeVariant = STATUS_BADGE[status] || STATUS_BADGE.ENDED

  return (
    <div className="page flex flex-col gap-3">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant={badgeVariant}>{CONTEST_STATUS[status]?.label}</Badge>
            <Badge variant="secondary">ICPC</Badge>
          </div>
          <CardTitle>{c.title}</CardTitle>
          <CardDescription>
            Bắt đầu: {formatDateTime(c.startAt)} · {formatDuration(c.durationMin)} · {c.participantCount} thí sinh
          </CardDescription>
          <CardAction className="flex flex-col items-end gap-2 pl-4">
              <ContestClock contest={c} />
              {!isStaff && status === 'RUNNING' && (
                <Button size="lg" disabled={!!c.finished} onClick={() => setExamDialogOpen(true)}>
                  {c.finished ? 'Đã nộp bài' : 'Vào phòng thi'}
                </Button>
              )}
          </CardAction>
        </CardHeader>
      </Card>

      <Card>
        <CardContent className="p-0 pt-2">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList variant="line" className="px-4 w-full justify-start rounded-none border-b border-border/50">
              <TabsTrigger value="problems">Đề bài</TabsTrigger>
              <TabsTrigger value="standings">Xếp hạng</TabsTrigger>
              <TabsTrigger value="subs">Bài nộp</TabsTrigger>
              {isStaff && (
                <TabsTrigger value="proctor">Giám sát</TabsTrigger>
              )}
              {isStaff && (
                <TabsTrigger value="plagiarism">Chống đạo văn</TabsTrigger>
              )}
              {!isStaff && <TabsTrigger value="rules">Thể lệ</TabsTrigger>}
            </TabsList>

            <TabsContent value="problems">
              <ProblemsTab contest={c} status={status} mySubs={subs.data || []} canSolve={canSolve} />
            </TabsContent>
            <TabsContent value="standings" className="p-4">
              <ContestStandings
                data={standings.data}
                loading={standings.loading && !standings.data}
                currentUserId={user.id}
                problems={c.problems}
                contestTitle={c.title}
              />
            </TabsContent>
            <TabsContent value="subs">
              <SubmissionsTab subs={subs.data || []} labels={labels} showUser={isStaff} />
            </TabsContent>
            {isStaff && (
              <TabsContent value="proctor" className="p-4">
                <ContestProctoring contestId={c.id} />
              </TabsContent>
            )}
            {isStaff && (
              <TabsContent value="plagiarism" className="p-4">
                <ContestPlagiarism contestId={c.id} />
              </TabsContent>
            )}
            {!isStaff && (
              <TabsContent value="rules" className="p-4">
                <div className="statement">
                  <p>{c.description}</p>
                  <h3>Cách tính điểm</h3>
                  <p>
                    Xếp hạng theo số bài giải đúng (AC). Nếu bằng nhau, thí sinh có tổng thời gian đến khi AC ít hơn xếp trên.
                    Các lần nộp sai không cộng thêm thời gian.
                  </p>
                  <h3>Quy định</h3>
                  <p>
                    Chỉ thí sinh đã đăng ký mới được nộp bài. Ngôn ngữ C++17. Bài nộp sau khi kỳ thi kết thúc không được tính vào
                    bảng xếp hạng.
                  </p>
                </div>
              </TabsContent>
            )}
          </Tabs>
        </CardContent>
      </Card>

      <AlertDialog open={examDialogOpen} onOpenChange={setExamDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldAlert className="size-5 text-destructive" />
              Quy định phòng thi
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                <p>Trước khi vào phòng thi, bạn cần nắm rõ các quy định sau:</p>
                <ul className="list-disc space-y-1.5 pl-5">
                  <li>Không được chuyển tab, thu nhỏ cửa sổ hoặc rời khỏi trang thi trong suốt thời gian làm bài.</li>
                  <li>Mỗi lần vi phạm sẽ được <strong>ghi lại tự động</strong> và báo cáo tới giảng viên.</li>
                  <li>Tích lũy vi phạm có thể ảnh hưởng đến kết quả thi của bạn.</li>
                </ul>
                <p className="text-muted-foreground">Bằng cách nhấn <strong>Xác nhận vào thi</strong>, bạn đồng ý tuân thủ các quy định trên.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Quay lại</AlertDialogCancel>
            <AlertDialogAction onClick={() => navigate(`/contests/${c.id}/exam`)}>
              Xác nhận vào thi
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
