import { useCallback, useMemo, useState } from 'react'
import { ArrowLeft, ChevronRight, Search, Trophy } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../../api'
import AdminPageHeader from '../../components/admin/AdminPageHeader'
import ContestStandings from '../../components/ContestStandings'
import { Alert, AlertDescription, AlertTitle } from '../../components/ui/alert'
import { Badge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '../../components/ui/empty'
import { InputGroup, InputGroupAddon, InputGroupInput } from '../../components/ui/input-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select'
import { Skeleton } from '../../components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table'
import { CONTEST_STATUS, liveStatus } from '../../lib/contest'
import { filterContestLeaderboard } from '../../lib/admin-contest-leaderboard'
import { formatDateTime, formatDuration } from '../../lib/format'
import { useFetch, useNow, useSocket } from '../../lib/hooks'

const STATUS_VARIANT = {
  UPCOMING: 'outline',
  RUNNING: 'secondary',
  ENDED: 'outline',
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'Tất cả trạng thái' },
  { value: 'RUNNING', label: 'Đang diễn ra' },
  { value: 'UPCOMING', label: 'Sắp diễn ra' },
  { value: 'ENDED', label: 'Đã kết thúc' },
]

function ContestListLoading() {
  return (
    <div className="flex flex-col gap-3 p-4" aria-busy="true" aria-label="Đang tải danh sách kỳ thi">
      {Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-12 w-full" />)}
    </div>
  )
}

function ContestList() {
  const now = useNow(1000)
  const contests = useFetch(() => api.listContests(), [])
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const { reload } = contests
  useSocket(useCallback((message) => {
    if (message.type === 'CONTEST_UPDATE') reload()
  }, [reload]))

  const rows = useMemo(
    () => filterContestLeaderboard(contests.data, { search, status, now }),
    [contests.data, search, status, now],
  )

  return (
    <div className="page page--fluid flex flex-col gap-4">
      <AdminPageHeader
        eyebrow="Thi cử"
        title="Quản lý xếp hạng"
        description="Chọn một kỳ thi để xem bảng xếp hạng và xuất kết quả."
      />

      <Card className="min-h-0 overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Danh sách kỳ thi</p>
            <p className="text-xs text-muted-foreground">{rows.length} kỳ thi phù hợp</p>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <InputGroup className="w-full sm:w-64">
              <InputGroupAddon><Search /></InputGroupAddon>
              <InputGroupInput
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Tìm tên kỳ thi"
                aria-label="Tìm kỳ thi để xem xếp hạng"
              />
            </InputGroup>
            <Select items={STATUS_OPTIONS} value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-full sm:w-44" aria-label="Lọc trạng thái kỳ thi">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <CardContent className="px-0">
          {contests.error ? (
            <Alert variant="destructive" className="m-4">
              <AlertTitle>Không thể tải danh sách kỳ thi</AlertTitle>
              <AlertDescription>{contests.error.message}</AlertDescription>
            </Alert>
          ) : contests.loading ? <ContestListLoading /> : rows.length === 0 ? (
            <Empty className="min-h-72">
              <EmptyHeader>
                <EmptyMedia variant="icon"><Trophy /></EmptyMedia>
                <EmptyTitle>Không có kỳ thi phù hợp</EmptyTitle>
                <EmptyDescription>Thử đổi từ khóa hoặc bộ lọc trạng thái.</EmptyDescription>
              </EmptyHeader>
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
                      <TableHead className="w-28">Xếp hạng</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((contest) => {
                      const contestStatus = liveStatus(contest, now)
                      const path = `/admin/leaderboard/${contest.id}`
                      return (
                        <TableRow key={contest.id}>
                          <TableCell>
                            <Link className="font-medium text-foreground hover:underline" to={path}>{contest.title}</Link>
                            <div className="text-xs text-muted-foreground">{contest.problems?.length || 0} bài</div>
                          </TableCell>
                          <TableCell>{contest.classroomName ? <Badge variant="secondary">{contest.classroomName}</Badge> : '—'}</TableCell>
                          <TableCell><Badge variant={STATUS_VARIANT[contestStatus]}>{CONTEST_STATUS[contestStatus]?.label}</Badge></TableCell>
                          <TableCell className="text-sm text-muted-foreground">{formatDateTime(contest.startAt)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{formatDuration(contest.durationMin)}</TableCell>
                          <TableCell className="text-center">{contest.participantCount ?? 0}</TableCell>
                          <TableCell>
                            <Button variant="outline" size="sm" render={<Link to={path} />} nativeButton={false}>
                              Xem <ChevronRight data-icon="inline-end" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className="flex flex-col gap-3 p-3 md:hidden">
                {rows.map((contest) => {
                  const contestStatus = liveStatus(contest, now)
                  return (
                    <Card key={contest.id} size="sm">
                      <CardHeader>
                        <CardTitle>{contest.title}</CardTitle>
                        <CardDescription>{formatDateTime(contest.startAt)} · {formatDuration(contest.durationMin)}</CardDescription>
                      </CardHeader>
                      <CardContent className="flex flex-wrap items-center gap-2">
                        <Badge variant={STATUS_VARIANT[contestStatus]}>{CONTEST_STATUS[contestStatus]?.label}</Badge>
                        <span className="text-xs text-muted-foreground">{contest.participantCount ?? 0} thí sinh</span>
                        <Button className="ml-auto" variant="outline" size="sm" render={<Link to={`/admin/leaderboard/${contest.id}`} />} nativeButton={false}>
                          Xem xếp hạng <ChevronRight data-icon="inline-end" />
                        </Button>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function ContestRanking({ contestId }) {
  const now = useNow(1000)
  const contest = useFetch(() => api.getContest(contestId), [contestId])
  const standings = useFetch(() => api.contestStandings(contestId), [contestId])
  const { reload } = standings
  useSocket(useCallback((message) => {
    if (message.type === 'SUBMISSION_UPDATE' && message.submission?.contestId === Number(contestId)) reload()
  }, [contestId, reload]))

  const data = contest.data
  const status = data ? liveStatus(data, now) : null

  return (
    <div className="page page--fluid flex flex-col gap-4">
      <AdminPageHeader
        eyebrow="Xếp hạng kỳ thi"
        title={data?.title || 'Bảng xếp hạng'}
        description={data ? `${formatDateTime(data.startAt)} · ${formatDuration(data.durationMin)} · ${data.participantCount ?? 0} thí sinh` : 'Đang tải thông tin kỳ thi…'}
        actions={(
          <Button variant="outline" render={<Link to="/admin/leaderboard" />} nativeButton={false}>
            <ArrowLeft data-icon="inline-start" /> Danh sách kỳ thi
          </Button>
        )}
      />

      {contest.error || standings.error ? (
        <Alert variant="destructive">
          <AlertTitle>Không thể tải bảng xếp hạng</AlertTitle>
          <AlertDescription>{contest.error?.message || standings.error?.message}</AlertDescription>
        </Alert>
      ) : (
        <Card>
          <CardHeader className="border-b">
            <div className="flex flex-wrap items-center gap-2">
              {status && <Badge variant={STATUS_VARIANT[status]}>{CONTEST_STATUS[status]?.label}</Badge>}
              {data?.classroomName && <Badge variant="secondary">{data.classroomName}</Badge>}
            </div>
            <CardTitle>Kết quả kỳ thi</CardTitle>
            <CardDescription>Xếp theo số bài giải đúng, sau đó theo tổng thời gian.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto pt-4">
            <ContestStandings
              data={standings.data}
              loading={(contest.loading || standings.loading) && !standings.data}
              problems={data?.problems || []}
              contestTitle={data?.title}
            />
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default function AdminContestLeaderboardPage() {
  const { id } = useParams()
  return id ? <ContestRanking contestId={Number(id)} /> : <ContestList />
}
