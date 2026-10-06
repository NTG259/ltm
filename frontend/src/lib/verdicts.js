// 7 nhãn kết quả cuối cùng + các trạng thái trung gian do Worker gửi qua OP_TASK_STATUS.
export const VERDICTS = {
  AC: { label: 'Accepted', short: 'AC', tone: 'ac', desc: 'Kết quả chính xác' },
  WA: { label: 'Wrong Answer', short: 'WA', tone: 'wa', desc: 'Đầu ra không khớp đáp án' },
  TLE: { label: 'Time Limit Exceeded', short: 'TLE', tone: 'tle', desc: 'Vượt giới hạn thời gian' },
  MLE: { label: 'Memory Limit Exceeded', short: 'MLE', tone: 'mle', desc: 'Vượt giới hạn bộ nhớ' },
  RTE: { label: 'Runtime Error', short: 'RTE', tone: 'rte', desc: 'Chương trình bị crash khi chạy' },
  CE: { label: 'Compile Error', short: 'CE', tone: 'ce', desc: 'Lỗi biên dịch g++' },
  SEC: { label: 'Security Violation', short: 'SEC', tone: 'sec', desc: 'Vi phạm quét bảo mật tĩnh' },
}

export const VERDICT_KEYS = Object.keys(VERDICTS)

export const STATUSES = {
  IN_QUEUE: { label: 'Đang chờ', tone: 'pending' },
  COMPILING: { label: 'Đang biên dịch', tone: 'running' },
  TESTING: { label: 'Đang chấm', tone: 'running' },
  FINISHED: { label: 'Hoàn tất', tone: 'ac' },
}

export const DIFFICULTIES = {
  easy: { label: 'Dễ', tone: 'easy' },
  medium: { label: 'Trung bình', tone: 'medium' },
  hard: { label: 'Khó', tone: 'hard' },
}

export function isFinished(sub) {
  return sub?.status === 'FINISHED'
}

/** Tone màu cho một test case (AC / WA / … / RUNNING / PENDING / SKIPPED). */
export function testTone(status) {
  if (VERDICTS[status]) return VERDICTS[status].tone
  if (status === 'RUNNING') return 'running'
  return 'pending'
}
