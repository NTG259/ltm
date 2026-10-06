export function formatTime(ms) {
  if (ms == null) return '—'
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${ms} ms`
}

export function formatMemory(kb) {
  if (kb == null) return '—'
  return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`
}

export function formatClock(ts) {
  return new Date(ts).toLocaleTimeString('vi-VN', { hour12: false })
}

export function formatDateTime(ts) {
  const d = new Date(ts)
  return `${d.toLocaleDateString('vi-VN')} ${d.toLocaleTimeString('vi-VN', { hour12: false })}`
}

export function formatRelative(ts, now) {
  const s = Math.max(0, Math.round((now - ts) / 1000))
  if (s < 5) return 'vừa xong'
  if (s < 60) return `${s} giây trước`
  const m = Math.round(s / 60)
  if (m < 60) return `${m} phút trước`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} giờ trước`
  return `${Math.round(h / 24)} ngày trước`
}

export function percent(a, b) {
  return b ? Math.round((a / b) * 1000) / 10 : 0
}
