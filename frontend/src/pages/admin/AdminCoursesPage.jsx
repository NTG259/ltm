import { useMemo, useState } from 'react'
import { App } from 'antd'
import { BookOpen, Edit3, ListTree, Plus, Search, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { api } from '../../api'
import { useAuth } from '../../auth/context'
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
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '../../components/ui/field'
import { Input } from '../../components/ui/input'
import { InputGroup, InputGroupAddon, InputGroupInput } from '../../components/ui/input-group'
import { Skeleton } from '../../components/ui/skeleton'
import { Spinner } from '../../components/ui/spinner'
import { Switch } from '../../components/ui/switch'
import { Tabs, TabsList, TabsTrigger } from '../../components/ui/tabs'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../components/ui/table'
import { Textarea } from '../../components/ui/textarea'
import { useFetch } from '../../lib/hooks'

const EMPTY_FORM = { title: '', description: '', published: false }

function LoadingRows() {
  return (
    <div className="flex flex-col gap-3 p-4">
      {Array.from({ length: 5 }, (_, index) => <Skeleton key={index} className="h-12 w-full" />)}
    </div>
  )
}

export default function AdminCoursesPage({ teacher = false }) {
  const { message } = App.useApp()
  const { user } = useAuth()
  const { data: allCourses, loading, reload: refetch } = useFetch(() => api.listCourses(), [])
  const [filterMode, setFilterMode] = useState('my')
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const basePath = teacher ? '/teacher/courses' : '/admin/courses'

  const courses = useMemo(() => {
    const visible = teacher && filterMode === 'my'
      ? (allCourses || []).filter((course) => course.createdBy === user?.id)
      : allCourses || []
    const query = search.trim().toLocaleLowerCase('vi')
    if (!query) return visible
    return visible.filter((course) => (
      `${course.title} ${course.description || ''}`.toLocaleLowerCase('vi').includes(query)
    ))
  }, [allCourses, filterMode, search, teacher, user?.id])

  const openCreate = () => {
    setEditing({})
    setForm(EMPTY_FORM)
    setErrors({})
  }

  const openEdit = (course) => {
    setEditing(course)
    setForm({
      title: course.title || '',
      description: course.description || '',
      published: !!course.published,
    })
    setErrors({})
  }

  const save = async (event) => {
    event.preventDefault()
    if (!form.title.trim()) {
      setErrors({ title: 'Vui lòng nhập tiêu đề khóa học.' })
      return
    }
    setSaving(true)
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        published: form.published,
      }
      if (editing?.id) {
        await api.updateCourse(editing.id, payload)
        message.success('Đã cập nhật khóa học')
      } else {
        await api.createCourse(payload)
        message.success('Đã tạo khóa học mới')
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
      await api.deleteCourse(deleteTarget.id)
      message.success('Đã xóa khóa học')
      setDeleteTarget(null)
      refetch()
    } catch (error) {
      message.error(error.message)
    } finally {
      setDeleting(false)
    }
  }

  const togglePublish = async (course) => {
    try {
      await api.updateCourse(course.id, { published: !course.published })
      message.success(course.published ? 'Đã chuyển thành bản nháp' : 'Đã công khai khóa học')
      refetch()
    } catch (error) {
      message.error(error.message)
    }
  }

  const allCoursesList = allCourses || []
  const publishedCount = allCoursesList.filter((c) => c.published).length
  const totalUnits = allCoursesList.reduce((sum, c) => sum + (c.unitCount || 0), 0)

  return (
    <div className="page page--fluid flex flex-col gap-4">
      <AdminPageHeader
        eyebrow={teacher ? 'Giảng dạy' : 'Nội dung'}
        title={teacher ? 'Khóa học của tôi' : 'Quản lý khóa học & lộ trình'}
      />

      <div className="stat-metrics">
        <div className="stat-metrics__item">
          <div className="stat-metrics__label">Khóa học</div>
          <div className="stat-metrics__value">{allCoursesList.length}</div>
        </div>
        <div className="stat-metrics__item">
          <div className="stat-metrics__label">Đang công khai</div>
          <div className="stat-metrics__value">{publishedCount}</div>
        </div>
        <div className="stat-metrics__item">
          <div className="stat-metrics__label">Chủ đề</div>
          <div className="stat-metrics__value">{totalUnits}</div>
        </div>
      </div>

      <Card className="h-[66vh] min-h-0 flex flex-col overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Danh sách khóa học</p>
            <p className="text-xs text-muted-foreground">{courses.length} khóa học phù hợp</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {teacher && (
              <Tabs value={filterMode} onValueChange={setFilterMode}>
                <TabsList>
                  <TabsTrigger value="my">Của tôi</TabsTrigger>
                  <TabsTrigger value="all">Tất cả</TabsTrigger>
                </TabsList>
              </Tabs>
            )}
            <InputGroup className="w-full sm:w-64">
              <InputGroupAddon><Search /></InputGroupAddon>
              <InputGroupInput
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Tìm khóa học"
                aria-label="Tìm khóa học"
              />
            </InputGroup>
            <Button onClick={openCreate}><Plus data-icon="inline-start" />Tạo khóa học</Button>
          </div>
        </div>

        <CardContent className="px-0 flex-1 min-h-0 overflow-y-auto">
          {loading ? <LoadingRows /> : courses.length === 0 ? (
            <Empty className="min-h-72">
              <EmptyHeader>
                <EmptyMedia variant="icon"><BookOpen /></EmptyMedia>
                <EmptyTitle>Chưa có khóa học phù hợp</EmptyTitle>
                <EmptyDescription>Tạo lộ trình học tập mới hoặc thay đổi bộ lọc.</EmptyDescription>
              </EmptyHeader>
              <EmptyContent><Button onClick={openCreate}><Plus data-icon="inline-start" />Tạo khóa học</Button></EmptyContent>
            </Empty>
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Khóa học / Lộ trình</TableHead>
                      <TableHead className="text-center">Số chủ đề</TableHead>
                      <TableHead>Trạng thái</TableHead>
                      <TableHead>Ngày tạo</TableHead>
                      <TableHead className="text-left">Thao tác</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {courses.map((course) => {
                      const canManage = !teacher || course.createdBy === user?.id
                      return (
                        <TableRow key={course.id}>
                          <TableCell className="max-w-lg">
                            <div className="flex flex-col gap-1">
                              <Link className="font-medium text-foreground hover:underline" to={`${basePath}/${course.id}`}>{course.title}</Link>
                              {course.description && <span className="truncate text-sm text-muted-foreground">{course.description}</span>}
                            </div>
                          </TableCell>
                          <TableCell className="text-center"><Badge variant="secondary">{course.unitCount || 0} chủ đề</Badge></TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={course.published}
                                disabled={!canManage}
                                onCheckedChange={() => togglePublish(course)}
                                aria-label={`${course.published ? 'Chuyển thành bản nháp' : 'Công khai'} ${course.title}`}
                              />
                              <Badge variant={course.published ? 'default' : 'outline'}>{course.published ? 'Công khai' : 'Bản nháp'}</Badge>
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{course.createdAt ? new Date(course.createdAt).toLocaleDateString('vi-VN') : '—'}</TableCell>
                          <TableCell>
                            <div className="flex justify-start gap-1">
                              <Button variant="ghost" size="icon-sm" render={<Link to={`${basePath}/${course.id}`} />} nativeButton={false} aria-label="Xem chủ đề" title="Chủ đề"><ListTree /></Button>
                              {canManage && <Button variant="ghost" size="icon-sm" onClick={() => openEdit(course)} aria-label="Sửa khóa học" title="Sửa"><Edit3 /></Button>}
                              {canManage && <Button variant="ghost" size="icon-sm" onClick={() => setDeleteTarget(course)} aria-label="Xóa khóa học" title="Xóa"><Trash2 /></Button>}
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
              <div className="flex flex-col gap-3 p-3 md:hidden">
                {courses.map((course) => {
                  const canManage = !teacher || course.createdBy === user?.id
                  return (
                    <Card key={course.id} size="sm">
                      <CardHeader>
                        <CardTitle><Link to={`${basePath}/${course.id}`}>{course.title}</Link></CardTitle>
                        <CardDescription>{course.description || 'Chưa có mô tả'}</CardDescription>
                        {canManage && (
                          <div className="absolute right-4 top-4 flex gap-1">
                            <Button variant="ghost" size="icon-sm" onClick={() => openEdit(course)} aria-label="Sửa"><Edit3 /></Button>
                            <Button variant="ghost" size="icon-sm" onClick={() => setDeleteTarget(course)} aria-label="Xóa"><Trash2 /></Button>
                          </div>
                        )}
                      </CardHeader>
                      <CardContent className="flex flex-wrap items-center gap-2">
                        <Badge variant={course.published ? 'default' : 'outline'}>{course.published ? 'Công khai' : 'Bản nháp'}</Badge>
                        <Badge variant="secondary">{course.unitCount || 0} chủ đề</Badge>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={editing !== null} onOpenChange={(open) => !open && !saving && setEditing(null)}>
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={save}>
            <DialogHeader>
              <DialogTitle>{editing?.id ? 'Chỉnh sửa khóa học' : 'Tạo khóa học mới'}</DialogTitle>
              <DialogDescription>Thiết lập tên, mô tả và trạng thái xuất bản.</DialogDescription>
            </DialogHeader>
            <FieldGroup className="py-4">
              <Field data-invalid={!!errors.title}>
                <FieldLabel htmlFor="course-title">Tiêu đề khóa học</FieldLabel>
                <Input
                  id="course-title"
                  value={form.title}
                  onChange={(event) => {
                    setForm((current) => ({ ...current, title: event.target.value }))
                    setErrors({})
                  }}
                  maxLength={255}
                  placeholder="Ví dụ: Nhập môn Lập trình C++ từ số 0"
                  aria-invalid={!!errors.title}
                  autoFocus
                />
                <FieldError>{errors.title}</FieldError>
              </Field>
              <Field>
                <FieldLabel htmlFor="course-description">Mô tả khóa học</FieldLabel>
                <Textarea id="course-description" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} className="min-h-28" />
              </Field>
              <Field orientation="horizontal">
                <div className="flex-1">
                  <FieldLabel htmlFor="course-published">Công khai khóa học</FieldLabel>
                  <FieldDescription>Sinh viên có thể nhìn thấy khóa học sau khi công khai.</FieldDescription>
                </div>
                <Switch id="course-published" checked={form.published} onCheckedChange={(checked) => setForm((current) => ({ ...current, published: checked }))} />
              </Field>
            </FieldGroup>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditing(null)} disabled={saving}>Hủy</Button>
              <Button type="submit" disabled={saving}>
                {saving && <Spinner data-icon="inline-start" />}
                Lưu khóa học
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && !deleting && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa khóa học “{deleteTarget?.title}”?</AlertDialogTitle>
            <AlertDialogDescription>Tất cả chủ đề bên trong cũng sẽ bị xóa vĩnh viễn. Hành động này không thể hoàn tác.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Hủy</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={deleting} onClick={remove}>
              {deleting && <Spinner data-icon="inline-start" />}
              Xóa khóa học
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
