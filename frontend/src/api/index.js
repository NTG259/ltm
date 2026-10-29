const API_BASE = import.meta.env.VITE_API_BASE || '/api'
const WS_URL = import.meta.env.VITE_WS_URL || `ws://${window.location.hostname}:8001`
const TOKEN_KEY = 'cj.token'
const USER_KEY = 'cj.user'

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

export const api = {
  login: (payload) => http('POST', '/auth/login', payload),
  logout: () => http('DELETE', '/auth/logout'),
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
  leaderboard: (classroomId) => http('GET', classroomId ? `/leaderboard?classroomId=${classroomId}` : '/leaderboard'),
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

        if (res.imported > 0) return { success: true, ...res }
        if (res.alreadyEnrolled > 0) throw new Error('Sinh viên này đã có trong lớp rồi', { cause: err })
        if (res.skippedInOtherClass > 0) throw new Error('Sinh viên này hiện đã thuộc lớp khác (mỗi sinh viên chỉ được ở 1 lớp)', { cause: err })
        if (res.skippedInvalid > 0) throw new Error('Mã sinh viên không đúng định dạng (VD: B20DCCN001)', { cause: err })
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

// ---------- WebSocket (RFC 6455, cổng 8001) ----------
const wsListeners = new Set()
const statusListeners = new Set()
let ws = null
let wsStatus = 'disconnected'
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
    ws = null
    scheduleReconnect()
  }
  ws.onclose = () => {
    ws = null
    scheduleReconnect()
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      if (!ws || ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
        if (retryTimer) { clearTimeout(retryTimer); retryTimer = null }
        retry = 0
        connect()
      }
    }
  })
}

export function subscribe(fn) {
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
