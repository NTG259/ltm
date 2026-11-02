import { useMemo, useState } from 'react'
import { App } from 'antd'
import { Edit3, FileArchive, Plus, Search, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { api } from '../../api'
import AdminPageHeader from '../../components/admin/AdminPageHeader'
import ProblemEditorSheet from '../../components/admin/problems/ProblemEditorSheet'
import ProblemZipDialog from '../../components/admin/problems/ProblemZipDialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '../../components/ui/alert-dialog'
import { Badge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card'
import {
  Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle,
} from '../../components/ui/empty'
import { InputGroup, InputGroupAddon, InputGroupInput } from '../../components/ui/input-group'
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue,
} from '../../components/ui/select'
import { Skeleton } from '../../components/ui/skeleton'
import { Spinner } from '../../components/ui/spinner'
import { Switch } from '../../components/ui/switch'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../components/ui/table'
import { useFetch } from '../../lib/hooks'
import { percent } from '../../lib/format'
import { DIFFICULTIES } from '../../lib/verdicts'

const DIFFICULTY_ITEMS = [
  { value: 'all', label: 'Mọi độ khó' },
  ...Object.entries(DIFFICULTIES).map(([value, item]) => ({ value, label: item.label })),
]
const VISIBILITY_ITEMS = [
  { value: 'all', label: 'Mọi trạng thái' },
  { value: 'public', label: 'Công khai' },
  { value: 'hidden', label: 'Đang ẩn' },
]
const DIFFICULTY_VARIANT = { easy: 'secondary', medium: 'outline', hard: 'destructive' }

function LoadingRows() {
  return (
    <div className="flex flex-col gap-3 p-4">
      {Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-12 w-full" />)}
    </div>
  )
}

export default function AdminProblemsPage({ teacher = false }) {
  const { message } = App.useApp()
  const list = useFetch(() => api.listProblems(), [])
  const [editing, setEditing] = useState(null)
  const [zipProblem, setZipProblem] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [search, setSearch] = useState('')
  const [difficulty, setDifficulty] = useState('all')
  const [visibility, setVisibility] = useState('all')

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('vi')
    return (list.data || []).filter((problem) => {
      const searchable = `${problem.id} ${problem.title} ${(problem.tags || []).join(' ')}`.toLocaleLowerCase('vi')
      if (query && !searchable.includes(query)) return false
      if (difficulty !== 'all' && problem.difficulty !== difficulty) return false
      if (visibility === 'public' && !problem.publicVisible) return false
      if (visibility === 'hidden' && problem.publicVisible) return false
      return true
    })
  }, [difficulty, list.data, search, visibility])

  const openEdit = async (id) => {
    try {
      setEditing(await api.getProblem(id))
    } catch (error) {
      message.error(error.message)
    }
  }

  const remove = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.deleteProblem(deleteTarget.id)
      message.success(`Đã xóa đề #${deleteTarget.id}`)
      setDeleteTarget(null)
      list.reload()
    } catch (error) {
      message.error(error.message)
    } finally {
      setDeleting(false)
    }
  }

  const toggleVisibility = async (problem, visible) => {
    try {
      await api.toggleProblemVisibility(problem.id, visible)
      list.reload()
    } catch (error) {
      message.error(error.message)
    }
  }

  const submissionsPath = (problemId) => (
    teacher ? `/teacher/submissions?problemId=${problemId}` : `/admin/submissions?problemId=${problemId}`
  )

  const problems = list.data || []
  const publicCount = problems.filter((p) => p.publicVisible).length
  const totalTests = problems.reduce((sum, p) => sum + (p.testCount || 0), 0)
  const totalSubmissions = problems.reduce((sum, p) => sum + (p.totalSubmissions || 0), 0)

  return (
    <div className="page page--fluid flex flex-col gap-4">
      <AdminPageHeader
        eyebrow={teacher ? 'Giảng dạy' : 'Nội dung'}
        title={teacher ? 'Kho đề bài tập' : 'Ngân hàng đề bài'}
      />

      <div className="stat-metrics">
        <div className="stat-metrics__item">
          <div className="stat-metrics__label">Đề bài</div>
          <div className="stat-metrics__value">{problems.length}</div>
        </div>
        <div className="stat-metrics__item">
          <div className="stat-metrics__label">Đang công khai</div>
          <div className="stat-metrics__value">{publicCount}</div>
        </div>
        <div className="stat-metrics__item">
          <div className="stat-metrics__label">Test case</div>
          <div className="stat-metrics__value">{totalTests}</div>
        </div>
        <div className="stat-metrics__item">
          <div className="stat-metrics__label">Lượt nộp</div>
          <div className="stat-metrics__value">{totalSubmissions}</div>
        </div>
      </div>

      <Card className="h-[66vh] min-h-0 flex flex-col overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Danh sách đề bài</p>
            <p className="text-xs text-muted-foreground">{filtered.length} đề bài phù hợp</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <InputGroup className="w-full sm:w-64">
              <InputGroupAddon><Search /></InputGroupAddon>
              <InputGroupInput
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Tìm tên, mã hoặc chủ đề"
                aria-label="Tìm đề bài"
              />
            </InputGroup>
            <Select items={DIFFICULTY_ITEMS} value={difficulty} onValueChange={setDifficulty}>
              <SelectTrigger className="w-36" aria-label="Lọc theo độ khó"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {DIFFICULTY_ITEMS.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
                </SelectGroup>
              </SelectContent>
            </Select>
            <Select items={VISIBILITY_ITEMS} value={visibility} onValueChange={setVisibility}>
              <SelectTrigger className="w-40" aria-label="Lọc theo trạng thái"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {VISIBILITY_ITEMS.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
                </SelectGroup>
              </SelectContent>
            </Select>
            <Button onClick={() => setEditing({})}>
              <Plus data-icon="inline-start" />
              Thêm đề bài
            </Button>
          </div>
        </div>

        <CardContent className="px-0 flex-1 min-h-0 overflow-y-auto">
          {list.loading ? <LoadingRows /> : filtered.length === 0 ? (
            <Empty className="min-h-72">
              <EmptyHeader>
                <EmptyMedia variant="icon"><FileArchive /></EmptyMedia>
                <EmptyTitle>Không có đề bài phù hợp</EmptyTitle>
                <EmptyDescription>Thử đổi bộ lọc hoặc tạo đề bài mới.</EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button onClick={() => setEditing({})}><Plus data-icon="inline-start" />Thêm đề bài</Button>
              </EmptyContent>
            </Empty>
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <Table className="min-w-5xl">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-20">Mã</TableHead>
                      <TableHead>Đề bài</TableHead>
                      <TableHead>Độ khó</TableHead>
                      <TableHead>Giới hạn</TableHead>
                      <TableHead className="text-center">Số test</TableHead>
                      <TableHead className="text-center">Công khai</TableHead>
                      <TableHead>Bài nộp (AC)</TableHead>
                      <TableHead className="text-left">Thao tác</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((problem) => (
                      <TableRow key={problem.id}>
                        <TableCell className="font-mono">#{problem.id}</TableCell>
                        <TableCell className="max-w-sm">
                          <div className="flex flex-col gap-1">
                            <Link
                              className="font-medium text-foreground hover:underline"
                              to={teacher ? `/teacher/problems/${problem.id}` : `/admin/problems/${problem.id}`}
                            >
                              {problem.title}
                            </Link>
                            <div className="flex flex-wrap gap-1">
                              {(problem.tags || []).map((tag) => <Badge key={tag} variant="outline">{tag}</Badge>)}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell><Badge variant={DIFFICULTY_VARIANT[problem.difficulty] || 'outline'}>{DIFFICULTIES[problem.difficulty]?.label || problem.difficulty}</Badge></TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{problem.timeLimitMs} ms · {problem.memoryLimitMb} MB</TableCell>
                        <TableCell className="text-center">{problem.testCount}</TableCell>
                        <TableCell className="text-center">
                          <Switch
                            checked={problem.publicVisible}
                            onCheckedChange={(checked) => toggleVisibility(problem, checked)}
                            aria-label={`${problem.publicVisible ? 'Ẩn' : 'Công khai'} đề ${problem.title}`}
                          />
                        </TableCell>
                        <TableCell>
                          <Link className="font-mono text-sm text-foreground hover:underline" to={submissionsPath(problem.id)}>
                            {problem.acceptedSubmissions}/{problem.totalSubmissions} ({percent(problem.acceptedSubmissions, problem.totalSubmissions)}%)
                          </Link>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-start gap-1">
                            <Button variant="ghost" size="icon-sm" onClick={() => setZipProblem(problem)} aria-label="Nhập bộ test từ ZIP" title="Nhập ZIP"><FileArchive /></Button>
                            <Button variant="ghost" size="icon-sm" onClick={() => openEdit(problem.id)} aria-label="Sửa đề bài" title="Sửa"><Edit3 /></Button>
                            <Button variant="ghost" size="icon-sm" onClick={() => setDeleteTarget(problem)} aria-label="Xóa đề bài" title="Xóa"><Trash2 /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex flex-col gap-3 p-3 md:hidden">
                {filtered.map((problem) => (
                  <Card key={problem.id} size="sm">
                    <CardHeader>
                      <CardTitle>
                        <Link to={teacher ? `/teacher/problems/${problem.id}` : `/admin/problems/${problem.id}`}>
                          #{problem.id} · {problem.title}
                        </Link>
                      </CardTitle>
                      <CardDescription>{problem.timeLimitMs} ms · {problem.memoryLimitMb} MB · {problem.testCount} test</CardDescription>
                      <div className="absolute right-4 top-4 flex gap-1">
                        <Button variant="ghost" size="icon-sm" onClick={() => openEdit(problem.id)} aria-label="Sửa"><Edit3 /></Button>
                        <Button variant="ghost" size="icon-sm" onClick={() => setDeleteTarget(problem)} aria-label="Xóa"><Trash2 /></Button>
                      </div>
                    </CardHeader>
                    <CardContent className="flex flex-wrap items-center gap-2">
                      <Badge variant={DIFFICULTY_VARIANT[problem.difficulty] || 'outline'}>{DIFFICULTIES[problem.difficulty]?.label || problem.difficulty}</Badge>
                      <Link className="text-xs text-muted-foreground hover:underline" to={submissionsPath(problem.id)}>{problem.totalSubmissions} bài nộp</Link>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {editing !== null && (
        <ProblemEditorSheet
          key={editing?.id ?? 'new'}
          open
          problem={editing?.id ? editing : null}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            list.reload()
          }}
        />
      )}

      <ProblemZipDialog
        key={zipProblem?.id ?? 'zip'}
        open={!!zipProblem}
        problem={zipProblem}
        onClose={() => setZipProblem(null)}
        onUploaded={() => list.reload()}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && !deleting && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa đề #{deleteTarget?.id}?</AlertDialogTitle>
            <AlertDialogDescription>Toàn bộ test case của đề sẽ bị xóa. Hành động này không thể hoàn tác.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Hủy</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={deleting} onClick={remove}>
              {deleting && <Spinner data-icon="inline-start" />}
              Xóa đề bài
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
