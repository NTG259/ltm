import { Download, Star } from 'lucide-react'
import { downloadCsv } from '../lib/exportCsv'
import { Button } from './ui/button'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from './ui/empty'
import { Skeleton } from './ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'

function CellTooltip({ label, children }) {
  return (
    <Tooltip>
      <TooltipTrigger render={<span className="inline-flex cursor-help" />}>{children}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

/** Bảng xếp hạng ICPC. Ô hiển thị phút AC và số lần nộp sai trước đó. */
export default function ContestStandings({ data, loading, currentUserId, problems = [], contestTitle }) {
  const titles = Object.fromEntries(problems.map((problem) => [problem.label, problem.title]))

  const exportCsv = () => {
    if (!data?.rows?.length) return
    const labelHeaders = (data.labels || []).map((label) => ({
      label,
      value: (row) => {
        const cell = row.cells[label]
        if (!cell) return ''
        if (cell.solved) return `AC ${cell.minute}'${cell.wrong ? ` (+${cell.wrong})` : ''}`
        if (cell.pending) return 'Đang chấm'
        return cell.wrong ? `-${cell.wrong}` : ''
      },
    }))
    downloadCsv(data.rows, [
      { key: 'rank', label: 'Hạng' },
      { key: 'userId', label: 'MSSV' },
      { key: 'userName', label: 'Họ tên' },
      { key: 'solved', label: 'Số bài' },
      { key: 'penalty', label: 'Phạt' },
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
              <CellTooltip label={`Tổng phút tới khi AC + ${data.penaltyPerWrong ?? 20} phút cho mỗi lần sai`}>Phạt</CellTooltip>
            </TableHead>
            {(data.labels || []).map((label) => (
              <TableHead key={label} className="text-center">
                <CellTooltip label={titles[label]}><strong>{label}</strong></CellTooltip>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.rows.map((row) => (
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
                if (!cell) return <TableCell key={label} />
                const tooltip = cell.solved
                  ? `AC ở phút ${cell.minute}${cell.wrong ? `, sai ${cell.wrong} lần trước đó` : ''}${cell.first ? ' – giải đầu tiên' : ''}`
                  : cell.pending ? 'Đang chấm' : `Sai ${cell.wrong} lần`
                return (
                  <TableCell key={label} className="text-center">
                    <CellTooltip label={tooltip}>
                      <span className="inline-flex min-w-12 items-center justify-center gap-1 rounded-md bg-muted px-2 py-1 font-mono text-xs font-medium">
                        {cell.first && <Star className="size-3 fill-current" />}
                        {cell.solved ? <>{cell.minute}′<small>{cell.wrong ? `+${cell.wrong}` : ''}</small></> : cell.pending ? '?' : `−${cell.wrong}`}
                      </span>
                    </CellTooltip>
                  </TableCell>
                )
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
        <p className="text-xs text-muted-foreground">
          Ô kết quả hiển thị phút AC và số lần sai. <Star className="inline size-3 fill-current" /> là người giải đầu tiên. Lỗi biên dịch không tính phạt.
        </p>
        <Button size="sm" variant="outline" onClick={exportCsv}>
          <Download data-icon="inline-start" />
          Xuất CSV
        </Button>
      </div>
    </div>
  )
}
