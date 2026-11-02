import { useMemo, useRef, useState } from 'react'
import { ArrowUpDown, BookOpen, ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth/context'
import { useFetch } from '../lib/hooks'
import { percent } from '../lib/format'
import { DIFFICULTIES } from '../lib/verdicts'
import StudentPageHeader from '../components/student/StudentPageHeader'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '../components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '../components/ui/empty'
import { InputGroup, InputGroupAddon, InputGroupInput } from '../components/ui/input-group'
import { Progress } from '../components/ui/progress'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select'
import { Skeleton } from '../components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'

const PAGE_SIZE = 20
const DIFFICULTY_OPTIONS = [
  { value: 'all', label: 'Tất cả độ khó' },
  ...Object.entries(DIFFICULTIES).map(([value, item]) => ({ value, label: item.label })),
]

function ProblemTableSkeleton() {
  return (
    <div className="flex flex-col gap-3 p-4" aria-busy="true" aria-label="Đang tải bài tập">
      {Array.from({ length: 7 }, (_, index) => (
        <Skeleton key={index} className="h-11 w-full" />
      ))}
    </div>
  )
}

export default function ProblemsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [difficulty, setDifficulty] = useState('')
  const [tag, setTag] = useState(null)
  const [page, setPage] = useState(1)
  const [rateSort, setRateSort] = useState('none')
  const debounceRef = useRef(null)
  const [debouncedQ, setDebouncedQ] = useState('')

  const handleQueryChange = (event) => {
    const value = event.target.value
    setQuery(value)
    setPage(1)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setDebouncedQ(value), 300)
  }

  const problems = useFetch(
    () => api.searchProblems({ q: debouncedQ, difficulty, page, size: PAGE_SIZE }),
    [debouncedQ, difficulty, page],
  )
  const mine = useFetch(() => api.listSubmissions({ userId: user.id }), [user.id])

  const myStatus = useMemo(() => {
    const map = {}
    ;(mine.data || []).forEach((submission) => {
      if (submission.verdict === 'AC') map[submission.problemId] = 'solved'
      else if (!map[submission.problemId]) map[submission.problemId] = 'tried'
    })
    return map
  }, [mine.data])

  const tags = useMemo(
    () => [...new Set((problems.data?.problems || []).flatMap((problem) => problem.tags || []))],
    [problems.data],
  )
  const tagOptions = useMemo(() => [
    { value: 'all', label: 'Tất cả chủ đề' },
    ...tags.map((value) => ({ value, label: value })),
  ], [tags])
  const rows = useMemo(() => {
    const visible = (problems.data?.problems || []).filter(
      (problem) => !tag || (problem.tags || []).includes(tag),
    )
    if (rateSort === 'none') return visible
    return [...visible].sort((left, right) => {
      const delta = percent(left.acceptedSubmissions, left.totalSubmissions)
        - percent(right.acceptedSubmissions, right.totalSubmissions)
      return rateSort === 'asc' ? delta : -delta
    })
  }, [problems.data, rateSort, tag])

  const total = problems.data?.total ?? 0
  const solved = Object.values(myStatus).filter((status) => status === 'solved').length
  const solvedPercent = total ? Math.round((solved / total) * 100) : 0
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const cycleRateSort = () => {
    setRateSort((current) => current === 'none' ? 'desc' : current === 'desc' ? 'asc' : 'none')
  }

  return (
    <div className="page flex flex-col gap-5">
      <StudentPageHeader
        title="Kho bài tập"
        description="Chọn bài phù hợp, luyện tập theo chủ đề và theo dõi tiến độ của bạn."
        actions={(
          <div className="flex min-w-48 flex-col gap-1.5 rounded-lg border bg-card px-3 py-2">
            <div className="flex items-center justify-between gap-4 text-xs">
              <span className="text-muted-foreground">Đã giải</span>
              <strong className="font-mono">{solved}/{total || '…'}</strong>
            </div>
            <Progress value={solvedPercent} aria-label={`Đã giải ${solvedPercent}% bài tập`} />
          </div>
        )}
      />

      <Card size="sm">
        <CardHeader>
          <CardTitle>Bộ lọc bài tập</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <InputGroup className="w-full sm:w-72">
            <InputGroupAddon><Search /></InputGroupAddon>
            <InputGroupInput
              type="search"
              placeholder="Tìm theo tên hoặc mã bài (#1)…"
              value={query}
              onChange={handleQueryChange}
              aria-label="Tìm bài tập"
            />
          </InputGroup>

          <Select
            items={DIFFICULTY_OPTIONS}
            value={difficulty || 'all'}
            onValueChange={(value) => {
              setDifficulty(value === 'all' ? '' : value)
              setPage(1)
            }}
          >
            <SelectTrigger className="w-full sm:w-40" aria-label="Lọc theo độ khó">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="all">Tất cả độ khó</SelectItem>
                {Object.entries(DIFFICULTIES).map(([value, item]) => (
                  <SelectItem key={value} value={value}>{item.label}</SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>

          <Select items={tagOptions} value={tag || 'all'} onValueChange={(value) => setTag(value === 'all' ? null : value)}>
            <SelectTrigger className="w-full sm:w-48" aria-label="Lọc theo chủ đề">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="all">Tất cả chủ đề</SelectItem>
                {tags.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}
              </SelectGroup>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card className="min-h-80">
        <CardHeader className="border-b">
          <CardTitle>Danh sách bài tập</CardTitle>
          <CardAction>
            <Button variant="ghost" size="sm" onClick={cycleRateSort}>
              <ArrowUpDown data-icon="inline-start" />
              Tỉ lệ AC {rateSort === 'desc' ? '↓' : rateSort === 'asc' ? '↑' : ''}
            </Button>
          </CardAction>
        </CardHeader>

        <CardContent className="px-0">
          {problems.loading ? <ProblemTableSkeleton /> : rows.length === 0 ? (
            <Empty className="min-h-64">
              <EmptyHeader>
                <EmptyMedia variant="icon"><BookOpen /></EmptyMedia>
                <EmptyTitle>Không tìm thấy bài tập</EmptyTitle>
                <EmptyDescription>Hãy thử thay đổi từ khóa hoặc bộ lọc hiện tại.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Mã</TableHead>
                  <TableHead>Bài tập</TableHead>
                  <TableHead>Giới hạn</TableHead>
                  <TableHead className="min-w-36">Tỉ lệ AC</TableHead>
                  <TableHead>Độ khó</TableHead>
                  <TableHead className="text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((problem) => {
                  const acceptance = percent(problem.acceptedSubmissions, problem.totalSubmissions)
                  const status = myStatus[problem.id]

                  return (
                    <TableRow key={problem.id}>
                      <TableCell className="font-mono text-muted-foreground">#{problem.id}</TableCell>
                      <TableCell className="min-w-64 whitespace-normal">
                        <div className="flex flex-col gap-1.5">
                          <Link to={`/problems/${problem.id}`} className="font-medium hover:underline">
                            {problem.title}
                          </Link>
                          <div className="flex flex-wrap gap-1">
                            {(problem.tags || []).map((problemTag) => (
                              <Badge key={problemTag} variant="secondary">{problemTag}</Badge>
                            ))}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {problem.timeLimitMs / 1000}s · {problem.memoryLimitMb}MB
                      </TableCell>
                      <TableCell>
                        <div
                          className="flex min-w-32 items-center gap-2"
                          title={`${problem.acceptedSubmissions}/${problem.totalSubmissions} bài nộp AC`}
                        >
                          <Progress value={acceptance} className="w-24" />
                          <span className="w-9 text-right font-mono text-xs">{acceptance}%</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={problem.difficulty === 'easy' ? 'secondary' : 'outline'}>
                          {DIFFICULTIES[problem.difficulty]?.label || problem.difficulty}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant={status ? 'outline' : 'default'}
                          size="sm"
                          onClick={() => navigate(`/problems/${problem.id}`)}
                        >
                          {status === 'solved' ? 'Đã giải' : status ? 'Làm tiếp' : 'Làm bài'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>

        {!problems.loading && total > PAGE_SIZE && (
          <CardFooter className="justify-between">
            <span className="text-sm text-muted-foreground">Trang {page}/{pageCount} · {total} bài</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                <ChevronLeft data-icon="inline-start" />
                Trước
              </Button>
              <Button variant="outline" size="sm" disabled={page >= pageCount} onClick={() => setPage(page + 1)}>
                Sau
                <ChevronRight data-icon="inline-end" />
              </Button>
            </div>
          </CardFooter>
        )}
      </Card>
    </div>
  )
}
