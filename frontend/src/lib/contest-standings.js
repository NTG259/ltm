export function standingCellStatus(cell) {
  if (!cell) return '-'
  return cell.solved ? 'AC' : 'WA'
}

export function paginateStandingRows(rows, page, pageSize) {
  const start = (page - 1) * pageSize
  return rows.slice(start, start + pageSize)
}
