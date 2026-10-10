// Lớp truy cập dữ liệu. Mặc định dùng mock (giả lập Master trong trình duyệt);
// đặt VITE_USE_MOCK=false để gọi Master Server thật qua HTTP :8000 / WebSocket :8001.
import { engine } from './mock/engine.js'

export const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false'
const API_BASE = import.meta.env.VITE_API_BASE || '/api'
const WS_URL = import.meta.env.VITE_WS_URL || `ws://${window.location.hostname}:8001`
const TOKEN_KEY = 'cj.token'
const USER_KEY = 'cj.user'
const ADMIN_PASSWORD = 'admin123'

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

const mockApi = {
  async login(payload) {
    if (payload.role === 'admin') {
      if (payload.password !== ADMIN_PASSWORD) throw new Error('Sai mật khẩu quản trị')
      return delay({ token: 'mock-admin-token', user: { id: 'admin', name: 'Quản trị viên', role: 'admin' } })
    }
    if (!/^[A-Z]\d{2}[A-Z]{4}\d{3}$/i.test(payload.studentId)) throw new Error('MSSV không hợp lệ (ví dụ: B20DCCN001)')
    const user = { id: payload.studentId.toUpperCase(), name: payload.fullName.trim(), role: 'student' }
    engine.registerStudent(user)
    return delay({
      token: `mock-${payload.studentId}`,
      user,
    })
  },
  listProblems: () => delay(problemStats(engine.problems(), engine.submissions())),
  getProblem: (id) => {
    const p = engine.problems().find((x) => x.id === Number(id))
    return p ? delay(p) : Promise.reject(new Error('Không tìm thấy đề bài'))
  },
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
  listSubmissions: ({ userId, problemId, verdict, contestId } = {}) =>
    delay(
      engine
        .submissions()
        .filter((s) => (!userId || s.userId === userId) && (!problemId || s.problemId === Number(problemId)))
        .filter((s) => !contestId || s.contestId === Number(contestId))
        .filter((s) => !verdict || s.verdict === verdict)
        // eslint-disable-next-line no-unused-vars
        .map(({ sourceCode, tests, history, ...rest }) => rest),
    ),
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
  contestStandings: async (id) => delay(icpcStandings(findContest(id), engine.submissions())),
  saveContest: (data) => delay(engine.saveContest(data)),
  deleteContest: (id) => delay(engine.deleteContest(id)),
  // ---- Admin ----
  adminOverview: () =>
    delay({ workers: engine.workers(), queue: engine.queue(), logs: engine.logs(), submissions: engine.submissions().length }),
  saveProblem: (data) => delay(engine.saveProblem(data)),
  deleteProblem: (id) => delay(engine.deleteProblem(id)),
  killWorker: (id) => delay(engine.killWorker(id), 50),
  reviveWorker: (id) => delay(engine.reviveWorker(id), 50),
}

const realApi = {
  login: (payload) => http('POST', '/auth/login', payload),
  listProblems: () => http('GET', '/problems'),
  getProblem: (id) => http('GET', `/problems/${id}`),
  submit: (payload) => http('POST', '/submissions', payload),
  runTest: (payload) => http('POST', '/submissions/run', payload),
  listSubmissions: (q = {}) => http('GET', `/submissions?${new URLSearchParams(Object.entries(q).filter(([, v]) => v))}`),
  getSubmission: (id) => http('GET', `/submissions/${id}`),
  leaderboard: () => http('GET', '/leaderboard'),
  listContests: () => http('GET', '/contests'),
  getContest: (id) => http('GET', `/contests/${id}`),
  registerContest: (id) => http('POST', `/contests/${id}/register`),
  contestStandings: (id) => http('GET', `/contests/${id}/standings`),
  saveContest: (data) => (data.id ? http('PUT', `/admin/contests/${data.id}`, data) : http('POST', '/admin/contests', data)),
  deleteContest: (id) => http('DELETE', `/admin/contests/${id}`),
  adminOverview: () => http('GET', '/admin/overview'),
  saveProblem: (data) => (data.id ? http('PUT', `/admin/problems/${data.id}`, data) : http('POST', '/admin/problems', data)),
  deleteProblem: (id) => http('DELETE', `/admin/problems/${id}`),
  killWorker: (id) => http('POST', `/admin/workers/${id}/disconnect`),
  reviveWorker: () => Promise.reject(new Error('Hãy khởi động lại tiến trình judge_worker.py')),
}

export const api = USE_MOCK ? mockApi : realApi

// ---------- WebSocket (RFC 6455, cổng 8001) ----------
const wsListeners = new Set()
const statusListeners = new Set()
let ws = null
let wsStatus = USE_MOCK ? 'mock' : 'connecting'
let retry = 0

function setStatus(s) {
  wsStatus = s
  statusListeners.forEach((fn) => fn(s))
}

function connect() {
  if (USE_MOCK || ws) return
  setStatus('connecting')
  ws = new WebSocket(WS_URL)
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
  ws.onclose = () => {
    ws = null
    setStatus('closed')
    setTimeout(connect, Math.min(10000, 1000 * 2 ** retry++))
  }
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
