const API_BASE = import.meta.env.VITE_API_BASE || '/api'
const getWsUrl = () => {
  if (import.meta.env.VITE_WS_URL) return import.meta.env.VITE_WS_URL
  if (typeof window === 'undefined') return 'ws://localhost:18001'
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const host = window.location.hostname
  const port = window.location.port === '18080' || window.location.port === '5173' ? 18001 : (window.location.port || 8001)
  return `${protocol}//${host}:${port}`
}
const WS_URL = getWsUrl()
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
    /* bá» qua khi trÃ¬nh duyá»‡t cháº·n storage */
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
  deleteLecturer: (id) => http('DELETE', `/admin/lecturers/${id}`),
  listLecturerClassrooms: (id) => http('GET', `/admin/lecturers/${id}/classrooms`),
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
  reviveWorker: () => Promise.reject(new Error('HÃ£y khá»Ÿi Ä‘á»™ng láº¡i tiáº¿n trÃ¬nh judge_worker.py')),
  removeDisconnectedWorkers: () => http('DELETE', '/admin/workers/disconnected'),
  adminLogs: (level) => http('GET', level ? `/admin/logs?level=${level}` : '/admin/logs'),
  // ---- Lá»›p há»c ----
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
        let csvLines = 'MSSV, Há» tÃªn\n'
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
        if (res.alreadyEnrolled > 0) throw new Error('Sinh viÃªn nÃ y Ä‘Ã£ cÃ³ trong lá»›p rá»“i', { cause: err })
        if (res.skippedInOtherClass > 0) throw new Error('Sinh viÃªn nÃ y hiá»‡n Ä‘Ã£ thuá»™c lá»›p khÃ¡c (má»—i sinh viÃªn chá»‰ Ä‘Æ°á»£c á»Ÿ 1 lá»›p)', { cause: err })
        if (res.skippedInvalid > 0) throw new Error('MÃ£ sinh viÃªn khÃ´ng Ä‘Ãºng Ä‘á»‹nh dáº¡ng (VD: B20DCCN001)', { cause: err })
        throw new Error('KhÃ´ng thá»ƒ thÃªm sinh viÃªn vÃ o lá»›p', { cause: err })
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
  // ---- KhÃ³a há»c (Curriculum) ----
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

// ---------- WebSocket (RFC 6455, cá»•ng 8001) ----------
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
      /* bá» qua frame khÃ´ng pháº£i JSON */
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
