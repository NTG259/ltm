import { useEffect, useRef, useState } from 'react'
import { api } from '../api'

/**
 * Hook giám sát thi cử: Tự động bắt sự kiện rời tab (visibilitychange / blur)
 * khi thí sinh đang trong phòng thi.
 */
export function useProctoring({ contest, user, enabled = true, onViolation, initialCount = 0 }) {
  const [violationCount, setViolationCount] = useState(initialCount)
  const lastTriggerRef = useRef(0)
  const countRef = useRef(initialCount)

  // Đồng bộ số lần vi phạm đã có từ server khi vào phòng thi (nếu thí sinh F5 / tải lại trang)
  useEffect(() => {
    if (!enabled || !contest?.id || !user || user.role === 'admin') return

    let cancelled = false
    api.getProctorStatus(contest.id)
      .then((data) => {
        if (cancelled || !data?.participants) return
        const me = data.participants.find((p) => String(p.userId) === String(user.id) || p.username === user.id)
        if (me && typeof me.tabSwitchCount === 'number') {
          countRef.current = me.tabSwitchCount
          setViolationCount(me.tabSwitchCount)
        }
      })
      .catch(() => {
        /* Bỏ qua lỗi mạng nền */
      })

    return () => {
      cancelled = true
    }
  }, [contest?.id, user, enabled])

  useEffect(() => {
    // Chỉ kích hoạt khi:
    // 1. Có contest và đang trong thời gian thi (RUNNING)
    // 2. Người dùng là thí sinh (không phải Admin)
    // 3. enabled === true
    if (!enabled || !contest?.id || !user || user.role === 'admin') {
      return
    }

    const report = async (type, details) => {
      const now = Date.now()
      // Chống kích hoạt đúp (visibilitychange + blur cùng nổ trong 2.5s)
      if (now - lastTriggerRef.current < 2500) {
        return
      }
      lastTriggerRef.current = now
      countRef.current += 1
      const currentCount = countRef.current
      setViolationCount(currentCount)

      try {
        await api.reportViolation(contest.id, {
          violationType: type,
          details: `${details} (Lần ${currentCount})`,
        })
      } catch {
        /* Bỏ qua lỗi mạng nền để không làm gián đoạn bài làm */
      }

      if (typeof onViolation === 'function') {
        onViolation(currentCount, type)
      }
    }

    const handleVisibilityChange = () => {
      if (document.hidden) {
        report('TAB_SWITCH', 'Rời tab hoặc thu nhỏ trình duyệt')
      }
    }

    const handleBlur = () => {
      // Khi cửa sổ mất focus (click sang ứng dụng khác như Zalo, Chrome khác, Notepad)
      report('WINDOW_BLUR', 'Mất tiêu điểm cửa sổ làm bài')
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('blur', handleBlur)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('blur', handleBlur)
    }
  }, [contest?.id, contest?.status, user, enabled, onViolation])

  return {
    violationCount,
    setViolationCount,
  }
}
