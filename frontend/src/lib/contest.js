export const CONTEST_STATUS = {
  RUNNING: { label: 'Đang diễn ra', color: 'green' },
  UPCOMING: { label: 'Sắp diễn ra', color: 'blue' },
  ENDED: { label: 'Đã kết thúc', color: 'default' },
}

/** Trạng thái tính lại theo đồng hồ hiện tại (để tự chuyển khi kỳ thi bắt đầu / kết thúc). */
export function liveStatus(contest, now) {
  if (now < contest.startAt) return 'UPCOMING'
  if (now < contest.endAt) return 'RUNNING'
  return 'ENDED'
}
