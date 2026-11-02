import { ArrowRight, GraduationCap } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../../api'
import { useFetch } from '../../lib/hooks'
import StudentPageHeader from '../../components/student/StudentPageHeader'
import { Badge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '../../components/ui/empty'
import { Skeleton } from '../../components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table'

function ClassroomTableSkeleton() {
  return (
    <div className="flex flex-col gap-3 p-4" aria-busy="true" aria-label="Đang tải lớp học">
      {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-11 w-full" />)}
    </div>
  )
}

export default function TeacherClassroomsPage() {
  const navigate = useNavigate()
  const { data: classrooms, loading } = useFetch(() => api.listClassrooms(), [])
  const rows = classrooms || []

  return (
    <div className="page flex flex-col gap-5">
      <StudentPageHeader
        eyebrow="Giảng dạy"
        title="Lớp học được phân công"
        description="Lớp học do admin tạo và giao cho bạn phụ trách."
      />

      <Card className="min-h-80">
        <CardHeader className="border-b">
          <CardTitle>Danh sách lớp học</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          {loading ? (
            <ClassroomTableSkeleton />
          ) : rows.length === 0 ? (
            <Empty className="min-h-64">
              <EmptyHeader>
                <EmptyMedia variant="icon"><GraduationCap /></EmptyMedia>
                <EmptyTitle>Chưa có lớp học nào</EmptyTitle>
                <EmptyDescription>Bạn chưa được phân công lớp học nào. Hãy liên hệ admin.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tên lớp</TableHead>
                  <TableHead>Kỳ học</TableHead>
                  <TableHead>Ngày tạo</TableHead>
                  <TableHead className="text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((classroom) => (
                  <TableRow key={classroom.id}>
                    <TableCell className="min-w-56 whitespace-normal">
                      <Link to={`/teacher/classrooms/${classroom.id}`} className="font-medium hover:underline">
                        {classroom.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {classroom.semester
                        ? <Badge variant="secondary">{classroom.semester}</Badge>
                        : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(classroom.createdAt).toLocaleDateString('vi-VN')}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" onClick={() => navigate(`/teacher/classrooms/${classroom.id}`)}>
                        Quản lý
                        <ArrowRight data-icon="inline-end" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
