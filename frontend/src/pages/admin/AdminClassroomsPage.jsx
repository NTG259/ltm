import { useMemo, useState } from 'react'
import { App } from 'antd'
import { Edit3, Plus, Search, Trash2, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { api } from '../../api'
import AdminPageHeader from '../../components/admin/AdminPageHeader'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '../../components/ui/alert-dialog'
import { Badge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '../../components/ui/dialog'
import {
  Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle,
} from '../../components/ui/empty'
import { Field, FieldError, FieldGroup, FieldLabel } from '../../components/ui/field'
import { Input } from '../../components/ui/input'
import { InputGroup, InputGroupAddon, InputGroupInput } from '../../components/ui/input-group'
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue,
} from '../../components/ui/select'
import { Skeleton } from '../../components/ui/skeleton'
import { Spinner } from '../../components/ui/spinner'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../components/ui/table'
import { useFetch } from '../../lib/hooks'

const EMPTY_FORM = { name: '', semester: '', lecturerId: null }

function LoadingRows() {
  return (
    <div className="flex flex-col gap-3 p-4">
      {Array.from({ length: 5 }, (_, index) => <Skeleton key={index} className="h-12 w-full" />)}
    </div>
  )
}

export default function AdminClassroomsPage() {
  const { message } = App.useApp()
  const { data: classrooms, loading, reload: refetch } = useFetch(() => api.listClassrooms(), [])
  const { data: lecturers } = useFetch(() => api.listLecturers(), [])
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [search, setSearch] = useState('')

  const lecturerItems = useMemo(() => [
    { value: null, label: 'Chưa phân công' },
    ...(lecturers || []).map((lecturer) => ({
      value: String(lecturer.id),
      label: `${lecturer.fullName} (${lecturer.staffId})`,
    })),
  ], [lecturers])

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('vi')
    if (!query) return classrooms || []
    return (classrooms || []).filter((classroom) => (
      `${classroom.name} ${classroom.semester || ''} ${classroom.lecturerName || ''} ${(classroom.lecturers || []).map((item) => item.fullName).join(' ')}`
        .toLocaleLowerCase('vi')
        .includes(query)
    ))
  }, [classrooms, search])

  const openCreate = () => {
    setEditing({})
    setForm(EMPTY_FORM)
    setErrors({})
  }

  const openEdit = (classroom) => {
    setEditing(classroom)
    setForm({
      name: classroom.name || '',
      semester: classroom.semester || '',
      lecturerId: classroom.lecturerId ? String(classroom.lecturerId) : null,
    })
    setErrors({})
  }

  const save = async (event) => {
    event.preventDefault()
    if (!form.name.trim()) {
      setErrors({ name: 'Vui lòng nhập tên lớp.' })
      return
    }
    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        semester: form.semester.trim(),
        lecturerId: form.lecturerId || '',
      }
      if (editing?.id) {
        await api.updateClassroom(editing.id, payload)
        message.success('Đã cập nhật lớp học và giảng viên phụ trách')
      } else {
        await api.createClassroom(payload)
        message.success('Đã tạo lớp học')
      }
      setEditing(null)
      refetch()
    } catch (error) {
      message.error(error.message)
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.deleteClassroom(deleteTarget.id)
      message.success('Đã xóa lớp học')
      setDeleteTarget(null)
      refetch()
    } catch (error) {
      message.error(error.message)
    } finally {
      setDeleting(false)
    }
  }

  const lecturerBadges = (classroom) => {
    if (classroom.lecturers?.length) {
      return classroom.lecturers.map((lecturer) => (
        <Badge key={lecturer.id} variant="secondary">{lecturer.fullName} ({lecturer.username})</Badge>
      ))
    }
    if (classroom.lecturerName) {
      return <Badge variant="secondary">{classroom.lecturerName} ({classroom.lecturerStaffId})</Badge>
    }
    return <span className="text-sm text-muted-foreground">Chưa phân công</span>
  }

  const allList = classrooms || []
  const assignedCount = allList.filter((c) => c.lecturers?.length || c.lecturerName).length

  return (
    <div className="page page--fluid flex flex-col gap-4">
      <AdminPageHeader eyebrow="Tổ chức học tập" title="Quản lý lớp học" />

      <div className="stat-metrics">
        <div className="stat-metrics__item">
          <div className="stat-metrics__label">Lớp học</div>
          <div className="stat-metrics__value">{allList.length}</div>
        </div>
        <div className="stat-metrics__item">
          <div className="stat-metrics__label">Có giảng viên</div>
          <div className="stat-metrics__value">{assignedCount}</div>
        </div>
        <div className="stat-metrics__item">
          <div className="stat-metrics__label">Chưa phân công</div>
          <div className="stat-metrics__value">{allList.length - assignedCount}</div>
        </div>
      </div>

      <Card className="h-[66vh] min-h-0 flex flex-col overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Danh sách lớp học</p>
            <p className="text-xs text-muted-foreground">{filtered.length} lớp học phù hợp</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <InputGroup className="w-full sm:w-64">
              <InputGroupAddon><Search /></InputGroupAddon>
              <InputGroupInput
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Tìm lớp, kỳ học, giảng viên"
                aria-label="Tìm lớp học"
              />
            </InputGroup>
            <Button onClick={openCreate}><Plus data-icon="inline-start" />Tạo lớp</Button>
          </div>
        </div>

        <CardContent className="px-0 flex-1 min-h-0 overflow-y-auto">
          {loading ? <LoadingRows /> : filtered.length === 0 ? (
            <Empty className="min-h-72">
              <EmptyHeader>
                <EmptyMedia variant="icon"><Users /></EmptyMedia>
                <EmptyTitle>Chưa có lớp học phù hợp</EmptyTitle>
                <EmptyDescription>Tạo lớp học mới hoặc thay đổi từ khóa tìm kiếm.</EmptyDescription>
              </EmptyHeader>
              <EmptyContent><Button onClick={openCreate}><Plus data-icon="inline-start" />Tạo lớp</Button></EmptyContent>
            </Empty>
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tên lớp</TableHead>
                      <TableHead>Kỳ học</TableHead>
                      <TableHead>Giảng viên phụ trách</TableHead>
                      <TableHead>Ngày tạo</TableHead>
                      <TableHead className="text-left">Thao tác</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((classroom) => (
                      <TableRow key={classroom.id}>
                        <TableCell>
                          <Link className="font-medium text-foreground hover:underline" to={`/admin/classrooms/${classroom.id}`}>{classroom.name}</Link>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{classroom.semester || '—'}</TableCell>
                        <TableCell><div className="flex flex-wrap gap-1">{lecturerBadges(classroom)}</div></TableCell>
                        <TableCell className="text-muted-foreground">{new Date(classroom.createdAt).toLocaleDateString('vi-VN')}</TableCell>
                        <TableCell>
                          <div className="flex justify-start gap-1">
                            <Button variant="ghost" size="icon-sm" render={<Link to={`/admin/classrooms/${classroom.id}`} />} nativeButton={false} aria-label="Xem chi tiết" title="Chi tiết"><Users /></Button>
                            <Button variant="ghost" size="icon-sm" onClick={() => openEdit(classroom)} aria-label="Sửa lớp học" title="Sửa"><Edit3 /></Button>
                            <Button variant="ghost" size="icon-sm" onClick={() => setDeleteTarget(classroom)} aria-label="Xóa lớp học" title="Xóa"><Trash2 /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex flex-col gap-3 p-3 md:hidden">
                {filtered.map((classroom) => (
                  <Card key={classroom.id} size="sm">
                    <CardHeader>
                      <CardTitle><Link to={`/admin/classrooms/${classroom.id}`}>{classroom.name}</Link></CardTitle>
                      <CardDescription>{classroom.semester || 'Chưa đặt kỳ học'}</CardDescription>
                      <div className="absolute right-4 top-4 flex gap-1">
                        <Button variant="ghost" size="icon-sm" onClick={() => openEdit(classroom)} aria-label="Sửa"><Edit3 /></Button>
                        <Button variant="ghost" size="icon-sm" onClick={() => setDeleteTarget(classroom)} aria-label="Xóa"><Trash2 /></Button>
                      </div>
                    </CardHeader>
                    <CardContent className="flex flex-wrap gap-1">{lecturerBadges(classroom)}</CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={editing !== null} onOpenChange={(open) => !open && !saving && setEditing(null)}>
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={save}>
            <DialogHeader>
              <DialogTitle>{editing?.id ? 'Sửa lớp học' : 'Tạo lớp học mới'}</DialogTitle>
              <DialogDescription>Cập nhật tên lớp, kỳ học và giảng viên phụ trách.</DialogDescription>
            </DialogHeader>
            <FieldGroup className="py-4">
              <Field data-invalid={!!errors.name}>
                <FieldLabel htmlFor="classroom-name">Tên lớp</FieldLabel>
                <Input
                  id="classroom-name"
                  value={form.name}
                  onChange={(event) => {
                    setForm((current) => ({ ...current, name: event.target.value }))
                    setErrors({})
                  }}
                  maxLength={255}
                  placeholder="Ví dụ: Lập trình C++ - K65"
                  aria-invalid={!!errors.name}
                  autoFocus
                />
                <FieldError>{errors.name}</FieldError>
              </Field>
              <Field>
                <FieldLabel htmlFor="classroom-semester">Kỳ học</FieldLabel>
                <Input id="classroom-semester" value={form.semester} onChange={(event) => setForm((current) => ({ ...current, semester: event.target.value }))} maxLength={50} placeholder="Ví dụ: HK1/2025" />
              </Field>
              <Field>
                <FieldLabel htmlFor="classroom-lecturer">Giảng viên phụ trách</FieldLabel>
                <Select items={lecturerItems} value={form.lecturerId} onValueChange={(value) => setForm((current) => ({ ...current, lecturerId: value }))}>
                  <SelectTrigger id="classroom-lecturer" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {lecturerItems.map((item) => <SelectItem key={item.value ?? 'none'} value={item.value}>{item.label}</SelectItem>)}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            </FieldGroup>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditing(null)} disabled={saving}>Hủy</Button>
              <Button type="submit" disabled={saving}>
                {saving && <Spinner data-icon="inline-start" />}
                {editing?.id ? 'Lưu thay đổi' : 'Tạo lớp'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && !deleting && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa lớp “{deleteTarget?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>Hành động này không thể hoàn tác.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Hủy</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={deleting} onClick={remove}>
              {deleting && <Spinner data-icon="inline-start" />}
              Xóa lớp
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
