// Lớp truy cập dữ liệu. Mặc định gọi API thật; chỉ bật mock khi đặt VITE_USE_MOCK=true.
import { engine } from './mock/engine.js'

export const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'
const API_BASE = import.meta.env.VITE_API_BASE || '/api'
const WS_URL = import.meta.env.VITE_WS_URL || `ws://${window.location.hostname}:8001`
const TOKEN_KEY = 'cj.token'
const USER_KEY = 'cj.user'
const ADMIN_PASSWORD = 'admin123'
const mockAccounts = new Map()
const mockLecturers = [{ id: 'GV001', staffId: 'GV001', fullName: 'Giảng viên mẫu', password: 'gv123456', initialPassword: 'gv123456', createdAt: Date.now() }]

function storageGet(key) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function storageSet(key, value) {
  try {
    if (value == null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    /* bỏ qua khi trình duyệt chặn storage */
  }
}

function getMockAccounts() {
  return Object.fromEntries(mockAccounts)
}

function setMockAccounts(accounts) {
  mockAccounts.clear()
  Object.entries(accounts).forEach(([studentId, password]) => mockAccounts.set(studentId, password))
}

export function getStoredSession() {
  const raw = storageGet(USER_KEY)
  if (!raw) return null
  try {
    return { token: storageGet(TOKEN_KEY), user: JSON.parse(raw) }
  } catch {
    return null
  }
}

export function storeSession(session) {
  storageSet(TOKEN_KEY, session?.token ?? null)
  storageSet(USER_KEY, session ? JSON.stringify(session.user) : null)
}

async function http(method, path, body) {
  const token = storageGet(TOKEN_KEY)
  const res = await fetch(API_BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = res.status === 204 ? null : await res.json().catch(() => null)
  if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`)
  return data
}

const delay = (v, ms = 150) => new Promise((r) => setTimeout(() => r(structuredClone(v)), ms))

function leaderboardFrom(subs, problems) {
  const rows = new Map()
  ;[...subs].reverse().forEach((s) => {
    if (s.status !== 'FINISHED' || s.userId === 'admin') return
    const row = rows.get(s.userId) || {
      userId: s.userId,
      userName: s.userName,
      solved: 0,
      attempts: 0,
      score: 0,
      cells: {},
      lastAcAt: 0,
    }
    const cell = row.cells[s.problemId] || { best: 0, tries: 0, solved: false }
    row.attempts += 1
    if (!cell.solved) {
      cell.tries += 1
      if (s.score > cell.best) {
        row.score += s.score - cell.best
        cell.best = s.score
      }
      if (s.verdict === 'AC') {
        cell.solved = true
        row.solved += 1
        row.lastAcAt = Math.max(row.lastAcAt, s.createdAt)
      }
    }
    row.cells[s.problemId] = cell
    rows.set(s.userId, row)
  })
  const list = [...rows.values()].sort((a, b) => b.solved - a.solved || b.score - a.score || a.attempts - b.attempts)
  return { problems: problems.map((p) => ({ id: p.id, title: p.title })), rows: list.map((r, i) => ({ ...r, rank: i + 1 })) }
}

function problemStats(problems, subs) {
  return problems.map((p) => {
    const ps = subs.filter((s) => s.problemId === p.id && s.status === 'FINISHED')
    const ac = ps.filter((s) => s.verdict === 'AC').length

    const { tests, ...rest } = p
    return { ...rest, testCount: tests.length, totalSubmissions: ps.length, acceptedSubmissions: ac }
  })
}

const LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const PENALTY_PER_WRONG = 20
// Lỗi biên dịch / vi phạm bảo mật không tính phạt (giống ICPC).
const NO_PENALTY = new Set(['CE', 'SEC'])

function contestView(c, user, subs) {
  const status = engine.contestStatus(c)
  const isAdmin = user?.role === 'admin'
  const showProblems = status !== 'UPCOMING' || isAdmin
  const contestSubs = subs.filter((s) => s.contestId === c.id && s.status === 'FINISHED')
  return {
    id: c.id,
    title: c.title,
    description: c.description,
    startAt: c.startAt,
    durationMin: c.durationMin,
    endAt: c.startAt + c.durationMin * 60_000,
    status,
    participantCount: c.participants.length,
    registered: !!user && c.participants.includes(user.id),
    problemIds: isAdmin ? c.problemIds : undefined,
    problems: showProblems
      ? c.problemIds.map((pid, i) => {
          const p = engine.problems().find((x) => x.id === pid)
          const ps = contestSubs.filter((s) => s.problemId === pid)
          return {
            label: LABELS[i],
            problemId: pid,
            title: p?.title ?? '(đã xoá)',
            timeLimitMs: p?.timeLimitMs,
            memoryLimitMb: p?.memoryLimitMb,
            solvedCount: new Set(ps.filter((s) => s.verdict === 'AC').map((s) => s.userId)).size,
            attemptCount: new Set(ps.map((s) => s.userId)).size,
          }
        })
      : [],
  }
}

/** Bảng xếp hạng ICPC: số bài AC giảm dần, rồi tổng phạt (phút) tăng dần. */
function icpcStandings(c, subs) {
  const endAt = c.startAt + c.durationMin * 60_000
  const labels = c.problemIds.map((_, i) => LABELS[i])
  const rows = new Map(c.participants.map((uid) => [uid, { userId: uid, userName: uid, solved: 0, penalty: 0, cells: {} }]))
  const firstSolve = {}
  ;[...subs]
    .filter((s) => s.contestId === c.id && s.createdAt <= endAt)
    .sort((a, b) => a.createdAt - b.createdAt)
    .forEach((s) => {
      const row = rows.get(s.userId)
      if (!row) return
      row.userName = s.userName
      const label = labels[c.problemIds.indexOf(s.problemId)]
      const cell = (row.cells[label] ??= { solved: false, wrong: 0, pending: 0, minute: null })
      if (cell.solved) return
      if (s.status !== 'FINISHED') cell.pending += 1
      else if (s.verdict === 'AC') {
        cell.solved = true
        cell.minute = Math.floor((s.createdAt - c.startAt) / 60_000)
        row.solved += 1
        row.penalty += cell.minute + cell.wrong * PENALTY_PER_WRONG
        if (!firstSolve[label] || s.createdAt < firstSolve[label].at) firstSolve[label] = { at: s.createdAt, userId: s.userId }
      } else if (!NO_PENALTY.has(s.verdict)) cell.wrong += 1
    })
  Object.entries(firstSolve).forEach(([label, f]) => (rows.get(f.userId).cells[label].first = true))
  const list = [...rows.values()].sort((a, b) => b.solved - a.solved || a.penalty - b.penalty)
  let rank = 0
  return {
    labels,
    penaltyPerWrong: PENALTY_PER_WRONG,
    rows: list.map((r, i) => {
      if (i === 0 || r.solved !== list[i - 1].solved || r.penalty !== list[i - 1].penalty) rank = i + 1
      return { ...r, rank }
    }),
  }
}

function findContest(id) {
  const c = engine.contests().find((x) => x.id === Number(id))
  if (!c) throw new Error('Không tìm thấy kỳ thi')
  return c
}

const savedSession = getStoredSession()
if (savedSession?.user) {
  engine.registerStudent(savedSession.user)
}

const DEFAULT_COURSES = [
  { id: 1, title: 'Lập trình C++ Cơ bản (C++ Fundamentals)', description: 'Lộ trình nhập môn toàn diện: cú pháp, biến, điều kiện, vòng lặp, hàm và mảng.', published: true, unitCount: 7, createdAt: Date.now() - 86400000 * 5 },
  { id: 2, title: 'Cấu trúc Dữ liệu & Giải thuật C++ (DSA)', description: 'Thư viện STL nâng cao (Vector, Map, Set), ngăn xếp, hàng đợi, đệ quy và quy hoạch động.', published: true, unitCount: 6, createdAt: Date.now() - 86400000 * 3 },
  { id: 3, title: 'Lập trình Hướng đối tượng C++ (OOP)', description: 'Nắm vững 4 tính chất OOP: Đóng gói, Kế thừa, Đa hình và Trừu tượng hóa.', published: true, unitCount: 5, createdAt: Date.now() - 86400000 * 1 },
  { id: 4, title: 'Kỹ thuật Lập trình C++ Nâng cao (Bản nháp)', description: 'Quản lý con trỏ thông minh (Smart Pointers), Move Semantics và Concurrency đa luồng.', published: false, unitCount: 2, createdAt: Date.now() },
]

function getStoredCourses() {
  try {
    const raw = localStorage.getItem('cj.courses')
    if (raw) return JSON.parse(raw)
  } catch {
    /* ignore */
  }
  return DEFAULT_COURSES
}

function setStoredCourses(list) {
  try {
    localStorage.setItem('cj.courses', JSON.stringify(list))
  } catch {
    /* ignore */
  }
}

const mockApi = {
  async changePassword(payload) {
    const session = getStoredSession()
    const userId = session?.user?.id
    const accounts = getMockAccounts()
    if (!userId || session.user.role === 'admin') throw new Error('Tài khoản này không dùng chức năng đổi mật khẩu')
    let currentPassword = accounts[userId]
    let lecturer = mockLecturers.find((item) => item.staffId.toUpperCase() === String(userId).toUpperCase())
    if (session.user.role === 'lecturer') currentPassword = lecturer?.password || 'gv123456'
    if (currentPassword !== payload.currentPassword) throw new Error('Mật khẩu hiện tại không chính xác')
    if (!payload.newPassword || payload.newPassword.length < 8) throw new Error('Mật khẩu cần ít nhất 8 ký tự')
    if (session.user.role === 'lecturer') {
      if (lecturer) {
        lecturer.password = payload.newPassword
        lecturer.initialPassword = null
      }
    } else {
      accounts[userId] = payload.newPassword
      setMockAccounts(accounts)
    }
    return delay({ success: true })
  },
  async login(payload) {
    const username = payload.username?.trim()
    if (!username || !payload.password) throw new Error('Vui lòng nhập tài khoản và mật khẩu')
    if (username.toLowerCase() === 'admin') {
      if (payload.password !== ADMIN_PASSWORD) throw new Error('Sai mật khẩu quản trị')
      return delay({ token: 'mock-admin-token', user: { id: 'admin', name: 'Quản trị viên', role: 'admin' } })
    }
    // Seed/mock lecturer accounts use the default password until changed.
    if (/^GV\d{3}$/i.test(username)) {
      const gvId = username.toUpperCase()
      const lecturer = mockLecturers.find((item) => item.staffId === gvId)
      if (payload.password !== (lecturer?.password || 'gv123456')) throw new Error('Tài khoản hoặc mật khẩu không chính xác')
      return delay({ token: `mock-${gvId}`, user: { id: gvId, name: `Giảng viên ${gvId}`, role: 'lecturer' } })
    }
    if (!/^[A-Z]\d{2}[A-Z]{4}\d{3}$/i.test(username)) throw new Error('Tài khoản hoặc mật khẩu không chính xác')
    const studentId = username.toUpperCase()
    const accounts = getMockAccounts()
    if (accounts[studentId] !== payload.password) throw new Error('Tài khoản hoặc mật khẩu không chính xác')
    const user = { id: studentId, name: studentId, role: 'student' }
    engine.registerStudent(user)
    return delay({
      token: `mock-${studentId}`,
      user,
    })
  },
  logout: () => delay(null),
  onlineCount: () => delay({ count: engine.submissions().length % 5 }),
  listProblems: () => delay(problemStats(engine.problems(), engine.submissions())),
  searchProblems: ({ q = '', difficulty = '', page = 1, size = 20 } = {}) => {
    const all = problemStats(engine.problems(), engine.submissions())
    const filtered = all.filter(
      (p) =>
        (!q || `#${p.id} ${p.title}`.toLowerCase().includes(q.toLowerCase())) &&
        (!difficulty || p.difficulty === difficulty),
    )
    const start = (page - 1) * size
    return delay({ total: filtered.length, problems: filtered.slice(start, start + size) })
  },
  getProblem: (id) => {
    const p = engine.problems().find((x) => x.id === Number(id))
    return p ? delay(p) : Promise.reject(new Error('Không tìm thấy đề bài'))
  },
  languages: () => delay([{ code: 'cpp17', label: 'C++17' }]),
  submit: (payload, user) => delay(engine.submit({ ...payload, user }), 120),
  runTest: (payload) =>
    delay({
      verdict: 'AC',
      output: payload.input ? `[Mô phỏng đầu ra cho dữ liệu: ${payload.input.trim()}]` : 'Output',
      stderr: '',
      expectedOutput: payload.expectedOutput || '',
      timeMs: 42,
      memoryKb: 2048,
      compileLog: null,
      securityMessage: null,
    }, 300),
  listSubmissions: ({ userId, problemId, verdict, contestId, page, size = 50 } = {}) => {
    const all = engine
      .submissions()
      .filter((s) => (!userId || s.userId === userId) && (!problemId || s.problemId === Number(problemId)))
      .filter((s) => !contestId || s.contestId === Number(contestId))
      .filter((s) => !verdict || s.verdict === verdict)
      // eslint-disable-next-line no-unused-vars
      .map(({ sourceCode, tests, history, ...rest }) => rest)
    if (page != null) {
      const start = page * size
      return delay({ total: all.length, submissions: all.slice(start, start + size) })
    }
    return delay(all)
  },
  getSubmission: (id) => {
    const s = engine.submission(id)
    return s ? delay(s) : Promise.reject(new Error('Không tìm thấy bài nộp'))
  },
  leaderboard: () => delay(leaderboardFrom(engine.submissions(), engine.problems())),
  // ---- Kỳ thi ----
  listContests: (user) => {
    const subs = engine.submissions()
    return delay(engine.contests().map((c) => contestView(c, user, subs)))
  },
  getContest: async (id, user) => delay(contestView(findContest(id), user, engine.submissions())),
  registerContest: async (id, user) => delay(contestView(engine.registerContest(id, user), user, engine.submissions())),
  unregisterContest: async () => delay(null),
  contestStandings: async (id) => delay(icpcStandings(findContest(id), engine.submissions())),
  saveContest: (data) => delay(engine.saveContest(data)),
  deleteContest: (id) => delay(engine.deleteContest(id)),
  teacherListProblems: () => delay(problemStats(engine.problems(), engine.submissions())),
  teacherGetProblem: (id) => mockApi.getProblem(id),
  teacherSaveProblem: (data) => delay(engine.saveProblem({ ...data, publicVisible: false })),
  teacherDeleteProblem: (id) => delay(engine.deleteProblem(id)),
  teacherListContests: (user) => mockApi.listContests(user),
  teacherAvailableContests: () => delay(engine.contests()),
  teacherContestProblems: () => delay(problemStats(engine.problems(), engine.submissions())),
  teacherSaveContest: (data) => delay(engine.saveContest(data)),
  teacherDeleteContest: (id) => delay(engine.deleteContest(id)),
  listLecturers: () => delay(mockLecturers.map((l) => ({ id: l.id, staffId: l.staffId, fullName: l.fullName, initialPassword: l.initialPassword, classroomCount: l.classroomCount || (l.classrooms || []).length, classrooms: l.classrooms || [], createdAt: l.createdAt }))),
  createLecturer: (data) => {
    const lecturer = { id: Date.now(), ...data, staffId: data.staffId.toUpperCase(), initialPassword: data.password, createdAt: Date.now() }
    mockLecturers.push(lecturer)
    return delay({ ...lecturer, password: undefined })
  },
  deleteLecturers: (ids) => {
    let deleted = 0
    for (let index = mockLecturers.length - 1; index >= 0; index--) {
      if (ids.includes(mockLecturers[index].id)) {
        mockLecturers.splice(index, 1)
        deleted++
      }
    }
    return delay({ deleted })
  },
  resetLecturerPassword: (id, password) => {
    const lecturer = mockLecturers.find((item) => item.id === id)
    if (!lecturer) return Promise.reject(new Error('Không tìm thấy tài khoản giảng viên'))
    if (!password || password.length < 8) return Promise.reject(new Error('Mật khẩu phải có ít nhất 8 ký tự'))
    lecturer.password = password
    lecturer.initialPassword = password
    return delay({ message: 'Đã đặt lại mật khẩu thành công' })
  },
  importLecturers: async (file) => {
    const lines = (await file.text()).replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean)
    if (lines.length < 1) throw new Error('File CSV không có dữ liệu')
    const normalize = (value) => value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
    const headers = lines[0].split(',').map(normalize)
    const staffIndex = headers.findIndex((header) => ['staffid', 'magv', 'magiangvien', 'manhanvien', 'username'].includes(header))
    const nameIndex = headers.findIndex((header) => ['fullname', 'hoten', 'tengiangvien'].includes(header))
    const passwordIndex = headers.findIndex((header) => ['password', 'matkhau'].includes(header))
    if ([staffIndex, nameIndex, passwordIndex].some((index) => index < 0)) {
      throw new Error('CSV phải có ba cột: MaGiangVien,HoTen,MatKhau')
    }
    let imported = 0
    let skippedInvalid = 0
    let skippedExisting = 0
    for (const line of lines.slice(1)) {
      const columns = line.split(',')
      const staffId = (columns[staffIndex] || '').trim().toUpperCase()
      const fullName = (columns[nameIndex] || '').trim()
      const password = columns[passwordIndex] || ''
      if (!/^[A-Z0-9._-]{3,32}$/.test(staffId) || !fullName || fullName.length > 100 || password.length < 8) {
        skippedInvalid++
      } else if (mockLecturers.some((lecturer) => lecturer.staffId.toUpperCase() === staffId)) {
        skippedExisting++
      } else {
        mockLecturers.push({ id: Date.now() + imported, staffId, fullName, password, initialPassword: password, createdAt: Date.now() })
        imported++
      }
    }
    return delay({ imported, skippedInvalid, skippedExisting })
  },
  reportViolation: () => delay({ success: true, violationCount: 1 }),
  getProctorStatus: (id) => delay({ contestId: id, participants: [], recentViolations: [] }),
  runPlagiarismCheck: (id) => delay({ hasReport: true, status: 'RUNNING', contestId: id, submissionCount: 0, suspiciousCount: 0, highRiskCount: 0, totalMatches: 0, matches: [] }, 300),
  getPlagiarismStatus: (id) => delay({ hasReport: true, status: 'COMPLETED', contestId: id, submissionCount: 2, suspiciousCount: 0, highRiskCount: 1, totalMatches: 1, matches: [] }),
  compareSubmissions: () => delay({ similarityScore: 95.0, verdictLevel: 'HIGH_RISK', submissionA: { id: 1, username: 'A', sourceCode: '// code A' }, submissionB: { id: 2, username: 'B', sourceCode: '// code B' } }),
  // ---- Lớp học (mock stub) ----
  listClassrooms: () => delay([]),
  getClassroom: (id) => delay({ id, name: 'Lớp mẫu', semester: '2024-2025', contests: [] }),
  createClassroom: (data) => delay({ id: Date.now(), ...data, createdAt: Date.now() }),
  updateClassroom: (_id, data) => delay(data),
  deleteClassroom: () => delay(null),
  listClassroomStudents: () => delay([]),
  addClassroomStudent: (_id, data) => delay({
    userId: Date.now(),
    username: (data.studentId || data.username || '').toUpperCase(),
    fullName: data.fullName || data.studentId || data.username,
    joinedAt: Date.now()
  }),
  importClassroomStudents: async (_id, file) => {
    const text = await file.text()
    const [header, ...rows] = text.replace(/^\uFEFF/, '').split(/\r?\n/)
    const columns = header.toLowerCase().split(',').map((v) => v.trim())
    const studentIdIndex = columns.findIndex((v) => ['mssv', 'studentid', 'masinhvien'].includes(v))
    const passwordIndex = columns.findIndex((v) => ['password', 'matkhau'].includes(v))
    if (studentIdIndex < 0 || passwordIndex < 0) throw new Error('CSV phải có hai cột: mssv,password')
    const accounts = getMockAccounts()
    let imported = 0
    let created = 0
    let skippedInvalid = 0
    let skippedExisting = 0
    rows.filter(Boolean).forEach((row) => {
      const values = row.split(',')
      const studentId = values[studentIdIndex]?.trim().toUpperCase()
      const password = values[passwordIndex] || ''
      if (!/^[A-Z]\d{2}[A-Z]{4}\d{3}$/.test(studentId || '') || password.length < 8) {
        skippedInvalid += 1
      } else if (accounts[studentId]) {
        skippedExisting += 1
      } else {
        accounts[studentId] = password
        imported += 1
        created += 1
      }
    })
    setMockAccounts(accounts)
    return delay({ imported, created, alreadyEnrolled: 0, skippedInOtherClass: 0, skippedInvalid, skippedExisting })
  },
  removeClassroomStudent: () => delay(null),
  resetClassroomStudentPassword: () => delay({ message: 'Đã đặt lại mật khẩu thành công' }),
  resetStudentPassword: () => delay({ message: 'Đã đặt lại mật khẩu thành công' }),
  listClassroomContests: () => delay([]),
  assignClassroomContest: (_id, contestId) => delay({ contestId, title: '(mock)' }),
  unassignClassroomContest: () => delay(null),
  // ---- Classroom course ----
  getClassroomCourse: (classroomId) => {
    const key = `cj.classroom_course.${classroomId}`
    const raw = localStorage.getItem(key)
    if (!raw) return Promise.reject(new Error('Chưa gán khóa học'))
    try {
      const saved = JSON.parse(raw)
      return mockApi.getCourse(saved.courseId).then((course) => ({ ...course, courseId: course.id }))
    } catch {
      return Promise.reject(new Error('Chưa gán khóa học'))
    }
  },
  assignClassroomCourse: (classroomId, courseId) => {
    localStorage.setItem(`cj.classroom_course.${classroomId}`, JSON.stringify({ courseId }))
    return delay({ classroomId, courseId })
  },
  unassignClassroomCourse: (classroomId) => {
    localStorage.removeItem(`cj.classroom_course.${classroomId}`)
    return delay(null)
  },
  uploadUnitFile: (_unitId, file) => delay({ id: Date.now(), filename: file.name, fileSize: file.size }),
  deleteUnitFile: () => delay(null),
  // ---- Admin ----
  adminOverview: () =>
    delay({ workers: engine.workers(), queue: engine.queue(), logs: engine.logs(), submissions: engine.submissions().length, throughput: [] }),
  adminLogs: (level) =>
    delay((engine.logs()).filter((l) => !level || l.level === level)),
  saveProblem: (data) => delay(engine.saveProblem(data)),
  toggleProblemVisibility: (id, visible) => delay({ publicVisible: visible }),
  deleteProblem: (id) => delay(engine.deleteProblem(id)),
  uploadProblemTestCasesZip: (problemId, file) =>
    delay({
      success: true,
      message: `Đã nạp thành công bộ test từ file ${file.name}`,
      importedCount: 5,
      totalTestCount: 5,
      testKeys: ['1', '2', '3', '4', '5'],
      unpairedInputs: [],
      unpairedOutputs: [],
    }),
  parseProblemTestCasesZip: (file) =>
    delay({
      success: true,
      message: `Giải nén thành công từ ${file.name}`,
      count: 3,
      tests: [
        { key: '1', input: '1 2\n', output: '3\n' },
        { key: '2', input: '5 7\n', output: '12\n' },
        { key: '3', input: '100 200\n', output: '300\n' },
      ],
      unpairedInputs: [],
      unpairedOutputs: [],
    }),
  killWorker: (id) => delay(engine.killWorker(id), 50),
  reviveWorker: (id) => delay(engine.reviveWorker(id), 50),
  removeDisconnectedWorkers: () => delay(engine.removeDisconnectedWorkers(), 50),
  // ---- Khóa học (Curriculum mock) ----
  listCourses: () => {
    const list = getStoredCourses()
    return delay(list)
  },
  getCourse: (id) => {
    const numId = Number(id)
    const list = getStoredCourses()
    const found = list.find((x) => x.id === numId)
    const unitsMap = {
      1: [
        { id: 101, courseId: 1, title: 'Chủ đề 1: Cấu trúc chương trình C++ và Nhập xuất (cin / cout)', orderIndex: 1, createdAt: Date.now() },
        { id: 102, courseId: 1, title: 'Chủ đề 2: Biến, Kiểu dữ liệu nguyên thủy và Ép kiểu', orderIndex: 2, createdAt: Date.now() },
        { id: 103, courseId: 1, title: 'Chủ đề 3: Các phép toán số học, logic và bitwise', orderIndex: 3, createdAt: Date.now() },
        { id: 104, courseId: 1, title: 'Chủ đề 4: Cấu trúc rẽ nhánh if - else và switch - case', orderIndex: 4, createdAt: Date.now() },
        { id: 105, courseId: 1, title: 'Chủ đề 5: Vòng lặp for, while, do-while và lệnh break / continue', orderIndex: 5, createdAt: Date.now() },
        { id: 106, courseId: 1, title: 'Chủ đề 6: Hàm, truyền tham trị và truyền tham chiếu (&)', orderIndex: 6, createdAt: Date.now() },
        { id: 107, courseId: 1, title: 'Chủ đề 7: Mảng 1 chiều và chuỗi ký tự cơ bản (std::string)', orderIndex: 7, createdAt: Date.now() }
      ],
      2: [
        { id: 201, courseId: 2, title: 'Chủ đề 1: Thư viện chuẩn STL: std::vector và std::pair', orderIndex: 1, createdAt: Date.now() },
        { id: 202, courseId: 2, title: 'Chủ đề 2: Ngăn xếp (Stack) và Hàng đợi (Queue, Priority Queue)', orderIndex: 2, createdAt: Date.now() },
        { id: 203, courseId: 2, title: 'Chủ đề 3: Tập hợp (std::set) và Bảng ánh xạ (std::map, unordered_map)', orderIndex: 3, createdAt: Date.now() },
        { id: 204, courseId: 2, title: 'Chủ đề 4: Kỹ thuật đệ quy và Quay lui (Backtracking)', orderIndex: 4, createdAt: Date.now() },
        { id: 205, courseId: 2, title: 'Chủ đề 5: Thuật toán sắp xếp và Tìm kiếm nhị phân (Binary Search)', orderIndex: 5, createdAt: Date.now() },
        { id: 206, courseId: 2, title: 'Chủ đề 6: Quy hoạch động 1 chiều (1D Dynamic Programming)', orderIndex: 6, createdAt: Date.now() }
      ],
      3: [
        { id: 301, courseId: 3, title: 'Chủ đề 1: Lớp (Class), Đối tượng (Object) và Phạm vi truy cập', orderIndex: 1, createdAt: Date.now() },
        { id: 302, courseId: 3, title: 'Chủ đề 2: Hàm khởi tạo (Constructor) và Hàm hủy (Destructor)', orderIndex: 2, createdAt: Date.now() },
        { id: 303, courseId: 3, title: 'Chủ đề 3: Tính đóng gói (Encapsulation) và Tính kế thừa (Inheritance)', orderIndex: 3, createdAt: Date.now() },
        { id: 304, courseId: 3, title: 'Chủ đề 4: Tính đa hình (Polymorphism) và Hàm ảo (Virtual Functions)', orderIndex: 4, createdAt: Date.now() },
        { id: 305, courseId: 3, title: 'Chủ đề 5: Nạp chồng toán tử (Operator Overloading)', orderIndex: 5, createdAt: Date.now() }
      ],
      4: [
        { id: 401, courseId: 4, title: 'Chủ đề 1: Con trỏ thô (Raw Pointers) và Vùng nhớ Heap', orderIndex: 1, createdAt: Date.now() },
        { id: 402, courseId: 4, title: 'Chủ đề 2: Smart Pointers (unique_ptr, shared_ptr, weak_ptr)', orderIndex: 2, createdAt: Date.now() }
      ]
    }
    return delay({
      id: numId,
      title: found?.title || `Khóa học #${numId}`,
      description: found?.description || '',
      published: found ? Boolean(found.published) : false,
      createdAt: found?.createdAt || Date.now() - 86400000 * 3,
      units: unitsMap[numId] || []
    })
  },
  createCourse: (data) => {
    const list = getStoredCourses()
    const item = {
      id: Date.now(),
      ...data,
      published: data.published || false,
      createdAt: Date.now(),
      unitCount: 0,
    }
    list.unshift(item)
    setStoredCourses(list)
    return delay(item)
  },
  updateCourse: (id, data) => {
    const numId = Number(id)
    const list = getStoredCourses()
    const idx = list.findIndex((x) => x.id === numId)
    if (idx !== -1) {
      list[idx] = { ...list[idx], ...data }
      setStoredCourses(list)
      return delay(list[idx])
    }
    return delay({ id: numId, ...data })
  },
  deleteCourse: (id) => {
    const numId = Number(id)
    const list = getStoredCourses().filter((x) => x.id !== numId)
    setStoredCourses(list)
    return delay(true)
  },
  addCourseUnit: (id, data) => delay({ id: Date.now(), courseId: Number(id), ...data, createdAt: Date.now() }),
  updateCourseUnit: (id, uid, data) => delay({ id: Number(uid), courseId: Number(id), ...data, createdAt: Date.now() }),
  deleteCourseUnit: () => delay(true),
  reorderCourseUnits: (id, items) => delay(items),
  getLesson: (unitId) => {
    const raw = localStorage.getItem(`cj.lesson.${unitId}`)
    if (raw) {
      try { return delay(JSON.parse(raw)) } catch { /* ignore */ }
    }
    return delay({
      id: Number(unitId),
      unitId: Number(unitId),
      theoryContent: `### 1. Giới thiệu chủ đề\nĐây là bài giảng lý thuyết chi tiết cho chủ đề này.\n\n### 2. Kiến thức trọng tâm\n- Nắm vững cú pháp C++ cơ bản và giải thuật tương ứng.\n- Rèn luyện kỹ năng phân tích độ phức tạp thời gian và không gian bộ nhớ.\n\n> [!TIP]\n> Bạn có thể bấm nút **"Chạy thử ngay (Try it)"** để thực hành trực tiếp với mã nguồn mẫu!`,
      sampleCode: `#include <iostream>\nusing namespace std;\n\nint main() {\n    cout << "Xin chào từ CodeJudge LMS!" << endl;\n    return 0;\n}`,
      sampleInput: '',
      updatedAt: Date.now(),
    })
  },
  updateLesson: (unitId, data) => {
    const updated = {
      id: Number(unitId),
      unitId: Number(unitId),
      theoryContent: data.theoryContent || '',
      sampleCode: data.sampleCode || '',
      sampleInput: data.sampleInput || '',
      updatedAt: Date.now(),
    }
    try {
      localStorage.setItem(`cj.lesson.${unitId}`, JSON.stringify(updated))
    } catch {
      /* ignore */
    }
    return delay(updated)
  },
  getUnitProblems: (unitId) => {
    const raw = localStorage.getItem(`cj.unit_problems.${unitId}`)
    if (raw) {
      try { return delay(JSON.parse(raw)) } catch { /* ignore */ }
    }
    const def = [
      { id: 1, unitId: Number(unitId), problemId: 1, title: 'A + B Problem', difficulty: 'easy', orderIndex: 1, solved: false }
    ]
    return delay(def)
  },
  assignUnitProblem: (unitId, problemId) => {
    const raw = localStorage.getItem(`cj.unit_problems.${unitId}`)
    const list = raw ? JSON.parse(raw) : [
      { id: 1, unitId: Number(unitId), problemId: 1, title: 'A + B Problem', difficulty: 'easy', orderIndex: 1, solved: false }
    ]
    const p = engine.problems().find((x) => x.id === Number(problemId))
    const item = {
      id: Date.now(),
      unitId: Number(unitId),
      problemId: Number(problemId),
      title: p?.title || `Bài tập #${problemId}`,
      difficulty: p?.difficulty || 'easy',
      orderIndex: list.length + 1,
      solved: false,
    }
    list.push(item)
    try { localStorage.setItem(`cj.unit_problems.${unitId}`, JSON.stringify(list)) } catch { /* ignore */ }
    return delay(item)
  },
  removeUnitProblem: (unitId, problemId) => {
    const raw = localStorage.getItem(`cj.unit_problems.${unitId}`)
    if (raw) {
      try {
        const list = JSON.parse(raw).filter((x) => x.problemId !== Number(problemId))
        localStorage.setItem(`cj.unit_problems.${unitId}`, JSON.stringify(list))
      } catch {
        /* ignore */
      }
    }
    return delay(true)
  },
  getCourseProgress: (courseId) => {
    let completedList = []
    try {
      const raw = localStorage.getItem('cj.user_completed_units')
      if (raw) completedList = JSON.parse(raw)
    } catch {
      /* ignore */
    }
    return delay({
      courseId: Number(courseId),
      completedUnitIds: completedList.map(Number),
      completedCount: completedList.length,
      totalUnits: 7,
      percent: Math.min(100, Math.round((completedList.length / 7) * 100)),
    })
  },
  toggleUnitProgress: (unitId) => {
    let completedList = []
    try {
      const raw = localStorage.getItem('cj.user_completed_units')
      if (raw) completedList = JSON.parse(raw)
    } catch {
      /* ignore */
    }
    const id = Number(unitId)
    const exists = completedList.includes(id)
    if (exists) {
      completedList = completedList.filter((x) => x !== id)
    } else {
      completedList.push(id)
    }
    try {
      localStorage.setItem('cj.user_completed_units', JSON.stringify(completedList))
    } catch {
      /* ignore */
    }
    return delay({ unitId: id, completed: !exists })
  },
}

const realApi = {
  login: (payload) => http('POST', '/auth/login', payload),
  logout: () => http('DELETE', '/auth/logout'),
  changePassword: (payload) => http('POST', '/auth/change-password', payload),
  onlineCount: () => http('GET', '/stats/online'),
  listProblems: () => http('GET', '/problems'),
  searchProblems: ({ q = '', difficulty = '', page = 1, size = 20 } = {}) => {
    const params = new URLSearchParams({ page, size })
    if (q) params.set('q', q)
    if (difficulty) params.set('difficulty', difficulty)
    return http('GET', `/problems?${params}`)
  },
  getProblem: (id) => http('GET', `/problems/${id}`),
  languages: () => http('GET', '/submissions/languages'),
  submit: (payload) => http('POST', '/submissions', payload),
  runTest: (payload) => http('POST', '/submissions/run', payload),
  listSubmissions: (q = {}) => {
    const params = new URLSearchParams(
      Object.entries(q).filter(([k, v]) => v != null && v !== '' && (k === 'page' ? true : v))
    )
    return http('GET', `/submissions?${params}`)
  },
  getSubmission: (id) => http('GET', `/submissions/${id}`),
  leaderboardClassrooms: () => http('GET', '/leaderboard/classrooms'),
  leaderboardStudents: ({ classroomId }) => http('GET', `/leaderboard/students${classroomId == null ? '' : `?classroomId=${classroomId}`}`),
  leaderboardProblems: ({ classroomId }) => http('GET', `/leaderboard/problems${classroomId == null ? '' : `?classroomId=${classroomId}`}`),
  leaderboardProblemDetails: (problemId, { classroomId }) => http('GET', `/leaderboard/problems/${problemId}/details${classroomId == null ? '' : `?classroomId=${classroomId}`}`),
  listClassroomLecturers: (id) => http('GET', `/admin/lecturers/classrooms/${id}`),
  assignClassroomLecturer: (classroomId, lecturerId) => http('POST', `/admin/lecturers/classrooms/${classroomId}/${lecturerId}`),
  unassignClassroomLecturer: (classroomId, lecturerId) => http('DELETE', `/admin/lecturers/classrooms/${classroomId}/${lecturerId}`),
  listContests: () => http('GET', '/contests'),
  getContest: (id) => http('GET', `/contests/${id}`),
  registerContest: (id) => http('POST', `/contests/${id}/register`),
  unregisterContest: (id) => http('DELETE', `/contests/${id}/register`),
  contestStandings: (id) => http('GET', `/contests/${id}/standings`),
  reportViolation: (id, data) => http('POST', `/contests/${id}/proctor/violation`, data),
  getProctorStatus: (id) => http('GET', `/contests/${id}/proctor/status`),
  runPlagiarismCheck: (id) => http('POST', `/contests/${id}/plagiarism/run`),
  getPlagiarismStatus: (id) => http('GET', `/contests/${id}/plagiarism/status`),
  compareSubmissions: (id, subA, subB) => http('GET', `/contests/${id}/plagiarism/compare?subA=${subA}&subB=${subB}`),
  saveContest: (data) => (data.id ? http('PUT', `/admin/contests/${data.id}`, data) : http('POST', '/admin/contests', data)),
  deleteContest: (id) => http('DELETE', `/admin/contests/${id}`),
  teacherListProblems: () => http('GET', '/teacher/problems'),
  teacherGetProblem: (id) => http('GET', `/teacher/problems/${id}`),
  teacherSaveProblem: (data) => data.id
    ? http('PUT', `/teacher/problems/${data.id}`, data)
    : http('POST', '/teacher/problems', data),
  teacherDeleteProblem: (id) => http('DELETE', `/teacher/problems/${id}`),
  teacherListContests: () => http('GET', '/teacher/contests'),
  teacherAvailableContests: () => http('GET', '/teacher/library/contests'),
  teacherContestProblems: () => http('GET', '/teacher/contests/problems'),
  teacherSaveContest: (data) => data.id
    ? http('PUT', `/teacher/contests/${data.id}`, data)
    : http('POST', '/teacher/contests', data),
  teacherDeleteContest: (id) => http('DELETE', `/teacher/contests/${id}`),
  listLecturers: () => http('GET', '/admin/lecturers'),
  createLecturer: (data) => http('POST', '/admin/lecturers', data),
  deleteLecturers: (ids) => http('DELETE', '/admin/lecturers', { ids }),
  resetLecturerPassword: (id, password) => http('POST', `/admin/lecturers/${id}/reset-password`, { password }),
  importLecturers: (file) => {
    const token = storageGet(TOKEN_KEY)
    const form = new FormData()
    form.append('file', file)
    return fetch(`${API_BASE}/admin/lecturers/import`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    }).then(async (res) => {
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`)
      return data
    })
  },
  adminOverview: () => http('GET', '/admin/overview'),
  saveProblem: (data) => (data.id ? http('PUT', `/admin/problems/${data.id}`, data) : http('POST', '/admin/problems', data)),
  toggleProblemVisibility: (id, visible) => http('PATCH', `/admin/problems/${id}/visibility`, { publicVisible: visible }),
  deleteProblem: (id) => http('DELETE', `/admin/problems/${id}`),
  uploadProblemTestCasesZip: (problemId, file, keepSamples = true) => {
    const token = storageGet(TOKEN_KEY)
    const form = new FormData()
    form.append('file', file)
    return fetch(`${API_BASE}/admin/problems/${problemId}/testcases/zip?keepSamples=${keepSamples}`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    }).then(async (res) => {
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`)
      return data
    })
  },
  parseProblemTestCasesZip: (file) => {
    const token = storageGet(TOKEN_KEY)
    const form = new FormData()
    form.append('file', file)
    return fetch(`${API_BASE}/admin/problems/parse-zip`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    }).then(async (res) => {
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`)
      return data
    })
  },
  killWorker: (id) => http('POST', `/admin/workers/${id}/disconnect`),
  reviveWorker: () => Promise.reject(new Error('Hãy khởi động lại tiến trình judge_worker.py')),
  removeDisconnectedWorkers: () => http('DELETE', '/admin/workers/disconnected'),
  adminLogs: (level) => http('GET', level ? `/admin/logs?level=${level}` : '/admin/logs'),
  // ---- Lớp học ----
  listClassrooms: () => http('GET', '/classrooms'),
  getClassroom: (id) => http('GET', `/classrooms/${id}`),
  createClassroom: (data) => http('POST', '/classrooms', data),
  updateClassroom: (id, data) => http('PUT', `/classrooms/${id}`, data),
  deleteClassroom: (id) => http('DELETE', `/classrooms/${id}`),
  listClassroomStudents: (id) => http('GET', `/classrooms/${id}/students`),
  addClassroomStudent: async (id, payload) => {
    try {
      return await http('POST', `/classrooms/${id}/students`, payload)
    } catch (err) {
      // Fallback nếu backend đang chạy phiên bản cũ chưa restart (lỗi 405 Method Not Allowed hoặc 404)
      const isMethodNotAllowed = err.message && (err.message.includes('405') || err.message.includes('POST') || err.message.includes('404'))
      if (isMethodNotAllowed) {
        let csvLines = 'MSSV, Họ tên\n'
        if (Array.isArray(payload.students) && payload.students.length > 0) {
          payload.students.forEach((s) => {
            const sid = (s.studentId || s.username || '').trim().toUpperCase()
            const name = (s.fullName || sid).trim()
            if (sid) csvLines += `${sid}, ${name}\n`
          })
        } else {
          const sid = (payload.studentId || payload.username || '').trim().toUpperCase()
          const name = (payload.fullName || sid).trim()
          csvLines += `${sid}, ${name}\n`
        }

        const blob = new Blob([csvLines], { type: 'text/csv;charset=utf-8;' })
        const file = new File([blob], 'student.csv', { type: 'text/csv' })
        const res = await api.importClassroomStudents(id, file)

        if (res.imported > 0) {
          return { success: true, ...res }
        }
        if (res.alreadyEnrolled > 0) {
          throw new Error('Sinh viên này đã có trong lớp rồi', { cause: err })
        }
        if (res.skippedInOtherClass > 0) {
          throw new Error('Sinh viên này hiện đã thuộc lớp khác (mỗi sinh viên chỉ được ở 1 lớp)', { cause: err })
        }
        if (res.skippedInvalid > 0) {
          throw new Error('Mã sinh viên không đúng định dạng (VD: B20DCCN001)', { cause: err })
        }
        throw new Error('Không thể thêm sinh viên vào lớp', { cause: err })
      }
      throw err
    }
  },
  importClassroomStudents: (id, file) => {
    const token = storageGet(TOKEN_KEY)
    const form = new FormData()
    form.append('file', file)
    return fetch(`${API_BASE}/classrooms/${id}/students/import`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    }).then(async (res) => {
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`)
      return data
    })
  },
  removeClassroomStudent: (classroomId, userId) => http('DELETE', `/classrooms/${classroomId}/students/${userId}`),
  resetClassroomStudentPassword: (classroomId, userId, password) => http('POST', `/classrooms/${classroomId}/students/${userId}/reset-password`, { password }),
  resetStudentPassword: (userId, password) => http('POST', `/admin/students/${userId}/reset-password`, { password }),
  listClassroomContests: (id) => http('GET', `/classrooms/${id}/contests`),
  assignClassroomContest: (id, contestId) => http('POST', `/classrooms/${id}/contests`, { contestId }),
  unassignClassroomContest: (classroomId, contestId) => http('DELETE', `/classrooms/${classroomId}/contests/${contestId}`),
  // ---- Classroom course ----
  getClassroomCourse: (classroomId) => http('GET', `/classrooms/${classroomId}/course`),
  assignClassroomCourse: (classroomId, courseId) => http('PUT', `/classrooms/${classroomId}/course/${courseId}`),
  unassignClassroomCourse: (classroomId) => http('DELETE', `/classrooms/${classroomId}/course`),
  uploadUnitFile: (unitId, file) => {
    const token = storageGet(TOKEN_KEY)
    const form = new FormData()
    form.append('file', file)
    return fetch(`${API_BASE}/courses/units/${unitId}/files`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    }).then(async (res) => {
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`)
      return data
    })
  },
  deleteUnitFile: (unitId, fileId) => http('DELETE', `/courses/units/${unitId}/files/${fileId}`),
  // ---- Monitor ----
  getClassroomPresence: (id) => http('GET', `/classrooms/${id}/presence`),
  getContestMonitor: (cid, kid) => http('GET', `/classrooms/${cid}/contests/${kid}/monitor`),
  // ---- Khóa học (Curriculum) ----
  listCourses: () => http('GET', '/courses'),
  getCourse: (id) => http('GET', `/courses/${id}`),
  createCourse: (data) => http('POST', '/courses', data),
  updateCourse: (id, data) => http('PUT', `/courses/${id}`, data),
  deleteCourse: (id) => http('DELETE', `/courses/${id}`),
  addCourseUnit: (id, data) => http('POST', `/courses/${id}/units`, data),
  updateCourseUnit: (id, uid, data) => http('PUT', `/courses/${id}/units/${uid}`, data),
  deleteCourseUnit: (id, uid) => http('DELETE', `/courses/${id}/units/${uid}`),
  reorderCourseUnits: (id, items) => http('PUT', `/courses/${id}/units/reorder`, items),
  getLesson: (unitId) => http('GET', `/courses/units/${unitId}/lesson`),
  updateLesson: (unitId, data) => http('PUT', `/courses/units/${unitId}/lesson`, data),
  getUnitProblems: (unitId) => http('GET', `/courses/units/${unitId}/problems`),
  assignUnitProblem: (unitId, problemId) => http('POST', `/courses/units/${unitId}/problems`, { problemId }),
  removeUnitProblem: (unitId, problemId) => http('DELETE', `/courses/units/${unitId}/problems/${problemId}`),
  getCourseProgress: (courseId) => http('GET', `/courses/${courseId}/progress`),
  toggleUnitProgress: (unitId) => http('POST', `/courses/units/${unitId}/toggle-progress`),
}

export const api = USE_MOCK ? mockApi : realApi

// ---------- WebSocket (RFC 6455, cổng 8001) ----------
const wsListeners = new Set()
const statusListeners = new Set()
let ws = null
let wsStatus = USE_MOCK ? 'mock' : 'disconnected'
let retry = 0
let retryTimer = null

function setStatus(s) {
  wsStatus = s
  statusListeners.forEach((fn) => fn(s))
}

function scheduleReconnect() {
  if (retryTimer) return
  const delay = Math.min(30000, 1000 * 2 ** retry++)
  setStatus('reconnecting')
  retryTimer = setTimeout(() => {
    retryTimer = null
    connect()
  }, delay)
}

function connect() {
  if (USE_MOCK) return
  if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) return
  if (ws) { ws.onclose = null; ws.onerror = null; ws.close(); ws = null }
  setStatus('connecting')
  try {
    ws = new WebSocket(WS_URL)
  } catch {
    scheduleReconnect()
    return
  }
  ws.onopen = () => {
    retry = 0
    setStatus('open')
    const token = storageGet(TOKEN_KEY)
    if (token) ws.send(JSON.stringify({ type: 'AUTH', token }))
  }
  ws.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data)
      wsListeners.forEach((fn) => fn(msg))
    } catch {
      /* bỏ qua frame không phải JSON */
    }
  }
  ws.onerror = () => {
    // onclose will always follow onerror; just mark closed proactively
    ws = null
    scheduleReconnect()
  }
  ws.onclose = () => {
    ws = null
    scheduleReconnect()
  }
}

// Reconnect when the user returns to the tab after a long absence
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && !USE_MOCK) {
      if (!ws || ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
        if (retryTimer) { clearTimeout(retryTimer); retryTimer = null }
        retry = 0
        connect()
      }
    }
  })
}

export function subscribe(fn) {
  if (USE_MOCK) return engine.subscribe(fn)
  wsListeners.add(fn)
  connect()
  return () => wsListeners.delete(fn)
}

export function onSocketStatus(fn) {
  statusListeners.add(fn)
  fn(wsStatus)
  connect()
  return () => statusListeners.delete(fn)
}
