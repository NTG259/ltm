import { CalendarDays, Clock3, Trophy } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useNow } from '../../lib/hooks'
import { formatDateTime } from '../../lib/format'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '../ui/empty'
import { Skeleton } from '../ui/skeleton'

function contestPhase(contest, now) {
  if (now < contest.startAt) return { variant: 'secondary', label: 'Sắp diễn ra' }
  if (now < contest.endAt) return { variant: 'default', label: 'Đang diễn ra' }
  return { variant: 'outline', label: 'Đã kết thúc' }
}

function ContestPanelSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-2" aria-busy="true" aria-label="Đang tải kỳ thi">
      {Array.from({ length: 2 }, (_, index) => (
        <Card key={index}><CardContent><Skeleton className="h-32 w-full" /></CardContent></Card>
      ))}
    </div>
  )
}

export default function ClassroomContestsPanel({ classroom, loading }) {
  const navigate = useNavigate()
  const now = useNow(30000)
  const contests = classroom?.contests || []

  if (loading) return <ContestPanelSkeleton />

  if (!contests.length) {
    return (
      <Empty className="min-h-64">
        <EmptyHeader>
          <EmptyMedia variant="icon"><Trophy /></EmptyMedia>
          <EmptyTitle>Chưa có kỳ thi</EmptyTitle>
          <EmptyDescription>Lớp học chưa có kỳ thi nào được công bố.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <header className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Kỳ thi của lớp</h2>
          <p className="text-sm text-muted-foreground">Theo dõi lịch thi và vào phòng thi đúng giờ.</p>
        </div>
        <Badge variant="secondary">{contests.length} kỳ thi</Badge>
      </header>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {contests.map((contest) => {
          const phase = contestPhase(contest, now)
          return (
            <Card key={contest.contestId}>
              <CardHeader>
                <CardTitle>{contest.title}</CardTitle>
                <CardDescription className="flex items-center gap-2">
                  <Trophy className="size-4" /> {classroom?.name || 'Kỳ thi trong lớp'}
                </CardDescription>
                <Badge variant={phase.variant} className="w-fit">{phase.label}</Badge>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 text-sm">
                <div className="flex items-start gap-2">
                  <CalendarDays className="mt-0.5 size-4 text-muted-foreground" />
                  <span>Bắt đầu <strong>{formatDateTime(contest.startAt)}</strong></span>
                </div>
                <div className="flex items-start gap-2">
                  <Clock3 className="mt-0.5 size-4 text-muted-foreground" />
                  <span>Kết thúc <strong>{formatDateTime(contest.endAt)}</strong></span>
                </div>
              </CardContent>
              <CardFooter>
                <Button
                  className="w-full"
                  variant={phase.label === 'Đang diễn ra' ? 'default' : 'outline'}
                  onClick={() => navigate(`/contests/${contest.contestId}`)}
                >
                  Xem kỳ thi
                </Button>
              </CardFooter>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
