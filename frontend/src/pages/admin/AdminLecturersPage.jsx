import { useMemo, useRef, useState } from 'react'
import { App } from 'antd'
import { FileUp, KeyRound, Plus, Search, Trash2, UserRoundCog, Users } from 'lucide-react'
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
import { Checkbox } from '../../components/ui/checkbox'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '../../components/ui/dialog'
import {
  Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle,
} from '../../components/ui/empty'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '../../components/ui/field'
import { Input } from '../../components/ui/input'
import { InputGroup, InputGroupAddon, InputGroupInput } from '../../components/ui/input-group'
import { Skeleton } from '../../components/ui/skeleton'
import { Spinner } from '../../components/ui/spinner'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../components/ui/table'
import { useFetch } from '../../lib/hooks'

const EMPTY_FORM = { staffId: '', fullName: '', password: '' }

function LoadingRows() {
  return (
    <div className="flex flex-col gap-3 p-4">
      {Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-12 w-full" />)}
    </div>
  )
}

export default function AdminLecturersPage() {
  const { message } = App.useApp()
  const list = useFetch(() => api.listLecturers(), [])
  const fileInputRef = useRef(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState(EMPTY_FORM)
  const [createErrors, setCreateErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [importing, setImporting] = useState(false)
  const [resetTarget, setResetTarget] = useState(null)
  const [resetPassword, setResetPassword] = useState('')
  const [resetError, setResetError] = useState('')
  const [resetting, setResetting] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState([])
  const [deleteRequest, setDeleteRequest] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const filteredLecturers = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('vi')
    if (!query) return list.data || []
    return (list.data || []).filter((lecturer) => (
      `${lecturer.staffId} ${lecturer.fullName}`.toLocaleLowerCase('vi').includes(query)
    ))
  }, [list.data, search])

  const allVisibleSelected = filteredLecturers.length > 0
    && filteredLecturers.every((lecturer) => selectedIds.includes(lecturer.id))

  const toggleAllVisible = (checked) => {
    const visibleIds = filteredLecturers.map((lecturer) => lecturer.id)
    setSelectedIds((current) => (
      checked
        ? [...new Set([...current, ...visibleIds])]
        : current.filter((id) => !visibleIds.includes(id))
    ))
  }

  const toggleSelected = (id, checked) => {
    setSelectedIds((current) => (
      checked ? [...new Set([...current, id])] : current.filter((item) => item !== id)
    ))
  }

  const create = async (event) => {
    event.preventDefault()
    const nextErrors = {}
    if (!createForm.staffId.trim()) nextErrors.staffId = 'Vui lòng nhập mã giảng viên.'
    if (!createForm.fullName.trim()) nextErrors.fullName = 'Vui lòng nhập họ tên.'
    if (createForm.password.length < 8) nextErrors.password = 'Mật khẩu cần ít nhất 8 ký tự.'
    setCreateErrors(nextErrors)
    if (Object.keys(nextErrors).length) return

    setSaving(true)
    try {
      await api.createLecturer({
        staffId: createForm.staffId.trim(),
        fullName: createForm.fullName.trim(),
        password: createForm.password,
      })
      message.success('Đã tạo tài khoản giảng viên')
      setCreateOpen(false)
      setCreateForm(EMPTY_FORM)
      list.reload()
    } catch (error) {
      message.error(error.message)
    } finally {
      setSaving(false)
    }
  }

  const importCsv = async (event) => {
    const [file] = event.target.files || []
    event.target.value = ''
    if (!file) return
    setImporting(true)
    try {
      const result = await api.importLecturers(file)
      if (result.imported > 0) message.success(`Đã import ${result.imported} giảng viên`)
      else message.info('Không có giảng viên mới được import')
      if (result.skippedExisting > 0 || result.skippedInvalid > 0) {
        message.warning(`Bỏ qua ${result.skippedExisting} tài khoản đã tồn tại và ${result.skippedInvalid} dòng không hợp lệ`)
      }
      list.reload()
    } catch (error) {
      message.error(error.message || 'Không thể import file CSV')
    } finally {
      setImporting(false)
    }
  }

  const resetPasswordForLecturer = async (event) => {
    event.preventDefault()
    if (!resetTarget) return
    if (resetPassword.length < 8) {
      setResetError('Mật khẩu phải có ít nhất 8 ký tự.')
      return
    }
    setResetting(true)
    try {
      await api.resetLecturerPassword(resetTarget.id, resetPassword)
      message.success(`Đã đặt lại mật khẩu cho ${resetTarget.staffId}`)
      setResetTarget(null)
      setResetPassword('')
      list.reload()
    } catch (error) {
      message.error(error.message || 'Không thể đặt lại mật khẩu')
    } finally {
      setResetting(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteRequest?.ids.length) return
    setDeleting(true)
    try {
      const result = await api.deleteLecturers(deleteRequest.ids)
      const deletedCount = result?.deleted ?? deleteRequest.ids.length
      message.success(`Đã xóa ${deletedCount} tài khoản giảng viên; lớp được giữ lại nhưng bỏ gán giảng viên.`)
      setSelectedIds((current) => current.filter((id) => !deleteRequest.ids.includes(id)))
      setDeleteRequest(null)
      list.reload()
    } catch (error) {
      message.error(error.message || 'Không thể xóa tài khoản giảng viên')
    } finally {
      setDeleting(false)
    }
  }

  const openReset = (lecturer) => {
    setResetTarget(lecturer)
    setResetPassword('')
    setResetError('')
  }

  const allLecturers = list.data || []
  const assignedLecturers = allLecturers.filter((l) => l.classrooms?.length > 0).length

  return (
    <div className="page page--fluid flex flex-col gap-4">
      <AdminPageHeader eyebrow="Nhân sự" title="Tài khoản giảng viên" />

      <div className="stat-metrics">
        <div className="stat-metrics__item">
          <div className="stat-metrics__label">Tài khoản</div>
          <div className="stat-metrics__value">{allLecturers.length}</div>
        </div>
        <div className="stat-metrics__item">
          <div className="stat-metrics__label">Đang phụ trách lớp</div>
          <div className="stat-metrics__value">{assignedLecturers}</div>
        </div>
        <div className="stat-metrics__item">
          <div className="stat-metrics__label">Chưa phụ trách lớp</div>
          <div className="stat-metrics__value">{allLecturers.length - assignedLecturers}</div>
        </div>
      </div>

      <Card className="h-[66vh] min-h-0 flex flex-col overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Danh sách giảng viên</p>
            <p className="text-xs text-muted-foreground">{filteredLecturers.length} tài khoản phù hợp</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              className="sr-only"
              type="file"
              accept=".csv,text/csv"
              onChange={importCsv}
              aria-label="Chọn file CSV giảng viên"
            />
            <Button variant="outline" disabled={importing} onClick={() => fileInputRef.current?.click()}>
              {importing ? <Spinner data-icon="inline-start" /> : <FileUp data-icon="inline-start" />}
              Import CSV
            </Button>
            <Button onClick={() => {
              setCreateForm(EMPTY_FORM)
              setCreateErrors({})
              setCreateOpen(true)
            }}>
              <Plus data-icon="inline-start" />
              Thêm giảng viên
            </Button>
            {selectedIds.length > 0 && (
              <Button
                variant="destructive"
                onClick={() => setDeleteRequest({
                  ids: selectedIds,
                  label: `${selectedIds.length} tài khoản đã chọn`,
                })}
              >
                <Trash2 data-icon="inline-start" />
                Xóa đã chọn ({selectedIds.length})
              </Button>
            )}
            <InputGroup className="w-full sm:w-64">
              <InputGroupAddon><Search /></InputGroupAddon>
              <InputGroupInput
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Tìm mã hoặc họ tên"
                aria-label="Tìm giảng viên"
              />
            </InputGroup>
          </div>
        </div>

        <CardContent className="px-0 flex-1 min-h-0 overflow-y-auto">
          {list.loading ? <LoadingRows /> : filteredLecturers.length === 0 ? (
            <Empty className="min-h-72">
              <EmptyHeader>
                <EmptyMedia variant="icon"><Users /></EmptyMedia>
                <EmptyTitle>Chưa có giảng viên phù hợp</EmptyTitle>
                <EmptyDescription>Thêm tài khoản mới, import CSV hoặc thay đổi từ khóa tìm kiếm.</EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button onClick={() => setCreateOpen(true)}><Plus data-icon="inline-start" />Thêm giảng viên</Button>
              </EmptyContent>
            </Empty>
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <Table className="min-w-5xl">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox checked={allVisibleSelected} onCheckedChange={toggleAllVisible} aria-label="Chọn tất cả giảng viên đang hiển thị" />
                      </TableHead>
                      <TableHead>Mã giảng viên</TableHead>
                      <TableHead>Họ tên</TableHead>
                      <TableHead>Lớp đang phụ trách</TableHead>
                      <TableHead>Mật khẩu ban đầu</TableHead>
                      <TableHead>Ngày tạo</TableHead>
                      <TableHead className="text-right">Hành động</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLecturers.map((lecturer) => (
                      <TableRow key={lecturer.id} data-state={selectedIds.includes(lecturer.id) ? 'selected' : undefined}>
                        <TableCell>
                          <Checkbox checked={selectedIds.includes(lecturer.id)} onCheckedChange={(checked) => toggleSelected(lecturer.id, checked)} aria-label={`Chọn ${lecturer.fullName}`} />
                        </TableCell>
                        <TableCell className="font-mono">{lecturer.staffId}</TableCell>
                        <TableCell className="font-medium">{lecturer.fullName}</TableCell>
                        <TableCell>
                          <div className="flex max-w-md flex-wrap gap-1">
                            {(lecturer.classrooms || []).length === 0
                              ? <span className="text-sm text-muted-foreground">Chưa phụ trách lớp nào</span>
                              : lecturer.classrooms.map((classroom) => (
                                <Badge key={classroom.id} variant="secondary" render={<Link to={`/admin/classrooms/${classroom.id}`} />}>
                                  {classroom.name}{classroom.semester ? ` (${classroom.semester})` : ''}
                                </Badge>
                              ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          {lecturer.initialPassword
                            ? <Input className="w-44 font-mono" type="password" value={lecturer.initialPassword} readOnly autoComplete="off" aria-label={`Mật khẩu khởi tạo của ${lecturer.fullName}`} />
                            : <span className="text-sm text-muted-foreground">Đã đổi / không lưu</span>}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{new Date(lecturer.createdAt).toLocaleDateString('vi-VN')}</TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon-sm" onClick={() => openReset(lecturer)} aria-label="Đặt lại mật khẩu" title="Đặt lại mật khẩu"><KeyRound /></Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => setDeleteRequest({ ids: [lecturer.id], label: lecturer.fullName })}
                              aria-label="Xóa tài khoản giảng viên"
                              title="Xóa"
                            >
                              <Trash2 />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex flex-col gap-3 p-3 md:hidden">
                {filteredLecturers.map((lecturer) => (
                  <Card key={lecturer.id} size="sm">
                    <CardHeader>
                      <CardTitle>{lecturer.fullName}</CardTitle>
                      <CardDescription>{lecturer.staffId} · {(lecturer.classrooms || []).length} lớp phụ trách</CardDescription>
                      <div className="absolute right-4 top-4 flex gap-1">
                        <Button variant="ghost" size="icon-sm" onClick={() => openReset(lecturer)} aria-label="Đặt lại mật khẩu"><KeyRound /></Button>
                        <Button variant="ghost" size="icon-sm" onClick={() => setDeleteRequest({ ids: [lecturer.id], label: lecturer.fullName })} aria-label="Xóa"><Trash2 /></Button>
                      </div>
                    </CardHeader>
                    <CardContent className="flex flex-wrap gap-1">
                      {(lecturer.classrooms || []).map((classroom) => <Badge key={classroom.id} variant="secondary">{classroom.name}</Badge>)}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={(open) => !open && !saving && setCreateOpen(false)}>
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={create}>
            <DialogHeader>
              <DialogTitle>Tạo tài khoản giảng viên</DialogTitle>
              <DialogDescription>Tài khoản mới sẽ được yêu cầu đổi mật khẩu sau khi đăng nhập.</DialogDescription>
            </DialogHeader>
            <FieldGroup className="py-4">
              <Field data-invalid={!!createErrors.staffId}>
                <FieldLabel htmlFor="lecturer-staff-id">Mã giảng viên</FieldLabel>
                <Input id="lecturer-staff-id" value={createForm.staffId} onChange={(event) => setCreateForm((current) => ({ ...current, staffId: event.target.value }))} maxLength={32} placeholder="Ví dụ: GV002" aria-invalid={!!createErrors.staffId} autoFocus />
                <FieldError>{createErrors.staffId}</FieldError>
              </Field>
              <Field data-invalid={!!createErrors.fullName}>
                <FieldLabel htmlFor="lecturer-full-name">Họ tên</FieldLabel>
                <Input id="lecturer-full-name" value={createForm.fullName} onChange={(event) => setCreateForm((current) => ({ ...current, fullName: event.target.value }))} maxLength={100} aria-invalid={!!createErrors.fullName} />
                <FieldError>{createErrors.fullName}</FieldError>
              </Field>
              <Field data-invalid={!!createErrors.password}>
                <FieldLabel htmlFor="lecturer-password">Mật khẩu ban đầu</FieldLabel>
                <Input id="lecturer-password" type="password" value={createForm.password} onChange={(event) => setCreateForm((current) => ({ ...current, password: event.target.value }))} autoComplete="new-password" aria-invalid={!!createErrors.password} />
                <FieldDescription>Ít nhất 8 ký tự.</FieldDescription>
                <FieldError>{createErrors.password}</FieldError>
              </Field>
            </FieldGroup>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)} disabled={saving}>Hủy</Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Spinner data-icon="inline-start" /> : <UserRoundCog data-icon="inline-start" />}
                Tạo tài khoản
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!resetTarget} onOpenChange={(open) => !open && !resetting && setResetTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={resetPasswordForLecturer}>
            <DialogHeader>
              <DialogTitle>Đặt lại mật khẩu · {resetTarget?.staffId}</DialogTitle>
              <DialogDescription>Nhập mật khẩu mới cho {resetTarget?.fullName}.</DialogDescription>
            </DialogHeader>
            <Field className="py-4" data-invalid={!!resetError}>
              <FieldLabel htmlFor="reset-lecturer-password">Mật khẩu mới</FieldLabel>
              <Input
                id="reset-lecturer-password"
                type="password"
                autoComplete="new-password"
                value={resetPassword}
                onChange={(event) => {
                  setResetPassword(event.target.value)
                  setResetError('')
                }}
                aria-invalid={!!resetError}
                autoFocus
              />
              <FieldError>{resetError}</FieldError>
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setResetTarget(null)} disabled={resetting}>Hủy</Button>
              <Button type="submit" disabled={resetting}>
                {resetting && <Spinner data-icon="inline-start" />}
                Cập nhật mật khẩu
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteRequest} onOpenChange={(open) => !open && !deleting && setDeleteRequest(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa {deleteRequest?.label}?</AlertDialogTitle>
            <AlertDialogDescription>Các lớp và nội dung liên quan vẫn được giữ; lớp sẽ không còn giảng viên được gán.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Hủy</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={deleting} onClick={confirmDelete}>
              {deleting && <Spinner data-icon="inline-start" />}
              Xóa tài khoản
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
