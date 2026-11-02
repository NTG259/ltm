import { Search, Trophy, Users } from 'lucide-react'
import StudentPageHeader from './StudentPageHeader'
import { Alert, AlertDescription, AlertTitle } from '../ui/alert'
import { Badge } from '../ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '../ui/empty'
import { InputGroup, InputGroupAddon, InputGroupInput } from '../ui/input-group'
import { Skeleton } from '../ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table'

function RankTableSkeleton() {
  return (
    <div className="flex flex-col gap-3 p-4" aria-busy="true" aria-label="Đang tải bảng xếp hạng">
      {Array.from({ length: 8 }, (_, index) => <Skeleton key={index} className="h-11 w-full" />)}
    </div>
  )
}

export default function StudentLeaderboardView({
  rows,
  loading,
  error,
  scopeReady,
  scopeLoading,
  scopeError,
  myRow,
  userId,
  search,
  onSearchChange,
  updatedAt,
}) {
  return (
    <div className="page flex flex-col gap-5">
      <StudentPageHeader
        eyebrow="Hoạt động"
        title="Bảng xếp hạng"
        description="So sánh tiến độ luyện tập trong lớp và theo dõi vị trí hiện tại của bạn."
      />

      {scopeError && (
        <Alert variant="destructive">
          <AlertTitle>Không thể tải phạm vi lớp học</AlertTitle>
          <AlertDescription>{scopeError.message}</AlertDescription>
        </Alert>
      )}

      {!scopeReady && !scopeLoading && !scopeError ? (
        <Card>
          <CardContent>
            <Empty className="min-h-72">
              <EmptyHeader>
                <EmptyMedia variant="icon"><Users /></EmptyMedia>
                <EmptyTitle>Bạn chưa thuộc lớp học nào</EmptyTitle>
                <EmptyDescription>Bảng xếp hạng sẽ xuất hiện khi bạn được thêm vào lớp.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          </CardContent>
        </Card>
      ) : scopeReady && (
        <>
          {myRow && (
            <div className="grid grid-cols-1 gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-3">
              <div className="bg-card p-4">
                <span className="text-xs text-muted-foreground">Hạng hiện tại</span>
                <div className="mt-1 text-2xl font-semibold">#{myRow.rank}</div>
              </div>
              <div className="bg-card p-4">
                <span className="text-xs text-muted-foreground">Bài đã giải</span>
                <div className="mt-1 text-2xl font-semibold">{myRow.solved}</div>
              </div>
              <div className="bg-card p-4">
                <span className="text-xs text-muted-foreground">Lượt nộp</span>
                <div className="mt-1 text-2xl font-semibold">{myRow.attempts}</div>
              </div>
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertTitle>Không thể tải bảng xếp hạng</AlertTitle>
              <AlertDescription>{error.message}</AlertDescription>
            </Alert>
          )}

          <Card className="min-h-80">
            <CardHeader className="border-b">
              <CardTitle>Xếp hạng sinh viên</CardTitle>
              <CardDescription>Cập nhật: {updatedAt == null ? '—' : new Date(updatedAt).toLocaleString('vi-VN')}</CardDescription>
              <div className="pt-2">
                <InputGroup className="w-full sm:w-64">
                  <InputGroupAddon><Search /></InputGroupAddon>
                  <InputGroupInput
                    type="search"
                    placeholder="Tìm sinh viên hoặc MSSV"
                    value={search}
                    onChange={(event) => onSearchChange(event.target.value)}
                    aria-label="Tìm trong bảng xếp hạng"
                  />
                </InputGroup>
              </div>
            </CardHeader>
            <CardContent className="px-0">
              {loading ? <RankTableSkeleton /> : rows.length === 0 ? (
                <Empty className="min-h-56">
                  <EmptyHeader>
                    <EmptyMedia variant="icon"><Trophy /></EmptyMedia>
                    <EmptyTitle>Chưa có dữ liệu xếp hạng</EmptyTitle>
                    <EmptyDescription>Hãy thử thay đổi từ khóa tìm kiếm.</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-20 text-center">Hạng</TableHead>
                      <TableHead>Sinh viên</TableHead>
                      <TableHead className="text-center">Đã giải</TableHead>
                      <TableHead className="text-center">Lượt nộp</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={row.userId} data-state={row.userId === userId ? 'selected' : undefined}>
                        <TableCell className="text-center font-semibold">#{row.rank}</TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{row.userName}</span>
                              {row.userId === userId && <Badge variant="secondary">Bạn</Badge>}
                            </div>
                            <span className="font-mono text-xs text-muted-foreground">{row.userId}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center font-semibold">{row.solved}</TableCell>
                        <TableCell className="text-center">{row.attempts}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
