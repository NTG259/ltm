import { useCallback, useEffect, useState } from 'react'
import { api, onSocketStatus, subscribe } from '../api'

/** Gọi API một lần (và khi deps đổi); trả về { data, error, loading, reload }. */
export function useFetch(fn, deps) {
  const [state, setState] = useState({ data: null, error: null, loading: true })
  const [tick, setTick] = useState(0)
  useEffect(() => {
    let alive = true
    fn()
      .then((data) => alive && setState({ data, error: null, loading: false }))
      .catch((error) => alive && setState({ data: null, error, loading: false }))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])
  const setData = useCallback(
    (update) => setState((s) => ({ ...s, data: typeof update === 'function' ? update(s.data) : update })),
    [],
  )
  const reload = useCallback(() => setTick((t) => t + 1), [])
  return { ...state, setData, reload }
}

/** Theo dõi một bài nộp: tải ban đầu rồi cập nhật realtime qua WebSocket. */
export function useLiveSubmission(id) {
  const [sub, setSub] = useState(null)
  const [error, setError] = useState(null)
  useEffect(() => {
    if (id == null) return undefined
    let alive = true
    api
      .getSubmission(id)
      .then((s) => alive && setSub(s))
      .catch((e) => alive && setError(e))
    const off = subscribe((msg) => {
      if (msg.type === 'SUBMISSION_UPDATE' && msg.submission.id === Number(id)) {
        setSub((prev) => ({ ...prev, ...msg.submission }))
      }
    })
    return () => {
      alive = false
      off()
    }
  }, [id])
  return { sub: id == null ? null : sub, error }
}

/** Lắng nghe mọi bản tin WebSocket. */
export function useSocket(handler) {
  useEffect(() => subscribe(handler), [handler])
}

export function useSocketStatus() {
  const [status, setStatus] = useState('connecting')
  useEffect(() => onSocketStatus(setStatus), [])
  return status
}

/** Đồng hồ cập nhật định kỳ để hiển thị thời gian tương đối. */
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(t)
  }, [intervalMs])
  return now
}
