// 7 nhãn kết quả cuối cùng + các trạng thái trung gian do Worker gửi qua OP_TASK_STATUS.
export const VERDICTS = {
  AC: { vi: 'Đúng', label: 'Accepted', short: 'AC', tone: 'ac', desc: 'Kết quả chính xác' },
  WA: { vi: 'Sai kết quả', label: 'Wrong Answer', short: 'WA', tone: 'wa', desc: 'Đầu ra không khớp đáp án' },
  TLE: { vi: 'Quá thời gian', label: 'Time Limit Exceeded', short: 'TLE', tone: 'tle', desc: 'Vượt giới hạn thời gian' },
  MLE: { vi: 'Quá bộ nhớ', label: 'Memory Limit Exceeded', short: 'MLE', tone: 'mle', desc: 'Vượt giới hạn bộ nhớ' },
  RTE: { vi: 'Lỗi khi chạy', label: 'Runtime Error', short: 'RTE', tone: 'rte', desc: 'Chương trình bị crash khi chạy' },
  CE: { vi: 'Lỗi biên dịch', label: 'Compile Error', short: 'CE', tone: 'ce', desc: 'Lỗi biên dịch g++' },
  SEC: { vi: 'Vi phạm bảo mật', label: 'Security Violation', short: 'SEC', tone: 'sec', desc: 'Vi phạm quét bảo mật tĩnh' },
}

export const VERDICT_KEYS = Object.keys(VERDICTS)

export const STATUSES = {
  IN_QUEUE: { label: 'Đang chờ chấm', tone: 'pending' },
  COMPILING: { label: 'Đang biên dịch', tone: 'running' },
  TESTING: { label: 'Đang chấm', tone: 'running' },
  FINISHED: { label: 'Hoàn tất', tone: 'ac' },
}

/** Nhãn trạng thái ngắn gọn cho người dùng, ví dụ "Đang chấm 2/4". */
export function statusLabel(sub) {
  const p = sub.progress
  if (sub.status === 'TESTING' && p?.total) return `${STATUSES.TESTING.label} ${p.current}/${p.total}`
  return (STATUSES[sub.status] || STATUSES.IN_QUEUE).label
}

/** Câu giải thích kết quả bằng ngôn ngữ thường, dùng ngay dưới nhãn kết quả. */
export function explainVerdict(sub, problem) {
  const failed = sub.tests?.find((t) => VERDICTS[t.status] && t.status !== 'AC')
  const at = failed ? ` ở test #${failed.index}` : ''
  const total = sub.progress?.total || sub.tests?.length
  switch (sub.verdict) {
    case 'AC':
      return total ? `Chương trình trả lời đúng cả ${total} test.` : 'Chương trình trả lời đúng tất cả test.'
    case 'WA':
      return `Đầu ra không khớp đáp án${at}.`
    case 'TLE':
      return `Chương trình chạy quá ${problem ? `${problem.timeLimitMs / 1000} giây` : 'giới hạn thời gian'}${at}.`
    case 'MLE':
      return `Chương trình dùng quá ${problem ? `${problem.memoryLimitMb} MB` : 'giới hạn'} bộ nhớ${at}.`
    case 'RTE':
      return `Chương trình bị lỗi khi chạy${at} (ví dụ chia cho 0, truy cập ngoài mảng).`
    case 'CE':
      return 'Mã nguồn không biên dịch được. Xem thông báo lỗi bên dưới.'
    case 'SEC':
      return `Bài bị từ chối trước khi biên dịch: ${(sub.securityMessage || 'dùng thư viện hoặc lệnh bị cấm').replace(/`/g, '')}.`
    default:
      return ''
  }
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

const TEST_STATUS_VI = { RUNNING: 'Đang chạy', PENDING: 'Chưa chạy', SKIPPED: 'Bỏ qua (đã dừng sớm)' }

export function testStatusLabel(status) {
  return VERDICTS[status]?.vi || TEST_STATUS_VI[status] || status
}
