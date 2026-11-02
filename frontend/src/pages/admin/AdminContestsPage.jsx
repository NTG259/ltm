import { useCallback, useMemo, useState } from 'react'
import { App } from 'antd'
import { Edit3, Eye, Plus, Search, Trash2, Trophy } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import { api } from '../../api'
import { useAuth } from '../../auth/context'
import AdminPageHeader from '../../components/admin/AdminPageHeader'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '../../components/ui/alert-dialog'
import { Badge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '../../components/ui/card'
import { Checkbox } from '../../components/ui/checkbox'
import {
  Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle,
} from '../../components/ui/empty'
import {
  Field, FieldDescription, FieldError, FieldGroup, FieldLabel,
} from '../../components/ui/field'
import { Input } from '../../components/ui/input'
import {
  InputGroup, InputGroupAddon, InputGroupInput,
} from '../../components/ui/input-group'
import { Separator } from '../../components/ui/separator'
import {
  Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle,
} from '../../components/ui/sheet'
import { Skeleton } from '../../components/ui/skeleton'
import { Spinner } from '../../components/ui/spinner'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../components/ui/table'
import { useFetch, useNow, useSocket } from '../../lib/hooks'
import { formatDateTime, formatDuration } from '../../lib/format'
import { CONTEST_STATUS, liveStatus } from '../../lib/contest'

const LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

const STATUS_VARIANT = {
  UPCOMING: 'outline',
  RUNNING: 'secondary',
  ENDED: 'outline',
}

function ContestSheet({ contest, open, onClose, onSaved }) {
  const { message } = App.useApp()
  const problems = useFetch(() => api.listProblems(), [])
  const [problemSearch, setProblemSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})

  const isEdit = !!contest?.id
  const [form, setForm] = useState(() => ({
    title: contest?.title || '',
    description: contest?.description || '',
    startAt: contest?.startAt
      ? dayjs(contest.startAt).format('YYYY-MM-DDTHH:mm')
      : dayjs().add(1, 'day').startOf('hour').format('YYYY-MM-DDTHH:mm'),
    durationMin: String(contest?.durationMin || 120),
    problemIds: contest?.problemIds || (contest?.problems || []).map((p) => p.problemId),
  }))

  const updateField = (name, value) => {
    setForm((f) => ({ ...f, [name]: value }))
    setErrors((e) => ({ ...e, [name]: '' }))
  }

  const toggleProblem = (id) => {
    setForm((f) => {
      const ids = f.problemIds.includes(id)
        ? f.problemIds.filter((item) => item !== id)
        : [...f.problemIds, id]
      return { ...f, problemIds: ids }
    })
    setErrors((e) => ({ ...e, problemIds: '' }))
  }

  const filteredProblems = useMemo(() => {
    const q = problemSearch.trim().toLocaleLowerCase('vi')
    return (problems.data || []).filter((p) =>
      !q || `#${p.id} ${p.title}`.toLocaleLowerCase('vi').includes(q)
    )
  }, [problems.data, problemSearch])

  const titleOf = Object.fromEntries((problems.data || []).map((p) => [p.id, p.title]))

  const save = async () => {
    const errs = {}
    if (!form.title.trim()) errs.title = 'Nhập tên kỳ thi.'
    if (!form.startAt) errs.startAt = 'Chọn thời gian bắt đầu.'
    const dur = Number(form.durationMin)
    if (!dur || dur < 10 || dur > 600) errs.durationMin = 'Thời lượng từ 10 đến 600 phút.'
    if (!form.problemIds.length) errs.problemIds = 'Chọn ít nhất 1 bài.'
    setErrors(errs)
    if (Object.keys(errs).length) return
    setSaving(true)
    try {
      const saved = await api.saveContest({
        id: contest?.id,
        title: form.title.trim(),
        description: form.description,
        startAt: dayjs(form.startAt).valueOf(),
        durationMin: dur,
        problemIds: form.problemIds,
      })
      message.success(isEdit ? 'Đã cập nhật kỳ thi' : `Đã tạo kỳ thi #${saved.id}`)
      onSaved()
    } catch (e) {
      message.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-lg">
        <SheetHeader className="px-6 py-4">
          <SheetTitle>{isEdit ? 'Sửa kỳ thi' : 'Tạo kỳ thi mới'}</SheetTitle>
          <SheetDescription>Điền thông tin và chọn bộ đề cho kỳ thi.</SheetDescription>
        </SheetHeader>
        <Separator />
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <FieldGroup>
            <Field data-invalid={!!errors.title}>
              <FieldLabel htmlFor="contest-title">Tên kỳ thi</FieldLabel>
              <Input
                id="contest-title"
                value={form.title}
                onChange={(e) => updateField('title', e.target.value)}
                placeholder="Kỳ thi giữa kỳ – Thuật toán cơ bản"
                aria-invalid={!!errors.title}
                autoFocus
              />
              <FieldError>{errors.title}</FieldError>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field data-invalid={!!errors.startAt}>
                <FieldLabel htmlFor="contest-start">Thời gian bắt đầu</FieldLabel>
                <Input
                  id="contest-start"
                  type="datetime-local"
                  value={form.startAt}
                  onChange={(e) => updateField('startAt', e.target.value)}
                  aria-invalid={!!errors.startAt}
                />
                <FieldError>{errors.startAt}</FieldError>
              </Field>
              <Field data-invalid={!!errors.durationMin}>
                <FieldLabel htmlFor="contest-dur">Thời lượng (phút)</FieldLabel>
                <Input
                  id="contest-dur"
                  type="number"
                  min={10}
                  max={600}
                  step={15}
                  value={form.durationMin}
                  onChange={(e) => updateField('durationMin', e.target.value)}
                  aria-invalid={!!errors.durationMin}
                />
                <FieldError>{errors.durationMin}</FieldError>
              </Field>
            </div>

            <Field data-invalid={!!errors.problemIds}>
              <FieldLabel>Bộ đề</FieldLabel>
              <FieldDescription>Thứ tự chọn sẽ là thứ tự bài A, B, C…</FieldDescription>
              {errors.problemIds && <FieldError>{errors.problemIds}</FieldError>}

              {form.problemIds.length > 0 && (
                <div className="rounded-md border bg-muted/30 p-3">
                  <div className="mb-1 text-xs font-medium text-muted-foreground">Bộ đề đã chọn</div>
                  <div className="flex flex-col gap-1">
                    {form.problemIds.map((pid, i) => (
                      <div key={pid} className="flex items-center gap-2 text-sm">
                        <span className="flex size-5 items-center justify-center rounded bg-primary/10 text-xs font-bold text-primary">
                          {LABELS[i]}
                        </span>
                        <span className="flex-1 truncate">{titleOf[pid] || `#${pid}`}</span>
                        <button
                          type="button"
                          onClick={() => toggleProblem(pid)}
                          className="text-muted-foreground hover:text-destructive"
                          aria-label={`Bỏ chọn ${titleOf[pid]}`}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <InputGroup className="mt-2">
                <InputGroupAddon><Search /></InputGroupAddon>
                <InputGroupInput
                  type="search"
                  value={problemSearch}
                  onChange={(e) => setProblemSearch(e.target.value)}
                  placeholder="Tìm đề bài để thêm vào kỳ thi"
                />
              </InputGroup>

              <div className="mt-1 max-h-52 overflow-y-auto rounded-md border">
                {problems.loading ? (
                  <div className="flex flex-col gap-2 p-3">
                    {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-7 w-full" />)}
                  </div>
                ) : filteredProblems.length === 0 ? (
                  <div className="py-6 text-center text-sm text-muted-foreground">Không tìm thấy đề bài</div>
                ) : (
                  <div className="divide-y">
                    {filteredProblems.map((p) => (
                      <label
                        key={p.id}
                        className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-muted/50"
                      >
                        <Checkbox
                          checked={form.problemIds.includes(p.id)}
                          onCheckedChange={() => toggleProblem(p.id)}
                          id={`problem-${p.id}`}
                          aria-label={`Chọn ${p.title}`}
                        />
                        <span className="flex-1 truncate text-sm">
                          <span className="font-mono text-xs text-muted-foreground">#{p.id}</span>
                          {' '}{p.title}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </Field>

            <Field>
              <FieldLabel htmlFor="contest-desc">Mô tả / thể lệ</FieldLabel>
              <textarea
                id="contest-desc"
                rows={4}
                value={form.description}
                onChange={(e) => updateField('description', e.target.value)}
                placeholder="Giới thiệu kỳ thi, lưu ý cho thí sinh…"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none ring-ring focus:ring-2 resize-none"
              />
            </Field>
          </FieldGroup>
        </div>
        <Separator />
        <SheetFooter className="px-6 py-4">
          <Button variant="outline" onClick={onClose}>Huỷ</Button>
          <Button disabled={saving} onClick={save}>
            {saving && <Spinner data-icon="inline-start" />}
            Lưu
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

function LoadingRows() {
  return (
    <div aria-busy="true" aria-label="Đang tải danh sách kỳ thi" className="flex flex-col gap-3 p-4">
      {Array.from({ length: 5 }, (_, index) => <Skeleton key={index} className="h-10 w-full" />)}
    </div>
  )
}

export default function AdminContestsPage({ teacher = false }) {
  const { user } = useAuth()
  const { message } = App.useApp()
  const navigate = useNavigate()
  const now = useNow(1000)
  const list = useFetch(() => api.listContests(user), [user])
  const [editing, setEditing] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const { reload } = list
  useSocket(useCallback((msg) => msg.type === 'CONTEST_UPDATE' && reload(), [reload]))

  const contestPath = (id) => teacher ? `/teacher/contests/${id}` : `/admin/contests/${id}`

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.deleteContest(deleteTarget.id)
      message.success(`Đã xoá kỳ thi "${deleteTarget.title}"`)
      setDeleteTarget(null)
      reload()
    } catch (e) {
      message.error(e.message)
    } finally {
      setDeleting(false)
    }
  }

  const sorted = useMemo(() =>
    [...(list.data || [])].sort((a, b) => b.startAt - a.startAt),
    [list.data]
  )

  const running = sorted.filter((c) => liveStatus(c, now) === 'RUNNING').length
  const upcoming = sorted.filter((c) => liveStatus(c, now) === 'UPCOMING').length
  const ended = sorted.filter((c) => liveStatus(c, now) === 'ENDED').length
  const [search, setSearch] = useState('')
  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('vi')
    return q ? sorted.filter((c) => c.title.toLocaleLowerCase('vi').includes(q)) : sorted
  }, [sorted, search])

  return (
    <div className="page page--fluid flex flex-col gap-4">
      <AdminPageHeader
        eyebrow={teacher ? 'Tổ chức học tập' : 'Thi cử'}
        title="Quản lý kỳ thi"
        description={teacher
          ? 'Tổ chức và quản lý các kỳ thi lập trình, giám sát thí sinh và phát hiện gian lận.'
          : 'Tạo kỳ thi từ ngân hàng đề, đặt lịch và theo dõi bảng xếp hạng trực tiếp.'}
        actions={
          <Button onClick={() => setEditing({})}>
            <Plus data-icon="inline-start" />
            Tạo kỳ thi
          </Button>
        }
      />

      <div className="stat-metrics">
        <div className="stat-metrics__item">
          <div className="stat-metrics__label">Kỳ thi</div>
          <div className="stat-metrics__value">{sorted.length}</div>
        </div>
        <div className="stat-metrics__item">
          <div className="stat-metrics__label">Đang diễn ra</div>
          <div className="stat-metrics__value">{running}</div>
        </div>
        <div className="stat-metrics__item">
          <div className="stat-metrics__label">Sắp diễn ra</div>
          <div className="stat-metrics__value">{upcoming}</div>
        </div>
        <div className="stat-metrics__item">
          <div className="stat-metrics__label">Đã kết thúc</div>
          <div className="stat-metrics__value">{ended}</div>
        </div>
      </div>

      <Card className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Danh sách kỳ thi</p>
            <p className="text-xs text-muted-foreground">{filtered.length} kỳ thi{search.trim() ? ` cho "${search.trim()}"` : ', sắp xếp theo thời gian mới nhất'}</p>
          </div>
          <InputGroup className="w-full sm:w-64">
            <InputGroupAddon><Search /></InputGroupAddon>
            <InputGroupInput
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm tên kỳ thi"
              aria-label="Tìm kỳ thi"
            />
          </InputGroup>
        </div>
        <CardContent className="px-0 flex-1 min-h-0 overflow-y-auto">
          {list.loading ? <LoadingRows /> : filtered.length === 0 ? (
            <Empty className="min-h-72">
              <EmptyHeader>
                <EmptyMedia variant="icon"><Trophy /></EmptyMedia>
                <EmptyTitle>Chưa có kỳ thi nào</EmptyTitle>
                <EmptyDescription>Tạo kỳ thi đầu tiên từ ngân hàng đề.</EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button onClick={() => setEditing({})}><Plus data-icon="inline-start" />Tạo kỳ thi</Button>
              </EmptyContent>
            </Empty>
          ) : (
            <>
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Kỳ thi</TableHead>
                      <TableHead>Lớp học</TableHead>
                      <TableHead>Trạng thái</TableHead>
                      <TableHead>Bắt đầu</TableHead>
                      <TableHead>Thời lượng</TableHead>
                      <TableHead className="text-center">Thí sinh</TableHead>
                      <TableHead className="text-right">Thao tác</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((c) => {
                      const st = liveStatus(c, now)
                      return (
                        <TableRow key={c.id}>
                          <TableCell className="max-w-xs">
                            <div className="flex flex-col gap-0.5">
                              <Link className="font-medium text-foreground hover:underline" to={contestPath(c.id)}>
                                {c.title}
                              </Link>
                              <span className="text-xs text-muted-foreground">
                                {(c.problems || []).map((p) => p.label).join(' · ')} ({(c.problems || []).length} bài)
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {c.classroomName
                              ? <Badge variant="secondary">{c.classroomName}</Badge>
                              : <span className="text-muted-foreground/50">—</span>}
                          </TableCell>
                          <TableCell>
                            <Badge variant={STATUS_VARIANT[st] || 'outline'}>
                              {CONTEST_STATUS[st]?.label || st}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{formatDateTime(c.startAt)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{formatDuration(c.durationMin)}</TableCell>
                          <TableCell className="text-center">{c.participantCount ?? 0}</TableCell>
                          <TableCell>
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon-sm" onClick={() => navigate(contestPath(c.id))} aria-label="Theo dõi kỳ thi" title="Theo dõi">
                                <Eye />
                              </Button>
                              <Button variant="ghost" size="icon-sm" onClick={() => setEditing(c)} aria-label="Sửa kỳ thi" title="Sửa">
                                <Edit3 />
                              </Button>
                              <Button variant="ghost" size="icon-sm" onClick={() => setDeleteTarget(c)} aria-label="Xóa kỳ thi" title="Xóa">
                                <Trash2 />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className="flex flex-col gap-3 p-3 md:hidden">
                {filtered.map((c) => {
                  const st = liveStatus(c, now)
                  return (
                    <Card key={c.id} size="sm">
                      <CardHeader>
                        <CardTitle>
                          <Link to={contestPath(c.id)}>{c.title}</Link>
                        </CardTitle>
                        <CardDescription>
                          {c.classroomName && <><Badge variant="secondary">{c.classroomName}</Badge> · </>}
                          {formatDateTime(c.startAt)} · {formatDuration(c.durationMin)}
                        </CardDescription>
                        <div className="absolute right-4 top-4 flex gap-1">
                          <Button variant="ghost" size="icon-sm" onClick={() => setEditing(c)} aria-label="Sửa"><Edit3 /></Button>
                          <Button variant="ghost" size="icon-sm" onClick={() => setDeleteTarget(c)} aria-label="Xóa"><Trash2 /></Button>
                        </div>
                      </CardHeader>
                      <CardContent className="flex flex-wrap items-center gap-2">
                        <Badge variant={STATUS_VARIANT[st] || 'outline'}>{CONTEST_STATUS[st]?.label || st}</Badge>
                        <span className="text-xs text-muted-foreground">{c.participantCount ?? 0} thí sinh</span>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {editing !== null && (
        <ContestSheet
          key={editing?.id ?? 'new'}
          open
          contest={editing?.id ? editing : null}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            reload()
          }}
        />
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && !deleting && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa kỳ thi "{deleteTarget?.title}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Bảng xếp hạng của kỳ thi sẽ bị xóa. Bài nộp vẫn được giữ. Hành động này không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Hủy</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={deleting} onClick={confirmDelete}>
              {deleting && <Spinner data-icon="inline-start" />}
              Xác nhận xóa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
