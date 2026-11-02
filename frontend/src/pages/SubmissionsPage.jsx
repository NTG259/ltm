import { useCallback, useMemo, useRef } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth/context'
import { useFetch, useNow, useSocket } from '../lib/hooks'
import { VERDICT_KEYS, VERDICTS } from '../lib/verdicts'
import { formatDateTime, formatMemory, formatRelative, formatTime } from '../lib/format'
import VerdictTag from '../components/VerdictTag'
import AdminPageHeader from '../components/admin/AdminPageHeader'
import StudentPageHeader from '../components/student/StudentPageHeader'
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert'
import { Badge } from '../components/ui/badge'
import { Card, CardContent } from '../components/ui/card'
import { Button } from '../components/ui/button'
import {
  Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle,
} from '../components/ui/empty'
import {
  InputGroup, InputGroupAddon, InputGroupInput,
} from '../components/ui/input-group'
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select'
import { Skeleton } from '../components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../components/ui/table'
import { FileText, Search, Server } from 'lucide-react'

const PAGE_SIZE = 50

const VERDICT_OPTIONS = [
  { value: 'all', label: 'Tất cả kết quả' },
  { value: 'PENDING', label: 'Đang chờ / đang chấm' },
  ...VERDICT_KEYS.map((v) => ({ value: v, label: `${v} – ${VERDICTS[v].label}` })),
]

function LoadingRows() {
  return (
    <div aria-busy="true" aria-label="Đang tải bài nộp" className="flex flex-col gap-3 p-4">
      {Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-10 w-full" />)}
    </div>
  )
}

export default function SubmissionsPage({ admin, teacher }) {
  const { user } = useAuth()
  const isLecturer = teacher || (!admin && user?.role === 'lecturer') || (admin && user?.role === 'lecturer')
  const isStaff = admin || isLecturer
  const now = useNow(10000)
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const { data: classrooms, loading: loadingClassrooms } = useFetch(
    () => (isLecturer ? api.listClassrooms() : Promise.resolve([])),
    [isLecturer],
  )

  const classroomIdParam = searchParams.get('classroomId')
  const activeClassroomId = isLecturer
    ? (classroomIdParam ? Number(classroomIdParam) : (classrooms?.[0]?.id ?? null))
    : null

  const verdict = searchParams.get('verdict') || null
  const problemId = searchParams.get('problemId') ? Number(searchParams.get('problemId')) : null
  const student = searchParams.get('student') || ''
  const page = searchParams.get('page') ? Number(searchParams.get('page')) : 0
  const debounceRef = useRef(null)

  const setParam = (key, val) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (val) next.set(key, val)
      else next.delete(key)
      if (key !== 'page') next.delete('page')
      return next
    }, { replace: true })
  }

  const onStudentChange = (val) => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setParam('student', val), 300)
  }

  const staffQuery = isStaff
    ? {
        userId: student || undefined,
        problemId: problemId || undefined,
        verdict: verdict || undefined,
        classroomId: isLecturer ? (activeClassroomId || undefined) : undefined,
        page,
        size: PAGE_SIZE,
      }
    : null

  const subs = useFetch(
    () => isStaff
      ? api.listSubmissions(staffQuery)
      : api.listSubmissions({ userId: user.id }),
    isStaff ? [student, problemId, verdict, activeClassroomId, page] : [user.id],
  )
  const problems = useFetch(() => api.listProblems(), [])
  const { setData } = subs

  useSocket(
    useCallback(
      (msg) => {
        if (msg.type !== 'SUBMISSION_UPDATE') return
        const s = msg.submission
        if (!isStaff && s.userId !== user.id) return
        // eslint-disable-next-line no-unused-vars
        const { sourceCode, tests, history, ...row } = s
        setData((prev) => {
          if (!prev) return prev
          const list = Array.isArray(prev) ? prev : (prev.submissions || [])
          const i = list.findIndex((x) => x.id === s.id)
          const next = i < 0 ? [row, ...list] : list.map((x, idx) => idx === i ? { ...x, ...row } : x)
          return Array.isArray(prev) ? next : { ...prev, submissions: next }
        })
      },
      [isStaff, user.id, setData],
    ),
  )

  const { rows, total } = useMemo(() => {
    const d = subs.data
    if (!d) return { rows: [], total: 0 }
    if (Array.isArray(d)) {
      const filtered = d.filter(
        (s) =>
          (!verdict || (verdict === 'PENDING' ? s.status !== 'FINISHED' : s.verdict === verdict)) &&
          (!problemId || s.problemId === problemId) &&
          (!student || `${s.userId} ${s.userName}`.toLowerCase().includes(student.toLowerCase())),
      )
      return { rows: filtered, total: filtered.length }
    }
    return { rows: d.submissions || [], total: d.total || 0 }
  }, [subs.data, verdict, problemId, student])

  const stats = useMemo(() => {
    const list = Array.isArray(subs.data) ? (subs.data || []) : (subs.data?.submissions || [])
    const finished = list.filter((s) => s.status === 'FINISHED')
    return {
      total: isStaff ? total : list.length,
      pending: list.length - finished.length,
      ac: finished.filter((s) => s.verdict === 'AC').length,
      students: new Set(list.map((s) => s.userId)).size,
    }
  }, [subs.data, total, isStaff])

  const submissionPath = (id) => isLecturer
    ? `/teacher/submissions/${id}`
    : admin ? `/admin/submissions/${id}` : `/submissions/${id}`

  const problemOptions = [
    { value: 'all', label: 'Tất cả đề bài' },
    ...(Array.isArray(problems.data) ? problems.data : (problems.data?.problems || [])).map((p) => ({
      value: String(p.id),
      label: `#${p.id} ${p.title}`,
    })),
  ]

  const pageCount = isStaff ? Math.max(1, Math.ceil(total / PAGE_SIZE)) : 1

  return (
    <div className={`page flex flex-col gap-3${(admin || teacher) ? ' page--fluid' : ''}`}>
      {isStaff ? (
        <AdminPageHeader
          eyebrow={admin ? 'Vận hành' : 'Giảng dạy'}
          title={isLecturer ? 'Bài nộp theo lớp' : 'Bài nộp'}
        />
      ) : (
        <StudentPageHeader
          eyebrow="Hoạt động"
          title="Bài nộp của tôi"
          description="Theo dõi kết quả chấm, thời gian chạy và bộ nhớ của từng lần nộp."
        />
      )}

      <div className="stat-metrics">
        <div className="stat-metrics__item">
          <div className="stat-metrics__label">Tổng bài nộp</div>
          <div className="stat-metrics__value">{stats.total}</div>
        </div>
        <div className="stat-metrics__item">
          <div className="stat-metrics__label">Accepted</div>
          <div className="stat-metrics__value" style={{ color: 'var(--ac-fg)' }}>{stats.ac}</div>
        </div>
        <div className="stat-metrics__item">
          <div className="stat-metrics__label">Đang chờ / chấm</div>
          <div className="stat-metrics__value">{stats.pending}</div>
        </div>
        {isStaff && (
          <div className="stat-metrics__item">
            <div className="stat-metrics__label">Thí sinh</div>
            <div className="stat-metrics__value">{stats.students}</div>
          </div>
        )}
      </div>

      {isLecturer && (
        classrooms && classrooms.length > 0 ? (
          <Tabs
            value={activeClassroomId ? String(activeClassroomId) : undefined}
            onValueChange={(k) => setParam('classroomId', k)}
          >
            <TabsList className="h-auto flex-wrap">
              {classrooms.map((cls) => (
                <TabsTrigger key={cls.id} value={String(cls.id)}>
                  {cls.name}
                  {cls.semester && <Badge variant="outline" className="ml-2">{cls.semester}</Badge>}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        ) : !loadingClassrooms ? (
          <Alert>
            <AlertTitle>Bạn chưa có lớp học phụ trách</AlertTitle>
            <AlertDescription>Khi được phân công lớp học, bài nộp sẽ hiển thị tại đây.</AlertDescription>
          </Alert>
        ) : null
      )}

      <Card className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Danh sách bài nộp</p>
            <p className="text-xs text-muted-foreground">{isStaff ? total : rows.length} kết quả</p>
          </div>
          {isStaff && (
            <InputGroup className="w-full sm:w-48">
              <InputGroupAddon><Search /></InputGroupAddon>
              <InputGroupInput
                type="search"
                defaultValue={student}
                onChange={(e) => onStudentChange(e.target.value)}
                placeholder="MSSV hoặc họ tên"
                aria-label="Tìm theo sinh viên"
              />
            </InputGroup>
          )}
          <Select
            items={problemOptions}
            value={problemId ? String(problemId) : 'all'}
            onValueChange={(v) => setParam('problemId', v === 'all' ? null : v)}
          >
            <SelectTrigger className="w-full sm:w-56" aria-label="Lọc theo đề bài">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {problemOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Select
            items={VERDICT_OPTIONS}
            value={verdict || 'all'}
            onValueChange={(v) => setParam('verdict', v === 'all' ? null : v)}
          >
            <SelectTrigger className="w-full sm:w-44" aria-label="Lọc theo kết quả">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {VERDICT_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        <CardContent className="px-0 flex-1 min-h-0 overflow-y-auto">
          {subs.loading ? <LoadingRows /> : rows.length === 0 ? (
            <Empty className="min-h-52">
              <EmptyHeader>
                <EmptyMedia variant="icon"><FileText /></EmptyMedia>
                <EmptyTitle>Không có bài nộp</EmptyTitle>
                <EmptyDescription>Chưa có bài nộp nào phù hợp bộ lọc.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Thời điểm</TableHead>
                    {isStaff && <TableHead>Thí sinh</TableHead>}
                    <TableHead>Đề bài</TableHead>
                    <TableHead>Kết quả</TableHead>
                    {isStaff && <TableHead>Điểm</TableHead>}
                    <TableHead>Hiệu năng</TableHead>
                    {admin && <TableHead>Worker</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((s) => (
                    <TableRow
                      key={s.id}
                      className="cursor-pointer"
                      onClick={(e) => {
                        if (e.target.closest('a, button, input, [role="combobox"]')) return
                        navigate(submissionPath(s.id))
                      }}
                    >
                      <TableCell>
                        <Link
                          to={submissionPath(s.id)}
                          className="font-mono font-semibold text-foreground hover:underline"
                        >
                          #{s.id}
                        </Link>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        <span title={formatDateTime(s.createdAt)}>{formatRelative(s.createdAt, now)}</span>
                      </TableCell>
                      {isStaff && (
                        <TableCell>
                          <div className="flex flex-col gap-0.5">
                            <span className="font-medium">{s.userName}</span>
                            <button
                              type="button"
                              className="w-fit font-mono text-xs text-muted-foreground hover:text-foreground"
                              title="Bấm để lọc toàn bộ bài nộp của MSSV này"
                              onClick={(e) => {
                                e.stopPropagation()
                                onStudentChange(s.userId)
                              }}
                            >
                              {s.userId}
                            </button>
                          </div>
                        </TableCell>
                      )}
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <span className="font-medium">#{s.problemId} {s.problemTitle}</span>
                          <Link
                            to={`/problems/${s.problemId}`}
                            target="_blank"
                            onClick={(e) => e.stopPropagation()}
                            className="text-xs text-muted-foreground hover:text-foreground"
                          >
                            ↗
                          </Link>
                        </div>
                      </TableCell>
                      <TableCell><VerdictTag submission={s} showIcon={false} /></TableCell>
                      {isStaff && <TableCell>{s.score ?? '—'}</TableCell>}
                      <TableCell className="font-mono text-sm text-muted-foreground">
                        {formatTime(s.timeMs)}{s.memoryKb ? ` / ${formatMemory(s.memoryKb)}` : ''}
                      </TableCell>
                      {admin && (
                        <TableCell>
                          {s.workerId ? (
                            <Badge variant="outline" className="font-mono">
                              <Server className="mr-1 size-3" />
                              {s.workerId}{s.attempts > 1 ? ` ×${s.attempts}` : ''}
                            </Badge>
                          ) : '—'}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>

        {isStaff && !subs.loading && total > PAGE_SIZE && (
          <div className="flex items-center justify-between border-t px-4 py-3">
            <span className="text-sm text-muted-foreground">
              Trang {page + 1} / {pageCount} · {total} kết quả
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 0}
                onClick={() => setParam('page', page <= 1 ? null : String(page - 1))}>
                Trước
              </Button>
              <Button variant="outline" size="sm" disabled={page + 1 >= pageCount}
                onClick={() => setParam('page', String(page + 1))}>
                Sau
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
