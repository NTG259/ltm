import { useEffect, useState } from 'react'
import { ArrowLeft, RefreshCw, Trophy } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../../api'
import { useFetch, useSocket } from '../../lib/hooks'
import { Badge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import {
  Card, CardContent, CardHeader, CardTitle,
} from '../../components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../components/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui/tooltip'
import { Skeleton } from '../../components/ui/skeleton'

const VERDICT_VARIANT = {
  AC: 'secondary',
  WA: 'destructive',
  TLE: 'outline',
  MLE: 'outline',
  RTE: 'destructive',
  CE: 'outline',
  SEC: 'outline',
}

function ProblemCell({ cell }) {
  if (!cell || cell.verdict === null) return <span className="text-muted-foreground">—</span>
  if (cell.verdict === 'AC') {
    return (
      <Tooltip>
        <TooltipTrigger render={<Badge variant="secondary" className="cursor-default font-mono text-green-600 dark:text-green-400">✓ {cell.attempts}</Badge>} />
        <TooltipContent>
          {cell.acAt ? new Date(cell.acAt).toLocaleTimeString('vi-VN') : 'AC'}
        </TooltipContent>
      </Tooltip>
    )
  }
  return (
    <Tooltip>
      <TooltipTrigger render={<Badge variant={VERDICT_VARIANT[cell.verdict] || 'outline'} className="cursor-default font-mono">{cell.verdict}</Badge>} />
      <TooltipContent>{cell.attempts} lần</TooltipContent>
    </Tooltip>
  )
}

function StatusDot({ online }) {
  return (
    <span
      className={`inline-block size-2 rounded-full ${online ? 'bg-green-500' : 'bg-muted-foreground/40'}`}
      aria-label={online ? 'Trực tuyến' : 'Ngoại tuyến'}
    />
  )
}

function LoadingRows() {
  return (
    <div className="flex flex-col gap-3 p-4">
      {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-10 w-full" />)}
    </div>
  )
}

export default function AdminContestMonitorPage({ teacher = false }) {
  const { cid, kid } = useParams()
  const [lastRefresh, setLastRefresh] = useState(null)
  const { data: rawRows, loading, reload } = useFetch(async () => {
    const res = await api.getContestMonitor(cid, kid)
    setLastRefresh(new Date())
    return res
  }, [cid, kid])
  const [presenceOverrides, setPresenceOverrides] = useState({})

  useEffect(() => {
    const t = setInterval(reload, 10000)
    return () => clearInterval(t)
  }, [reload])

  useSocket((msg) => {
    if (msg.type === 'SUBMISSION_UPDATE') {
      const userId = msg.submission?.userId ?? msg.submission?.user?.id
      if (userId && rawRows?.some((r) => r.userId === userId)) reload()
    }
    if (msg.type === 'PRESENCE_UPDATE') {
      setPresenceOverrides((prev) => ({ ...prev, [msg.userId]: msg.status === 'ONLINE' }))
    }
  })

  const rows = (rawRows || []).map((r) =>
    r.userId in presenceOverrides ? { ...r, online: presenceOverrides[r.userId] } : r
  )
  const labels = rawRows?.[0]?.problems?.map((p) => p.label) || []

  const data = rows ?? []
  const acLeader = data.length ? Math.max(...data.map((r) => Number(r.acCount) || 0)) : 0
  const sorted = [...data].sort((a, b) =>
    b.acCount - a.acCount || a.penaltyMinutes - b.penaltyMinutes
  )

  const basePath = teacher ? '/teacher' : '/admin'

  return (
    <div className="page flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" size="sm" render={<Link to={`${basePath}/classrooms/${cid}`} />} nativeButton={false}>
          <ArrowLeft data-icon="inline-start" />
          Chi tiết lớp
        </Button>
        <Button variant="outline" size="sm" render={<Link to={`${basePath}/contests`} />} nativeButton={false}>
          Danh sách kỳ thi
        </Button>
        <div className="flex flex-1 items-center gap-2">
          <Trophy className="size-5 text-muted-foreground" aria-hidden="true" />
          <h1 className="text-xl font-semibold">Giám sát kỳ thi</h1>
        </div>
        <Button variant="outline" size="sm" disabled={loading} onClick={reload}>
          <RefreshCw data-icon="inline-start" />
          Làm mới
        </Button>
        {lastRefresh && (
          <span className="text-xs text-muted-foreground">
            Cập nhật lúc {lastRefresh.toLocaleTimeString('vi-VN')}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Card size="sm">
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{data.length}</div>
            <div className="text-xs text-muted-foreground">Sinh viên</div>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {data.filter((r) => r.online).length}
            </div>
            <div className="text-xs text-muted-foreground">Đang online</div>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{acLeader}</div>
            <div className="text-xs text-muted-foreground">Bài AC cao nhất</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Bảng theo dõi</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          {loading && !rawRows ? <LoadingRows /> : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-4 text-center">#</TableHead>
                    <TableHead>MSSV</TableHead>
                    <TableHead>Họ tên</TableHead>
                    <TableHead className="text-center">AC</TableHead>
                    <TableHead className="text-center">Nộp</TableHead>
                    <TableHead className="text-center">Thời gian</TableHead>
                    <TableHead className="text-center">Lần cuối</TableHead>
                    {labels.map((label) => (
                      <TableHead key={label} className="text-center">{label}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7 + labels.length} className="py-8 text-center text-muted-foreground">
                        Chưa có dữ liệu
                      </TableCell>
                    </TableRow>
                  ) : sorted.map((row, index) => (
                    <TableRow key={row.userId}>
                      <TableCell className="text-center text-xs text-muted-foreground">{index + 1}</TableCell>
                      <TableCell className="font-mono text-sm">
                        <div className="flex items-center gap-2">
                          <StatusDot online={row.online} />
                          {row.username}
                        </div>
                      </TableCell>
                      <TableCell className="truncate max-w-36">{row.fullName}</TableCell>
                      <TableCell className="text-center">
                        <span className={`font-bold ${row.acCount > 0 ? 'text-green-600 dark:text-green-400' : ''}`}>
                          {row.acCount}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">{row.totalSubmissions}</TableCell>
                      <TableCell className="text-center font-mono text-sm">
                        {row.penaltyMinutes > 0 ? `${row.penaltyMinutes}'` : '—'}
                      </TableCell>
                      <TableCell className="text-center">
                        {row.lastSubmitAt ? (
                          <Tooltip>
                            <TooltipTrigger render={<span className="cursor-default text-xs">{new Date(row.lastSubmitAt).toLocaleTimeString('vi-VN')}</span>} />
                            <TooltipContent>
                              {new Date(row.lastSubmitAt).toLocaleString('vi-VN')}
                            </TooltipContent>
                          </Tooltip>
                        ) : '—'}
                      </TableCell>
                      {labels.map((label) => {
                        const cell = row.problems?.find((p) => p.label === label)
                        return (
                          <TableCell key={label} className="text-center">
                            <ProblemCell cell={cell} />
                          </TableCell>
                        )
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
