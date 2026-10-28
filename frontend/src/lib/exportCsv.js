/** Tải xuống dữ liệu dạng CSV. rows là mảng object, headers là mảng {key, label}. */
export function downloadCsv(rows, headers, filename) {
  const escape = (v) => {
    const s = v == null ? '' : String(v)
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s
  }
  const headerLine = headers.map((h) => escape(h.label)).join(',')
  const lines = rows.map((r) => headers.map((h) => escape(typeof h.value === 'function' ? h.value(r) : r[h.key])).join(','))
  const csv = [headerLine, ...lines].join('\r\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
