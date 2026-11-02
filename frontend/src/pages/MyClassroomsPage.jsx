import { ArrowRight, GraduationCap } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useFetch } from '../lib/hooks'
import StudentPageHeader from '../components/student/StudentPageHeader'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '../components/ui/empty'
import { Skeleton } from '../components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'

function ClassroomTableSkeleton() {
  return (
    <div className="flex flex-col gap-3 p-4" aria-busy="true" aria-label="Đang tải lớp học">
      {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-11 w-full" />)}
    </div>
  )
}

export default function MyClassroomsPage() {
  const navigate = useNavigate()
  const { data: classrooms, loading } = useFetch(() => api.listClassrooms(), [])
  const rows = classrooms || []

  return (
    <div className="page flex flex-col gap-5">
      <StudentPageHeader
        title="Lớp học của tôi"
        description="Theo dõi khóa học, tiến độ học tập và các kỳ thi được giao theo lớp."
      />

      <Card className="min-h-80">
        <CardHeader className="border-b">
          <CardTitle>Danh sách lớp học</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          {loading ? <ClassroomTableSkeleton /> : rows.length === 0 ? (
            <Empty className="min-h-64">
              <EmptyHeader>
                <EmptyMedia variant="icon"><GraduationCap /></EmptyMedia>
                <EmptyTitle>Bạn chưa có lớp học</EmptyTitle>
                <EmptyDescription>Liên hệ giảng viên để được thêm vào lớp.</EmptyDescription>
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
                      <Link to={`/my-classrooms/${classroom.id}`} className="font-medium hover:underline">
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
                      <Button size="sm" onClick={() => navigate(`/my-classrooms/${classroom.id}`)}>
                        Vào lớp học
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
