import { useState } from 'react'
import { Download } from 'lucide-react'
import { cn } from '../lib/utils'
import { downloadCsv } from '../lib/exportCsv'
import { paginateStandingRows, standingCellStatus } from '../lib/contest-standings'
import { Button } from './ui/button'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from './ui/empty'
import { Skeleton } from './ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'

const PAGE_SIZE = 20

function CellTooltip({ label, children }) {
  return (
    <Tooltip>
      <TooltipTrigger render={<span className="inline-flex cursor-help" />}>{children}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

/** Bảng xếp hạng ICPC. Mỗi ô bài chỉ hiển thị AC, WA hoặc chưa nộp. */
export default function ContestStandings({ data, loading, currentUserId, problems = [], contestTitle }) {
  const [page, setPage] = useState(1)
  const titles = Object.fromEntries(problems.map((problem) => [problem.label, problem.title]))
  const rows = data?.rows || []
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const visibleRows = paginateStandingRows(rows, currentPage, PAGE_SIZE)

  const exportCsv = () => {
    if (!data?.rows?.length) return
    const labelHeaders = (data.labels || []).map((label) => ({
      label,
      value: (row) => standingCellStatus(row.cells[label]),
    }))
    downloadCsv(data.rows, [
      { key: 'rank', label: 'Hạng' },
      { key: 'userId', label: 'MSSV' },
      { key: 'userName', label: 'Họ tên' },
      { key: 'solved', label: 'Số bài' },
      { key: 'penalty', label: 'Tổng thời gian' },
      ...labelHeaders,
    ], `standings-${contestTitle || 'contest'}.csv`)
  }

  if (loading) {
    return (
      <div className="space-y-2" aria-label="Đang tải bảng xếp hạng">
        {Array.from({ length: 5 }, (_, index) => <Skeleton key={index} className="h-12 w-full" />)}
      </div>
    )
  }

  if (!data?.rows?.length) {
    return (
      <Empty className="border-0 py-10">
        <EmptyHeader>
          <EmptyTitle>Chưa có thí sinh</EmptyTitle>
          <EmptyDescription>Bảng xếp hạng sẽ được cập nhật khi kỳ thi có người tham gia.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <div className="space-y-3">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-14 text-center">#</TableHead>
            <TableHead>Thí sinh</TableHead>
            <TableHead className="text-center">Số bài</TableHead>
            <TableHead className="text-center">
              <CellTooltip label="Tổng phút tính từ khi bắt đầu đến lúc AC">Tổng thời gian</CellTooltip>
            </TableHead>
            {(data.labels || []).map((label) => (
              <TableHead key={label} className="text-center">
                <CellTooltip label={titles[label]}><strong>{label}</strong></CellTooltip>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {visibleRows.map((row) => (
            <TableRow key={row.userId} data-state={row.userId === currentUserId ? 'selected' : undefined}>
              <TableCell className="text-center font-semibold">{row.rank}</TableCell>
              <TableCell>
                <div className="font-medium">{row.userName}</div>
                <div className="font-mono text-xs text-muted-foreground">{row.userId}</div>
              </TableCell>
              <TableCell className="text-center font-semibold">{row.solved}</TableCell>
              <TableCell className="text-center font-mono">{row.penalty}</TableCell>
              {(data.labels || []).map((label) => {
                const cell = row.cells[label]
                const status = standingCellStatus(cell)
                const tooltip = status === 'AC'
                  ? 'Đã chấp nhận'
                  : status === 'WA' ? 'Đã nộp nhưng chưa được chấp nhận' : 'Chưa nộp'
                return (
                  <TableCell key={label} className="text-center">
                    <CellTooltip label={tooltip}>
                      <span className={cn(
                        'inline-flex min-w-12 items-center justify-center rounded-md border px-2 py-1 font-mono text-xs font-medium',
                        status === 'AC' ? 'tone-ac' : status === 'WA' ? 'tone-wa' : 'border-transparent bg-muted',
                      )}>
                        {status}
                      </span>
                    </CellTooltip>
                  </TableCell>
                )
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
        <span className="text-sm text-muted-foreground">Trang {currentPage}/{pageCount} · {rows.length} thí sinh</span>
        <div className="flex items-center gap-2">
          {pageCount > 1 && (
            <>
              <Button size="sm" variant="outline" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Trước</Button>
              <Button size="sm" variant="outline" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>Sau</Button>
            </>
          )}
          <Button size="sm" variant="outline" onClick={exportCsv}>
            <Download data-icon="inline-start" />
            Xuất CSV
          </Button>
        </div>
      </div>
    </div>
  )
}
