import { useCallback, useMemo, useRef, useState } from 'react'
import { App } from 'antd'
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  GraduationCap,
  Key,
  Loader2,
  Play,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Trophy,
  Upload,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../../api'
import { useFetch, useNow, useSocket } from '../../lib/hooks'
import { formatDateTime, formatMemory, formatRelative, formatTime } from '../../lib/format'
import VerdictTag from '../../components/VerdictTag'
import { VERDICT_KEYS, VERDICTS } from '../../lib/verdicts'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../components/ui/alert-dialog'
import { Badge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { Card } from '../../components/ui/card'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '../../components/ui/empty'
import { Field, FieldError, FieldGroup, FieldLabel } from '../../components/ui/field'
import { Input } from '../../components/ui/input'
import { InputGroup, InputGroupAddon, InputGroupInput } from '../../components/ui/input-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select'
import { Skeleton } from '../../components/ui/skeleton'
import { Spinner } from '../../components/ui/spinner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table'
import { Textarea } from '../../components/ui/textarea'

const DIFFICULTY_VARIANT = { EASY: 'secondary', MEDIUM: 'outline', HARD: 'destructive' }
const DIFFICULTY_LABEL = { EASY: 'Dễ', MEDIUM: 'Trung bình', HARD: 'Khó' }

function phaseTag(c, now) {
  if (now < c.startAt) return <Badge variant="outline">Sắp diễn ra</Badge>
  if (now < c.endAt) return <Badge>Đang diễn ra</Badge>
  return <Badge variant="secondary">Đã kết thúc</Badge>
}

// ── Tab Sinh viên ─────────────────────────────────────────────────────────────
function StudentsTab({ classroomId }) {
  const { message } = App.useApp()
  const csvInputRef = useRef(null)
  const { data: students, loading, reload: refresh } = useFetch(
    () => api.listClassroomStudents(classroomId), [classroomId],
  )

  // Add student dialog
  const [addOpen, setAddOpen] = useState(false)
  const [addMode, setAddMode] = useState('single')
  const [adding, setAdding] = useState(false)
  const [singleForm, setSingleForm] = useState({ studentId: '', fullName: '' })
  const [singleErrors, setSingleErrors] = useState({})
  const [batchText, setBatchText] = useState('')

  // Reset password dialog
  const [resetTarget, setResetTarget] = useState(null)
  const [newPassword, setNewPassword] = useState('')
  const [resetting, setResetting] = useState(false)
  const [resetError, setResetError] = useState('')

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const parsedStudents = useMemo(() => {
    if (!batchText.trim()) return []
    return batchText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((line) => {
        const parts = line.split(/[,;\t]/).map((p) => p.trim())
        const sid = parts[0]?.toUpperCase()
        const name = parts.slice(1).join(' ').trim() || sid
        return sid ? { studentId: sid, fullName: name } : null
      })
      .filter(Boolean)
  }, [batchText])

  const openAdd = () => {
    setSingleForm({ studentId: '', fullName: '' })
    setSingleErrors({})
    setBatchText('')
    setAddMode('single')
    setAddOpen(true)
  }

  const validateSingle = () => {
    const errs = {}
    const sid = singleForm.studentId.trim()
    if (!sid) errs.studentId = 'Vui lòng nhập MSSV'
    else if (!/^[A-Za-z0-9._-]{3,32}$/.test(sid)) errs.studentId = 'MSSV gồm 3-32 ký tự chữ, số (VD: B24DCCN101)'
    if (!singleForm.fullName.trim()) errs.fullName = 'Vui lòng nhập họ và tên'
    setSingleErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleAddSingle = async (e) => {
    e.preventDefault()
    if (!validateSingle()) return
    setAdding(true)
    try {
      const studentId = singleForm.studentId.trim().toUpperCase()
      const fullName = singleForm.fullName.trim()
      await api.addClassroomStudent(classroomId, { studentId, fullName })
      message.success(`Đã thêm sinh viên ${studentId} (${fullName}) vào lớp`)
      setAddOpen(false)
      refresh()
    } catch (e) {
      message.error(e.message)
    } finally {
      setAdding(false)
    }
  }

  const handleAddBatch = async () => {
    if (!batchText.trim()) { message.warning('Vui lòng nhập hoặc dán danh sách sinh viên'); return }
    if (parsedStudents.length === 0) { message.warning('Không tìm thấy dòng nào hợp lệ (cần có MSSV)'); return }
    setAdding(true)
    try {
      const res = await api.addClassroomStudent(classroomId, { students: parsedStudents })
      if (res.errors?.length > 0) {
        message.warning(`Đã thêm ${res.added} sinh viên. Có ${res.errors.length} lỗi:\n${res.errors.slice(0, 3).join(', ')}${res.errors.length > 3 ? '...' : ''}`)
      } else {
        message.success(`Đã thêm thành công ${res.added ?? parsedStudents.length} sinh viên vào lớp!`)
      }
      setBatchText('')
      setAddOpen(false)
      refresh()
    } catch (e) {
      message.error(e.message)
    } finally {
      setAdding(false)
    }
  }

  const handleImport = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    try {
      const res = await api.importClassroomStudents(classroomId, file)
      message.success(`Đã import ${res.imported} sinh viên`)
      refresh()
    } catch (e) {
      message.error(e.message)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.removeClassroomStudent(classroomId, deleteTarget.userId)
      message.success('Đã xoá sinh viên')
      refresh()
    } catch (e) {
      message.error(e.message)
    } finally {
      setDeleting(false)
      setDeleteTarget(null)
    }
  }

  const openReset = (student) => {
    setResetTarget(student)
    setNewPassword(student.username.length >= 8 ? student.username : (student.username + '12345678').substring(0, 8))
    setResetError('')
  }

  const handleResetPassword = async () => {
    if (!resetTarget) return
    if (newPassword.length < 8) { setResetError('Mật khẩu tối thiểu 8 ký tự'); return }
    setResetting(true)
    try {
      await api.resetClassroomStudentPassword(classroomId, resetTarget.userId, newPassword)
      message.success(`Đã đặt lại mật khẩu cho ${resetTarget.username}`)
      setResetTarget(null)
      refresh()
    } catch (e) {
      message.error(e.message)
    } finally {
      setResetting(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex gap-2">
        <Button size="sm" onClick={openAdd}>
          <UserPlus data-icon="inline-start" />
          Thêm sinh viên
        </Button>
        <Button size="sm" variant="outline" onClick={() => csvInputRef.current?.click()}>
          <Upload data-icon="inline-start" />
          Import CSV
        </Button>
        <input ref={csvInputRef} type="file" accept=".csv" className="hidden" onChange={handleImport} />
      </div>

      {loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-10 w-full" />)}
        </div>
      ) : !students?.length ? (
        <Empty className="min-h-48">
          <EmptyHeader>
            <EmptyMedia variant="icon"><Users /></EmptyMedia>
            <EmptyTitle>Chưa có sinh viên</EmptyTitle>
            <EmptyDescription>Nhấn "Thêm sinh viên" hoặc "Import CSV" để thêm.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-32">MSSV</TableHead>
              <TableHead>Họ tên</TableHead>
              <TableHead className="w-36">Mật khẩu ban đầu</TableHead>
              <TableHead className="w-28">Ngày thêm</TableHead>
              <TableHead className="w-28 text-left">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {students.map((s) => (
              <TableRow key={s.userId}>
                <TableCell className="font-mono text-sm">{s.username}</TableCell>
                <TableCell>{s.fullName}</TableCell>
                <TableCell>
                  {s.importedPassword
                    ? <span className="font-mono text-sm font-semibold text-primary">{s.importedPassword}</span>
                    : <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {new Date(s.joinedAt).toLocaleDateString('vi-VN')}
                </TableCell>
                <TableCell className="text-left">
                  <div className="flex justify-start gap-1">
                    <Button size="icon-sm" variant="ghost" title="Đặt lại mật khẩu" onClick={() => openReset(s)}>
                      <Key />
                    </Button>
                    <Button size="icon-sm" variant="ghost" className="text-destructive hover:text-destructive" title="Xoá" onClick={() => setDeleteTarget(s)}>
                      <Trash2 />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Add student dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Thêm sinh viên vào lớp</DialogTitle>
          </DialogHeader>

          <Tabs value={addMode} onValueChange={setAddMode}>
            <TabsList className="w-full">
              <TabsTrigger value="single" className="flex-1">Thêm từng sinh viên</TabsTrigger>
              <TabsTrigger value="batch" className="flex-1">Dán danh sách nhanh</TabsTrigger>
            </TabsList>
            <TabsContent value="single" className="mt-4">
              <form onSubmit={handleAddSingle}>
                <FieldGroup className="gap-4">
                  <Field data-invalid={!!singleErrors.studentId}>
                    <FieldLabel>Mã sinh viên (MSSV)</FieldLabel>
                    <Input
                      placeholder="VD: B24DCCN101"
                      className="font-mono uppercase"
                      value={singleForm.studentId}
                      onChange={(e) => {
                        setSingleForm((f) => ({ ...f, studentId: e.target.value.toUpperCase() }))
                        setSingleErrors((err) => ({ ...err, studentId: '' }))
                      }}
                      autoFocus
                    />
                    <FieldError>{singleErrors.studentId}</FieldError>
                  </Field>
                  <Field data-invalid={!!singleErrors.fullName}>
                    <FieldLabel>Họ và tên sinh viên</FieldLabel>
                    <Input
                      placeholder="VD: Nguyễn Văn An"
                      value={singleForm.fullName}
                      onChange={(e) => {
                        setSingleForm((f) => ({ ...f, fullName: e.target.value }))
                        setSingleErrors((err) => ({ ...err, fullName: '' }))
                      }}
                    />
                    <FieldError>{singleErrors.fullName}</FieldError>
                  </Field>
                  <p className="text-sm text-muted-foreground rounded-md border bg-muted/50 p-3">
                    Nếu sinh viên chưa có tài khoản, hệ thống sẽ tự tạo với mật khẩu ban đầu bằng MSSV. Mật khẩu hiển thị ở cột "Mật khẩu ban đầu".
                  </p>
                </FieldGroup>
                <DialogFooter className="mt-4">
                  <DialogClose render={<Button variant="outline" type="button" />}>Hủy</DialogClose>
                  <Button type="submit" disabled={adding}>
                    {adding && <Spinner data-icon="inline-start" />}
                    <UserPlus data-icon="inline-start" />
                    Thêm vào lớp
                  </Button>
                </DialogFooter>
              </form>
            </TabsContent>
            <TabsContent value="batch" className="mt-4">
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">Dán danh sách từ Excel (mỗi dòng: <code>MSSV, Họ tên</code>):</p>
                  <Button size="sm" variant="link" className="h-auto p-0 text-xs"
                    onClick={() => setBatchText('B24DCCN001, Nguyễn Văn An\nB24DCCN002, Trần Thị Bình\nB24DCCN003, Lê Hoàng Cường')}>
                    Dán mẫu
                  </Button>
                </div>
                <Textarea
                  rows={6}
                  value={batchText}
                  onChange={(e) => setBatchText(e.target.value)}
                  placeholder={'Nhập hoặc dán danh sách vào đây...\nVí dụ:\nB24DCCN001, Nguyễn Văn An\nB24DCCN002, Trần Thị Bình'}
                  className="font-mono text-sm"
                />
                {parsedStudents.length > 0 && (
                  <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                    ✓ Đã nhận diện <strong>{parsedStudents.length}</strong> sinh viên hợp lệ sẵn sàng thêm vào lớp
                  </p>
                )}
                <p className="text-xs text-muted-foreground rounded-md border bg-muted/50 p-2">
                  Hỗ trợ phân cách bằng dấu phẩy, chấm phẩy hoặc Tab (copy từ Excel). Dòng chỉ có MSSV sẽ dùng MSSV làm họ tên.
                </p>
              </div>
              <DialogFooter className="mt-4">
                <DialogClose render={<Button variant="outline" type="button" />}>Hủy</DialogClose>
                <Button onClick={handleAddBatch} disabled={adding}>
                  {adding && <Spinner data-icon="inline-start" />}
                  Thêm danh sách{parsedStudents.length > 0 ? ` (${parsedStudents.length})` : ''}
                </Button>
              </DialogFooter>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Reset password dialog */}
      <Dialog open={!!resetTarget} onOpenChange={(v) => !v && setResetTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Đặt lại mật khẩu</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            <strong>{resetTarget?.username}</strong> · {resetTarget?.fullName}
          </p>
          <Field data-invalid={!!resetError}>
            <FieldLabel>Mật khẩu mới (tối thiểu 8 ký tự)</FieldLabel>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => { setNewPassword(e.target.value); setResetError('') }}
              placeholder="Nhập mật khẩu mới..."
            />
            <FieldError>{resetError}</FieldError>
          </Field>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" type="button" />}>Hủy</DialogClose>
            <Button onClick={handleResetPassword} disabled={resetting}>
              {resetting && <Spinner data-icon="inline-start" />}
              Đặt lại mật khẩu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá sinh viên khỏi lớp?</AlertDialogTitle>
            <AlertDialogDescription>
              Sinh viên <strong>{deleteTarget?.username}</strong> ({deleteTarget?.fullName}) sẽ bị xoá khỏi lớp. Không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting && <Spinner data-icon="inline-start" />}
              Xoá
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ── Tab Kỳ thi ────────────────────────────────────────────────────────────────
function ContestsTab({ classroomId }) {
  const now = useNow(30000)
  const { message } = App.useApp()
  const { data: contests, loading, reload } = useFetch(
    () => api.listClassroomContests(classroomId), [classroomId],
  )
  const { data: available } = useFetch(() => api.teacherAvailableContests(), [])
  const [assignOpen, setAssignOpen] = useState(false)
  const [selectedContest, setSelectedContest] = useState(null)
  const [assigning, setAssigning] = useState(false)
  const assignedIds = new Set((contests || []).map((c) => c.contestId))
  const availableToAssign = (available || []).filter((c) => !assignedIds.has(c.id))

  const assign = async () => {
    if (!selectedContest) return
    setAssigning(true)
    try {
      await api.assignClassroomContest(classroomId, Number(selectedContest))
      message.success('Đã gán kỳ thi vào lớp')
      setAssignOpen(false)
      setSelectedContest(null)
      reload()
    } catch (err) {
      message.error(err.message)
    } finally {
      setAssigning(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div>
        <Button size="sm" disabled={!availableToAssign.length} onClick={() => setAssignOpen(true)}>
          <Plus data-icon="inline-start" />
          Gán kỳ thi có sẵn
        </Button>
      </div>

      {loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-10 w-full" />)}
        </div>
      ) : !contests?.length ? (
        <Empty className="min-h-48">
          <EmptyHeader>
            <EmptyMedia variant="icon"><Trophy /></EmptyMedia>
            <EmptyTitle>Chưa có kỳ thi</EmptyTitle>
            <EmptyDescription>Lớp này chưa có kỳ thi nào.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kỳ thi</TableHead>
              <TableHead className="w-44">Bắt đầu</TableHead>
              <TableHead className="w-44">Kết thúc</TableHead>
              <TableHead className="w-32">Trạng thái</TableHead>
              <TableHead className="w-28 text-left">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contests.map((c) => (
              <TableRow key={c.contestId}>
                <TableCell>
                  <Link to={`/contests/${c.contestId}`} className="font-medium hover:underline flex items-center gap-1.5">
                    <Trophy className="size-4 text-muted-foreground" />
                    {c.title}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">{formatDateTime(c.startAt)}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{formatDateTime(c.endAt)}</TableCell>
                <TableCell>{phaseTag(c, now)}</TableCell>
                <TableCell className="text-left">
                  <Link to={`/teacher/classrooms/${classroomId}/contests/${c.contestId}/monitor`}>
                    <Button size="sm" variant="outline">Giám sát</Button>
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Gán kỳ thi có sẵn</DialogTitle>
          </DialogHeader>
          <Select value={selectedContest || ''} onValueChange={setSelectedContest}>
            <SelectTrigger>
              <SelectValue placeholder="Chọn kỳ thi do admin hoặc bạn tạo" />
            </SelectTrigger>
            <SelectContent>
              {availableToAssign.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>{c.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" type="button" />}>Hủy</DialogClose>
            <Button onClick={assign} disabled={!selectedContest || assigning}>
              {assigning && <Spinner data-icon="inline-start" />}
              Gán vào lớp
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Tab Khóa học ──────────────────────────────────────────────────────────────
function CourseTab({ classroomId }) {
  const { message } = App.useApp()
  const pdfInputRef = useRef(null)
  const [selectedUnit, setSelectedUnit] = useState(null)
  const [assignOpen, setAssignOpen] = useState(false)
  const [assigningId, setAssigningId] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [problemModalOpen, setProblemModalOpen] = useState(false)
  const [selectedProblemId, setSelectedProblemId] = useState(null)
  const [addingProblem, setAddingProblem] = useState(false)
  const [confirmAction, setConfirmAction] = useState(null)

  const { data: courseData, loading, reload: refresh } = useFetch(
    () => api.getClassroomCourse(classroomId).catch(() => null), [classroomId],
  )
  const { data: allCourses } = useFetch(() => api.listCourses(), [])
  const { data: allProblems } = useFetch(() => api.listProblems(), [])

  const units = courseData?.units || []
  const activeUnit = selectedUnit != null
    ? units.find((u) => u.id === selectedUnit) ?? units[0]
    : units[0]

  const handleAssign = async () => {
    if (!assigningId) return
    try {
      await api.assignClassroomCourse(classroomId, Number(assigningId))
      message.success('Đã gán khóa học')
      setAssignOpen(false)
      refresh()
    } catch (e) {
      message.error(e.message)
    }
  }

  const handleUnassign = async () => {
    try {
      await api.unassignClassroomCourse(classroomId)
      message.success('Đã huỷ gán khóa học')
      refresh()
    } catch (e) {
      message.error(e.message)
    }
  }

  const handleUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !activeUnit) return
    e.target.value = ''
    setUploading(true)
    try {
      await api.uploadUnitFile(activeUnit.id, file)
      message.success('Đã tải lên tài liệu')
      refresh()
    } catch (e) {
      message.error(e.message)
    } finally {
      setUploading(false)
    }
  }

  const handleDeleteFile = (unitId, fileId) => {
    setConfirmAction({
      label: 'Xoá file tài liệu này?',
      action: async () => {
        try {
          await api.deleteUnitFile(unitId, fileId)
          message.success('Đã xoá file')
          refresh()
        } catch (e) {
          message.error(e.message)
        }
      },
    })
  }

  const handleRemoveProblem = (unitId, problemId) => {
    setConfirmAction({
      label: 'Gỡ bài tập này khỏi chương?',
      action: async () => {
        try {
          await api.removeUnitProblem(unitId, problemId)
          message.success('Đã gỡ bài tập khỏi chương')
          refresh()
        } catch (e) {
          message.error(e.message)
        }
      },
    })
  }

  const handleAssignProblem = async () => {
    if (!activeUnit || !selectedProblemId) return
    setAddingProblem(true)
    try {
      await api.assignUnitProblem(activeUnit.id, Number(selectedProblemId))
      message.success('Đã thêm bài tập vào chương')
      setProblemModalOpen(false)
      setSelectedProblemId(null)
      refresh()
    } catch (e) {
      message.error(e.message)
    } finally {
      setAddingProblem(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-3 p-6">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    )
  }

  if (!courseData) {
    return (
      <div className="flex flex-col items-center gap-4 p-10">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon"><GraduationCap /></EmptyMedia>
            <EmptyTitle>Lớp chưa được gán khóa học</EmptyTitle>
            <EmptyDescription>Gán một khóa học để quản lý nội dung giảng dạy.</EmptyDescription>
          </EmptyHeader>
        </Empty>
        <Button onClick={() => setAssignOpen(true)}>
          <Plus data-icon="inline-start" />
          Gán khóa học
        </Button>

        <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader><DialogTitle>Gán khóa học cho lớp</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">Mỗi lớp chỉ gán được 1 khóa học.</p>
            <Select value={assigningId || ''} onValueChange={setAssigningId}>
              <SelectTrigger><SelectValue placeholder="Chọn khóa học" /></SelectTrigger>
              <SelectContent>
                {(allCourses || []).map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <DialogFooter>
              <DialogClose render={<Button variant="outline" type="button" />}>Huỷ</DialogClose>
              <Button onClick={handleAssign} disabled={!assigningId}>Xác nhận</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  return (
    <>
      {/* Course header */}
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <span className="font-semibold">{courseData.title}</span>
        <Badge variant="secondary">{units.length} chương</Badge>
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setAssignOpen(true)}>Đổi khóa học</Button>
          <Button size="sm" variant="outline" className="text-destructive hover:text-destructive"
            onClick={() => setConfirmAction({ label: 'Huỷ gán khóa học?', action: handleUnassign })}>
            Huỷ gán
          </Button>
        </div>
      </div>

      <div className="flex" style={{ minHeight: 420 }}>
        {/* Sidebar chương */}
        <div className="w-56 shrink-0 border-r">
          <div className="border-b px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Danh sách chương
          </div>
          {units.map((unit) => (
            <button
              key={unit.id}
              type="button"
              onClick={() => setSelectedUnit(unit.id)}
              className={[
                'block w-full px-3 py-2.5 text-left text-sm transition-colors',
                'border-l-2',
                activeUnit?.id === unit.id
                  ? 'border-primary bg-primary/5 font-semibold text-primary'
                  : 'border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground',
              ].join(' ')}
            >
              {unit.title}
            </button>
          ))}
        </div>

        {/* Unit content */}
        {activeUnit ? (
          <div className="flex-1 overflow-auto p-4">
            <h3 className="mb-4 border-b pb-3 text-sm font-semibold">{activeUnit.title}</h3>

            {/* PDF files */}
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Tài liệu PDF</p>
            <div className="mb-3 flex flex-col gap-2">
              {(activeUnit.files || []).length === 0 ? (
                <p className="text-sm italic text-muted-foreground">Chưa có tài liệu nào</p>
              ) : (
                activeUnit.files.map((f) => (
                  <div key={f.id} className="flex items-center gap-2 rounded-md border px-3 py-2">
                    <FileText className="size-4 shrink-0 text-red-500" />
                    <a
                      href={`/api/courses/units/${activeUnit.id}/files/${f.id}/download`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-1 text-sm font-medium hover:underline text-foreground truncate"
                      title="Bấm để tải về / xem tài liệu"
                    >
                      {f.filename}
                    </a>
                    {f.fileSize && <span className="text-xs text-muted-foreground whitespace-nowrap">{(f.fileSize / 1024 / 1024).toFixed(1)} MB</span>}
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      className="text-muted-foreground hover:text-foreground"
                      onClick={() => window.open(`/api/courses/units/${activeUnit.id}/files/${f.id}/download`, '_blank')}
                      title="Tải về"
                    >
                      <Download className="size-4" />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDeleteFile(activeUnit.id, f.id)}
                      title="Xóa tài liệu"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>
            <div className="mb-5">
              <Button size="sm" variant="outline" disabled={uploading} onClick={() => pdfInputRef.current?.click()}>
                {uploading ? <Loader2 className="animate-spin size-4" /> : <Upload data-icon="inline-start" />}
                {uploading ? 'Đang tải lên...' : 'Tải lên PDF'}
              </Button>
              <input ref={pdfInputRef} type="file" accept=".pdf,application/pdf" className="hidden" onChange={handleUpload} />
            </div>

            {/* Problems */}
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Bài tập lập trình</p>
            <div className="mb-3">
              {(activeUnit.problems || []).length === 0 ? (
                <p className="text-sm italic text-muted-foreground mb-2">Chưa có bài tập nào</p>
              ) : (
                <div className="mb-2 overflow-hidden rounded-md border">
                  {activeUnit.problems.map((p) => (
                    <div key={p.id} className="flex items-center gap-2 border-b px-3 py-2 last:border-b-0">
                      <Link to={`/teacher/problems/${p.id}`} className="flex flex-1 items-center gap-2 font-medium hover:underline">
                        <Play className="size-4 text-primary" />
                        {p.title}
                      </Link>
                      <Badge variant={DIFFICULTY_VARIANT[p.difficulty] || 'secondary'}>
                        {DIFFICULTY_LABEL[p.difficulty] || p.difficulty}
                      </Badge>
                      <Button size="icon-sm" variant="ghost" className="text-destructive hover:text-destructive"
                        onClick={() => handleRemoveProblem(activeUnit.id, p.id)}>
                        <X />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <Button size="sm" variant="outline" onClick={() => setProblemModalOpen(true)}>
                <Plus data-icon="inline-start" />
                Chọn bài tập có sẵn
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <Empty>
              <EmptyHeader>
                <EmptyTitle>Chọn chương bên trái</EmptyTitle>
                <EmptyDescription>để xem và chỉnh sửa nội dung</EmptyDescription>
              </EmptyHeader>
            </Empty>
          </div>
        )}
      </div>

      {/* Change course dialog */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Đổi khóa học</DialogTitle></DialogHeader>
          <Select defaultValue={String(courseData?.courseId)} onValueChange={setAssigningId}>
            <SelectTrigger><SelectValue placeholder="Chọn khóa học" /></SelectTrigger>
            <SelectContent>
              {(allCourses || []).map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>{c.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" type="button" />}>Huỷ</DialogClose>
            <Button onClick={handleAssign}>Xác nhận</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add problem dialog */}
      <Dialog open={problemModalOpen} onOpenChange={setProblemModalOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Thêm bài tập vào chương</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Chọn bài tập từ kho chung để đưa vào chương học:</p>
          <Select value={selectedProblemId || ''} onValueChange={setSelectedProblemId}>
            <SelectTrigger><SelectValue placeholder="Chọn bài tập" /></SelectTrigger>
            <SelectContent>
              {(allProblems || []).map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>#{p.id} {p.title} ({p.difficulty})</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" type="button" />}>Hủy</DialogClose>
            <Button onClick={handleAssignProblem} disabled={!selectedProblemId || addingProblem}>
              {addingProblem && <Spinner data-icon="inline-start" />}
              Gắn vào chương
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Shared confirm dialog */}
      <AlertDialog open={!!confirmAction} onOpenChange={(v) => !v && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmAction?.label}</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => { confirmAction?.action(); setConfirmAction(null) }}>
              Xác nhận
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

// ── Tab Bài nộp ───────────────────────────────────────────────────────────────
const VERDICT_OPTIONS = [
  { value: 'all', label: 'Tất cả kết quả' },
  { value: 'PENDING', label: 'Đang chờ / đang chấm' },
  ...VERDICT_KEYS.map((v) => ({ value: v, label: `${v} – ${VERDICTS[v].label}` })),
]

function ClassroomSubmissionsTab({ classroomId }) {
  const navigate = useNavigate()
  const now = useNow(10000)
  const [student, setStudent] = useState('')
  const [problemId, setProblemId] = useState('all')
  const [verdict, setVerdict] = useState('all')
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 50

  const subs = useFetch(
    () => api.listSubmissions({
      classroomId,
      userId: student || undefined,
      problemId: problemId !== 'all' ? Number(problemId) : undefined,
      verdict: verdict !== 'all' ? verdict : undefined,
      page,
      size: PAGE_SIZE,
    }),
    [classroomId, student, problemId, verdict, page],
  )
  const problems = useFetch(() => api.listProblems(), [])
  const { setData, reload } = subs

  useSocket(
    useCallback((msg) => {
      if (msg.type !== 'SUBMISSION_UPDATE') return
      const s = msg.submission
      // eslint-disable-next-line no-unused-vars
      const { sourceCode, tests, history, ...row } = s
      setData((prev) => {
        if (!prev) return prev
        const list = Array.isArray(prev) ? prev : (prev.submissions || [])
        const i = list.findIndex((x) => x.id === s.id)
        const next = i < 0 ? [row, ...list] : list.map((x, idx) => idx === i ? { ...x, ...row } : x)
        return Array.isArray(prev) ? next : { ...prev, submissions: next }
      })
    }, [setData]),
  )

  const rows = subs.data?.submissions || (Array.isArray(subs.data) ? subs.data : [])
  const total = subs.data?.total || rows.length
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const problemOptions = [
    { value: 'all', label: 'Tất cả đề bài' },
    ...(Array.isArray(problems.data) ? problems.data : (problems.data?.problems || [])).map((p) => ({
      value: String(p.id),
      label: `#${p.id} ${p.title}`,
    })),
  ]

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex flex-wrap gap-2">
        <InputGroup className="w-48">
          <InputGroupAddon><Search className="size-4" /></InputGroupAddon>
          <InputGroupInput
            placeholder="MSSV hoặc họ tên"
            value={student}
            onChange={(e) => { setStudent(e.target.value); setPage(0) }}
          />
        </InputGroup>

        <Select value={problemId} onValueChange={(v) => { setProblemId(v); setPage(0) }}>
          <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            {problemOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={verdict} onValueChange={(v) => { setVerdict(v); setPage(0) }}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            {VERDICT_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button size="sm" variant="outline" onClick={reload}>
          <RefreshCw data-icon="inline-start" />
          Làm mới
        </Button>
        <span className="flex items-center text-sm text-muted-foreground">{total} bài nộp</span>
      </div>

      {subs.loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-10 w-full" />)}
        </div>
      ) : rows.length === 0 ? (
        <Empty className="min-h-40">
          <EmptyHeader>
            <EmptyTitle>Không có bài nộp</EmptyTitle>
            <EmptyDescription>Chưa có bài nộp nào phù hợp với bộ lọc.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">Mã</TableHead>
              <TableHead>Sinh viên</TableHead>
              <TableHead>Đề bài</TableHead>
              <TableHead className="w-36">Kết quả</TableHead>
              <TableHead className="w-16 text-right">Điểm</TableHead>
              <TableHead className="w-24 text-right">Thời gian</TableHead>
              <TableHead className="w-24 text-right">Bộ nhớ</TableHead>
              <TableHead className="w-28 text-right">Thời điểm</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow
                key={r.id}
                className="cursor-pointer"
                onClick={() => navigate(`/teacher/submissions/${r.id}`)}
              >
                <TableCell className="font-mono text-sm font-semibold">#{r.id}</TableCell>
                <TableCell>
                  <div className="font-medium">{r.userName || r.userId}</div>
                  <div className="font-mono text-xs text-muted-foreground">{r.userId}</div>
                </TableCell>
                <TableCell className="font-medium">
                  #{r.problemId} {r.problemTitle}
                </TableCell>
                <TableCell><VerdictTag submission={r} /></TableCell>
                <TableCell className="text-right font-mono text-sm">{r.score ?? '—'}</TableCell>
                <TableCell className="text-right font-mono text-sm">{formatTime(r.timeMs)}</TableCell>
                <TableCell className="text-right font-mono text-sm">{formatMemory(r.memoryKb)}</TableCell>
                <TableCell className="text-right text-xs text-muted-foreground">
                  {formatRelative(r.createdAt, now)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Trang {page + 1} / {totalPages}
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft data-icon="inline-start" />
              Trước
            </Button>
            <Button size="sm" variant="outline" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
              Sau
              <ChevronRight data-icon="inline-end" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function TeacherClassroomDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: classroom, loading } = useFetch(() => api.getClassroom(id), [id])

  return (
    <div className="page flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/teacher/classrooms')}>
          <ArrowLeft data-icon="inline-start" />
          Lớp học
        </Button>
        {loading ? (
          <Skeleton className="h-7 w-48" />
        ) : (
          <>
            <h1 className="text-lg font-semibold">{classroom?.name || '…'}</h1>
            {classroom?.semester && <Badge variant="secondary">{classroom.semester}</Badge>}
          </>
        )}
      </div>

      <Card className="overflow-hidden">
        <Tabs defaultValue="students">
          <div className="border-b px-1">
            <TabsList variant="line" className="h-10 gap-0 rounded-none bg-transparent p-0">
              <TabsTrigger value="students" className="h-full rounded-none px-4"><Users data-icon="inline-start" />Sinh viên</TabsTrigger>
              <TabsTrigger value="contests" className="h-full rounded-none px-4"><Trophy data-icon="inline-start" />Kỳ thi</TabsTrigger>
              <TabsTrigger value="course" className="h-full rounded-none px-4"><GraduationCap data-icon="inline-start" />Khóa học</TabsTrigger>
              <TabsTrigger value="submissions" className="h-full rounded-none px-4"><FileText data-icon="inline-start" />Bài nộp</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="students"><StudentsTab classroomId={id} /></TabsContent>
          <TabsContent value="contests"><ContestsTab classroomId={id} /></TabsContent>
          <TabsContent value="course"><CourseTab classroomId={id} /></TabsContent>
          <TabsContent value="submissions"><ClassroomSubmissionsTab classroomId={id} /></TabsContent>
        </Tabs>
      </Card>
    </div>
  )
}
