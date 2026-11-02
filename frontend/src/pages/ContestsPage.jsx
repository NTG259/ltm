import { useCallback, useState } from 'react'
import { CalendarDays, GraduationCap, Trophy } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth/context'
import { useFetch, useNow, useSocket } from '../lib/hooks'
import { formatDateTime, formatDuration } from '../lib/format'
import { CONTEST_STATUS, liveStatus } from '../lib/contest'
import ContestClock from '../components/ContestClock'
import StudentPageHeader from '../components/student/StudentPageHeader'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '../components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '../components/ui/empty'
import { Skeleton } from '../components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs'

const STATUS_VARIANT = {
  RUNNING: 'default',
  UPCOMING: 'secondary',
  ENDED: 'outline',
}

function ContestCard({ contest, status }) {
  const navigate = useNavigate()
  const { isAdmin, isLecturer } = useAuth()
  const isStaff = isAdmin || isLecturer
  const open = () => navigate(`/contests/${contest.id}`)

  let action
  if (status === 'ENDED') {
    action = <Button variant="outline" size="sm" onClick={open}>Xem kết quả</Button>
  } else if (isStaff) {
    action = <Button variant="outline" size="sm" onClick={open}>{status === 'RUNNING' ? 'Giám sát' : 'Theo dõi'}</Button>
  } else if (status === 'RUNNING') {
    action = <Button size="sm" onClick={open}>Vào thi</Button>
  } else {
    action = <Button variant="outline" size="sm" onClick={open}>Xem thể lệ</Button>
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>{contest.title}</CardTitle>
        <CardDescription>
          {formatDateTime(contest.startAt)} · {formatDuration(contest.durationMin)}
        </CardDescription>
        <CardAction className="flex gap-1">
          <Badge variant={STATUS_VARIANT[status]}>{CONTEST_STATUS[status].label}</Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {contest.classroomName && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <GraduationCap className="size-4" aria-hidden="true" />
            <span>{contest.classroomName}</span>
          </div>
        )}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CalendarDays className="size-4" aria-hidden="true" />
          <span>{contest.participantCount} thí sinh tham gia</span>
        </div>
        {status !== 'ENDED' && <ContestClock contest={contest} compact />}
      </CardContent>
      <CardFooter className="justify-end">{action}</CardFooter>
    </Card>
  )
}

function ContestGridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2" aria-busy="true" aria-label="Đang tải kỳ thi">
      {Array.from({ length: 4 }, (_, index) => (
        <Card key={index}>
          <CardHeader>
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
          </CardHeader>
          <CardContent><Skeleton className="h-12 w-full" /></CardContent>
        </Card>
      ))}
    </div>
  )
}

export default function ContestsPage() {
  const { user } = useAuth()
  const now = useNow(1000)
  const [filter, setFilter] = useState('active')
  const list = useFetch(() => api.listContests(user), [user])
  const { reload } = list
  useSocket(useCallback((message) => message.type === 'CONTEST_UPDATE' && reload(), [reload]))

  const contests = (list.data || []).map((contest) => ({ contest, status: liveStatus(contest, now) }))
  const order = { RUNNING: 0, UPCOMING: 1, ENDED: 2 }
  const shown = contests
    .filter(({ status }) => (filter === 'active' ? status !== 'ENDED' : status === 'ENDED'))
    .sort((left, right) => (
      order[left.status] - order[right.status]
      || (left.status === 'ENDED'
        ? right.contest.startAt - left.contest.startAt
        : left.contest.startAt - right.contest.startAt)
    ))

  return (
    <div className="page flex flex-col gap-5">
      <StudentPageHeader
        title="Kỳ thi"
        actions={(
          <Tabs value={filter} onValueChange={setFilter}>
            <TabsList>
              <TabsTrigger value="active">Đang & sắp diễn ra</TabsTrigger>
              <TabsTrigger value="ended">Đã kết thúc</TabsTrigger>
            </TabsList>
          </Tabs>
        )}
      />

      {list.loading ? <ContestGridSkeleton /> : shown.length ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {shown.map(({ contest, status }) => (
            <ContestCard
              key={contest.id}
              contest={contest}
              status={status}
            />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent>
            <Empty className="min-h-72">
              <EmptyHeader>
                <EmptyMedia variant="icon"><Trophy /></EmptyMedia>
                <EmptyTitle>{filter === 'active' ? 'Chưa có kỳ thi sắp diễn ra' : 'Chưa có kỳ thi đã kết thúc'}</EmptyTitle>
                <EmptyDescription>Lịch thi mới sẽ xuất hiện tại đây khi được công bố.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
