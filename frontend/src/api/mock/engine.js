// Giả lập Master Dispatcher + cụm Judge Worker ngay trong trình duyệt.
// Mô phỏng đúng các hành vi trong README gốc: hàng đợi FIFO, Least-Busy scheduling,
// Heartbeat 5s / timeout 15s, Failover đưa bài về đầu hàng đợi (tối đa 3 lần),
// và luồng trạng thái IN_QUEUE → COMPILING → TESTING x/y → FINISHED.
// Các sự kiện phát ra có cùng định dạng với bản tin WebSocket thật (xem frontend/README.md).

import { PROBLEMS, STUDENTS, SAMPLE_SOURCES, STARTER_CODE } from './data.js'

const HEARTBEAT_INTERVAL = 5000
const MAX_ATTEMPTS = 3
const SECURITY_PATTERNS = [
  { re: /#\s*include\s*<\s*windows\.h\s*>/, msg: 'Phát hiện thư viện cấm `#include <windows.h>`' },
  { re: /\bsystem\s*\(/, msg: 'Phát hiện lời gọi hệ thống cấm `system()`' },
  { re: /\bfork\s*\(/, msg: 'Phát hiện lời gọi tạo tiến trình `fork()`' },
  { re: /\b(popen|execv?p?e?|CreateProcess)\s*\(/, msg: 'Phát hiện lời gọi thực thi tiến trình ngoài' },
  { re: /#\s*include\s*<\s*(unistd|sys\/socket)\.h\s*>/, msg: 'Phát hiện thư viện hệ điều hành bị cấm' },
]

const listeners = new Set()
const problems = PROBLEMS.map((p) => ({ ...p }))
const submissions = new Map()
const queue = []
const logs = []
let nextSubmissionId = 1001
let nextProblemId = problems.length + 1

const workers = ['worker-1', 'worker-2', 'worker-3'].map((id, i) => ({
  id,
  address: `127.0.0.1:${52340 + i * 7}`,
  status: 'IDLE',
  currentTask: null,
  completed: 0,
  connectedAt: Date.now() - (30 + i * 4) * 60_000,
  lastHeartbeat: Date.now(),
  latencyMs: 2 + i,
  timers: [],
}))

function emit(msg) {
  listeners.forEach((fn) => fn(msg))
}

function log(level, message) {
  logs.unshift({ id: `${Date.now()}-${Math.random()}`, time: Date.now(), level, message })
  if (logs.length > 200) logs.pop()
  emit({ type: 'LOG', entry: logs[0] })
}

function publicWorker(w) {
  // eslint-disable-next-line no-unused-vars
  const { timers, ...rest } = w
  return { ...rest }
}

function emitWorkers() {
  emit({ type: 'WORKER_UPDATE', workers: workers.map(publicWorker), queue: [...queue] })
}

function emitSubmission(sub) {
  emit({ type: 'SUBMISSION_UPDATE', submission: structuredClone(sub) })
}

function pushHistory(sub, status, note) {
  sub.history.push({ time: Date.now(), status, workerId: sub.workerId, note })
}

function hash(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function stripComments(code) {
  return code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
}

// Quyết định kết quả giả lập dựa trên nội dung mã nguồn và yêu cầu từng đề bài.
function analyse(code, problem) {
  const clean = stripComments(code)
  for (const p of SECURITY_PATTERNS) {
    if (p.re.test(clean)) return { verdict: 'SEC', securityMessage: p.msg }
  }
  const open = (clean.match(/\{/g) || []).length
  const close = (clean.match(/\}/g) || []).length
  const missingSemicolon = /\b(int|long long|double|string)\s+[\w\s,]+\n/.test(clean)
  if (!/\bmain\s*\(/.test(clean) || open !== close || missingSemicolon) {
    const line = clean.split('\n').findIndex((l) => /\b(int|long long|double|string)\s+[\w\s,]+$/.test(l)) + 1
    return {
      verdict: 'CE',
      compileLog:
        line > 0
          ? `solution.cpp: In function 'int main()':\nsolution.cpp:${line}:15: error: expected initializer before 'cin'\n    ${line} |     ${clean.split('\n')[line - 1].trim()}\n      |               ^\ncompilation terminated due to errors.`
          : !/\bmain\s*\(/.test(clean)
            ? "/usr/bin/ld: (.text+0x20): undefined reference to `main'\ncollect2: error: ld returned 1 exit status"
            : "solution.cpp: error: expected '}' at end of input\ncompilation terminated due to errors.",
    }
  }

  // 1. Phải có lệnh xuất kết quả ra màn hình (cout / printf / puts)
  if (!/\b(cout\s*<<|printf\s*\(|puts\s*\(|putchar\s*\()/.test(clean)) {
    return { verdict: 'WA', failAt: 0, detail: 'Chương trình không in ra kết quả nào' }
  }

  // 2. Kiểm tra các lỗi mô phỏng (TLE, MLE, RTE, WRONG_ANSWER)
  if (/while\s*\(\s*(true|1)\s*\)\s*\{\s*\}/.test(clean) || /for\s*\(\s*;\s*;\s*\)/.test(clean))
    return { verdict: 'TLE', failAt: 0 }
  if (/\(\s*\d{9,}\s*(LL)?\s*[,)]/.test(clean) || /\[\s*\d{9,}\s*\]/.test(clean)) return { verdict: 'MLE', failAt: 0 }
  if (/\/\s*(0\b|zero\b)/.test(clean) || /nullptr\s*->|\*\s*\(\s*int\s*\*\s*\)\s*0/.test(clean))
    return { verdict: 'RTE', failAt: 0 }
  if (/\ba\s*-\s*b\b/.test(clean) || /WRONG_ANSWER/.test(code)) return { verdict: 'WA', failAt: 0, detail: 'Đầu ra không khớp đáp án' }

  // 3. Phân tích đặc trưng thuật toán của mã nguồn:
  const isYesNoCode = /"YES"/i.test(clean) && /"NO"/i.test(clean)
  const isPrimeCheck = /\b(is_?prime|prime|nguyen_to|snt)\b/i.test(clean) || (/%\s*[a-zA-Z_]\w*\s*==\s*0/.test(clean) && !/\b(fib|dp|vector)\b/i.test(clean) && !/1000000007|1e9/.test(clean))
  const isFibonacci = /\b(fib|fibonacci)\b/i.test(clean) || (/f\[\s*i\s*-\s*1\s*\]/i.test(clean)) || (/1000000007|1e9/i.test(clean) && /\+/.test(clean))
  const isAPlusB = /\b(cin\s*>>\s*a\s*>>\s*b|a\s*\+\s*b)\b/.test(clean) && !/\b(for|while|if|vector|string|fib|prime)\b/i.test(clean)

  const pid = Number(problem.id)

  // CHẶN CHÉO 1: Bài nào yêu cầu YES/NO (chỉ bài 3 và 5)
  if ((pid === 3 || pid === 5) && !isYesNoCode) {
    return { verdict: 'WA', failAt: 0, detail: "Đầu ra không khớp: Đề bài yêu cầu in 'YES' hoặc 'NO'" }
  }
  // Ngược lại, các bài khác yêu cầu in số / mảng, TUYỆT ĐỐI không được in YES/NO
  if (pid !== 3 && pid !== 5 && isYesNoCode) {
    return { verdict: 'WA', failAt: 0, wrongOutput: "YES\n", detail: "Đầu ra không khớp: Nhận được 'YES'/'NO' trong khi đề bài yêu cầu số/mảng" }
  }

  // CHẶN CHÉO 2: Nộp code A+B vào bài khác bài 1
  if (pid !== 1 && isAPlusB) {
    return { verdict: 'WA', failAt: 0, detail: 'Đầu ra không khớp: Mã nguồn chỉ tính a + b' }
  }

  // CHẶN CHÉO 3: Nộp code Số nguyên tố vào bài khác bài 3
  if (pid !== 3 && isPrimeCheck) {
    return { verdict: 'WA', failAt: 0, wrongOutput: "YES\n", detail: 'Đầu ra không khớp: Mã nguồn là bài kiểm tra số nguyên tố' }
  }

  // CHẶN CHÉO 4: Nộp code Fibonacci vào bài khác bài 2
  if (pid !== 2 && isFibonacci) {
    return { verdict: 'WA', failAt: 0, detail: 'Đầu ra không khớp: Mã nguồn là bài tính dãy Fibonacci' }
  }

  // CHI TIẾT TỪNG BÀI:

  // Bài 1: A + B Problem
  if (pid === 1) {
    if (!/\+/.test(clean)) return { verdict: 'WA', failAt: 0, detail: 'Thiếu phép toán cộng a + b' }
    return { verdict: 'AC' }
  }

  // Bài 2: Fibonacci Modulo 10^9+7
  if (pid === 2) {
    const hasModulo = /%|1000000007|1e9/.test(clean)
    const hasFibRec = (/f\[\s*i\s*-\s*1\s*\]/i.test(clean)) || (/\b(prev|curr|a\s*\+\s*b)\b/.test(clean)) || (/\bfib\s*\(/.test(clean)) || (/\bfor\b/.test(clean) && /\+/.test(clean))
    if (!hasModulo || !hasFibRec) {
      return { verdict: 'WA', failAt: 0, detail: 'Thuật toán chưa đúng: Cần tính F(n) = F(n-1) + F(n-2) chia dư cho 10^9+7' }
    }
    return { verdict: 'AC' }
  }

  // Bài 3: Kiểm tra số nguyên tố
  if (pid === 3) {
    const hasLoop = /\b(for|while)\b/.test(clean)
    const hasModulo = /%\s*\w+\s*==\s*0/.test(clean) || /\b(isPrime|prime|nguyen_to)\b/i.test(clean)
    if (!hasLoop || !hasModulo) {
      return { verdict: 'WA', failAt: 0, detail: 'Thuật toán chưa đúng: Cần duyệt ước số i và kiểm tra chia hết n % i == 0' }
    }
    return { verdict: 'AC' }
  }

  // Bài 4: Min/Max & Đảo mảng
  if (pid === 4) {
    const hasLoop = /\b(for|while)\b/.test(clean)
    const hasMinMax = /\b(min|max|<|>)\b/.test(clean)
    const hasReverse = /\b(reverse|rbegin|--)\b/.test(clean)
    if (!hasLoop || !hasMinMax || !hasReverse) {
      return { verdict: 'WA', failAt: 0, detail: 'Thuật toán chưa đúng: Cần tìm min, max và in mảng theo thứ tự đảo ngược' }
    }
    return { verdict: 'AC' }
  }

  // Bài 5: Chuỗi đối xứng Palindrome
  if (pid === 5) {
    const hasString = /\b(string|char)\b/.test(clean)
    const hasCheck = /==|\breverse\b/.test(clean)
    if (!hasString || !hasCheck) {
      return { verdict: 'WA', failAt: 0, detail: 'Thuật toán chưa đúng: Cần kiểm tra ký tự đối xứng trong xâu' }
    }
    return { verdict: 'AC' }
  }

  // Bài 6: Sắp xếp dãy số
  if (pid === 6) {
    const hasSort = /\bsort\s*\(/.test(clean) || (clean.match(/\bfor\b/g) || []).length >= 2
    if (!hasSort) return { verdict: 'WA', failAt: 0, detail: 'Thuật toán chưa đúng: Cần sắp xếp dãy số không giảm' }
    return { verdict: 'AC' }
  }

  // Bài 7: Tìm kiếm nhị phân
  if (pid === 7) {
    const hasBS = /\b(lower_bound|binary_search|mid)\b/i.test(clean) || /\b(left|right|mid)\b/i.test(clean)
    const hasMinusOne = /-1/.test(clean)
    if (!hasBS || !hasMinusOne) return { verdict: 'WA', failAt: 0, detail: 'Thuật toán chưa đúng: Cần tìm kiếm nhị phân và in -1 nếu không thấy' }
    return { verdict: 'AC' }
  }

  // Bài 8: Dãy con tăng dài nhất (LIS)
  if (pid === 8) {
    const hasLIS = /\b(dp|lis|max|lower_bound)\b/i.test(clean)
    if (!hasLIS) return { verdict: 'WA', failAt: 0, detail: 'Thuật toán chưa đúng: Cần quy hoạch động hoặc tìm kiếm nhị phân tìm LIS' }
    return { verdict: 'AC' }
  }

  // Bài 9: 0/1 Knapsack
  if (pid === 9) {
    const hasDP = /\bdp\b/i.test(clean) && /\bmax\b/i.test(clean)
    if (!hasDP) return { verdict: 'WA', failAt: 0, detail: 'Thuật toán chưa đúng: Cần quy hoạch động Knapsack' }
    return { verdict: 'AC' }
  }

  // Bài 10: BigInt
  if (pid === 10) {
    const hasBigInt = /\bstring\b/.test(clean) && (/%|carry|nho|\/|10/.test(clean))
    if (!hasBigInt) return { verdict: 'WA', failAt: 0, detail: 'Thuật toán chưa đúng: Cần cộng hai số lớn bằng xử lý xâu' }
    return { verdict: 'AC' }
  }

  return { verdict: 'AC' }
}

function corrupt(output) {
  const tokens = output.split(/(\s+)/)
  const last = tokens.length - 1
  const n = Number(tokens[last])
  tokens[last] = Number.isFinite(n) ? String(n + 1) : tokens[last] === 'YES' ? 'NO' : 'YES'
  return tokens.join('')
}

function clearTimers(w) {
  w.timers.forEach(clearTimeout)
  w.timers = []
}

function later(w, ms, fn) {
  w.timers.push(setTimeout(fn, ms))
}

function finish(w, sub) {
  sub.status = 'FINISHED'
  sub.finishedAt = Date.now()
  pushHistory(sub, 'FINISHED', `Kết quả ${sub.verdict} – ${sub.score}/100 điểm`)
  log(sub.verdict === 'AC' ? 'success' : 'info', `OP_TASK_RESULT #${sub.id} từ ${w.id}: ${sub.verdict} (${sub.score} điểm)`)
  w.status = 'IDLE'
  w.currentTask = null
  w.completed += 1
  clearTimers(w)
  emitSubmission(sub)
  emitWorkers()
  schedule()
}

function runJudge(w, sub) {
  const problem = problems.find((p) => p.id === sub.problemId)
  const plan = analyse(sub.sourceCode, problem)
  const total = problem.tests.length
  sub.tests = problem.tests.map((t, i) => ({ index: i + 1, status: 'PENDING', input: t.input, expected: t.output }))
  sub.progress = { current: 0, total }
  const seed = hash(sub.sourceCode)

  if (plan.verdict === 'SEC') {
    later(w, 250, () => {
      Object.assign(sub, { verdict: 'SEC', score: 0, securityMessage: plan.securityMessage, timeMs: 0, memoryKb: 0 })
      sub.tests.forEach((t) => (t.status = 'SKIPPED'))
      pushHistory(sub, 'SCAN', 'Quét tĩnh Regex phát hiện mã nguy hiểm – chặn trước khi biên dịch')
      finish(w, sub)
    })
    return
  }

  later(w, 200, () => {
    sub.status = 'COMPILING'
    pushHistory(sub, 'COMPILING', 'Quét bảo mật OK – g++ -std=c++17 -O2')
    log('info', `OP_TASK_STATUS #${sub.id} từ ${w.id}: COMPILING`)
    emitSubmission(sub)
  })

  if (plan.verdict === 'CE') {
    later(w, 1400, () => {
      Object.assign(sub, { verdict: 'CE', score: 0, compileLog: plan.compileLog, timeMs: 0, memoryKb: 0 })
      sub.tests.forEach((t) => (t.status = 'SKIPPED'))
      finish(w, sub)
    })
    return
  }

  let t = 1400
  let passed = 0
  for (let i = 0; i < total; i++) {
    const failing = plan.verdict !== 'AC' && i === plan.failAt
    const duration = failing && plan.verdict === 'TLE' ? problem.timeLimitMs + 5 : 6 + ((seed >> i) % 40)
    const memoryKb = failing && plan.verdict === 'MLE' ? problem.memoryLimitMb * 1024 + 128 : 3000 + ((seed >> (i + 3)) % 1800)
    later(w, t, () => {
      sub.status = 'TESTING'
      sub.progress = { current: i + 1, total }
      sub.tests[i].status = 'RUNNING'
      pushHistory(sub, 'TESTING', `TESTING ${i + 1}/${total}`)
      emitSubmission(sub)
    })
    t += Math.min(duration, 1200) + 900
    later(w, t, () => {
      const test = sub.tests[i]
      test.timeMs = duration
      test.memoryKb = memoryKb
      if (failing) {
        test.status = plan.verdict
        test.detail = plan.detail || (plan.verdict === 'WA' ? 'Đầu ra không khớp đáp án' : undefined)
        if (plan.verdict === 'WA') test.output = plan.wrongOutput || corrupt(test.expected)
        if (plan.verdict === 'RTE') test.stderr = 'Floating point exception (SIGFPE, signal 8) – exit code 136'
        if (plan.verdict === 'TLE') test.stderr = `Bị dừng sau ${problem.timeLimitMs} ms (SIGKILL)`
        if (plan.verdict === 'MLE') test.stderr = `Bộ nhớ vượt ${problem.memoryLimitMb} MB – tiến trình bị kết thúc`
        sub.tests.slice(i + 1).forEach((x) => (x.status = 'SKIPPED'))
      } else {
        test.status = 'AC'
        test.output = test.expected
        passed += 1
      }
      const ran = sub.tests.filter((x) => x.timeMs != null)
      sub.timeMs = Math.max(...ran.map((x) => x.timeMs))
      sub.memoryKb = Math.max(...ran.map((x) => x.memoryKb))
      emitSubmission(sub)
      if (failing || i === total - 1) {
        sub.verdict = failing ? plan.verdict : 'AC'
        sub.score = Math.round((passed / total) * 100)
        finish(w, sub)
      }
    })
    if (failing) break
  }
}

function assign(w, sub) {
  w.status = 'BUSY'
  w.currentTask = sub.id
  sub.workerId = w.id
  sub.attempts += 1
  pushHistory(sub, 'ASSIGNED', `OP_TASK_ASSIGN → ${w.id} (lần ${sub.attempts})`)
  log('info', `Least-Busy: giao bài #${sub.id} cho ${w.id} (đã chấm ${w.completed} bài)`)
  emitSubmission(sub)
  emitWorkers()
  runJudge(w, sub)
}

function schedule() {
  while (queue.length) {
    const idle = workers.filter((w) => w.status === 'IDLE').sort((a, b) => a.completed - b.completed)
    if (!idle.length) break
    const sub = submissions.get(queue.shift())
    assign(idle[0], sub)
  }
  emitWorkers()
}

// ---------- Heartbeat ----------
setInterval(() => {
  const now = Date.now()
  workers.forEach((w) => {
    if (w.status === 'DEAD') return
    w.lastHeartbeat = now
    w.latencyMs = 1 + Math.round(Math.random() * 6)
  })
  emitWorkers()
}, HEARTBEAT_INTERVAL)

// ---------- Dữ liệu lịch sử ----------
function finishedSubmission({ problem, user, verdict, createdAt, k, contestId }) {
  const total = problem.tests.length
  const passed = verdict === 'AC' ? total : ['CE', 'SEC'].includes(verdict) ? 0 : Math.floor(total / 2)
  const worker = workers[k % 3]
  const id = nextSubmissionId++
  worker.completed += 1
  return {
    id,
    contestId: contestId ?? null,
    problemId: problem.id,
    problemTitle: problem.title,
    userId: user.id,
    userName: user.name,
    language: 'C++17',
    sourceCode: verdict === 'AC' ? STARTER_CODE : SAMPLE_SOURCES[`${verdict.toLowerCase()}.cpp`] || STARTER_CODE,
    status: 'FINISHED',
    verdict,
    score: Math.round((passed / total) * 100),
    timeMs: ['CE', 'SEC'].includes(verdict) ? 0 : verdict === 'TLE' ? problem.timeLimitMs + 5 : 12 + ((k * 13) % 80),
    memoryKb: ['CE', 'SEC'].includes(verdict) ? 0 : verdict === 'MLE' ? 262272 : 3100 + ((k * 211) % 2000),
    workerId: worker.id,
    attempts: 1,
    createdAt,
    finishedAt: createdAt + 1800,
    progress: { current: total, total },
    tests: problem.tests.map((t, i) => ({
      index: i + 1,
      input: t.input,
      expected: t.output,
      output: i < passed ? t.output : i === passed && verdict === 'WA' ? corrupt(t.output) : undefined,
      status: i < passed ? 'AC' : i === passed && !['CE', 'SEC'].includes(verdict) ? verdict : 'SKIPPED',
      timeMs: i <= passed && !['CE', 'SEC'].includes(verdict) ? 8 + i * 5 : undefined,
      memoryKb: i <= passed && !['CE', 'SEC'].includes(verdict) ? 3200 + i * 100 : undefined,
    })),
    compileLog: verdict === 'CE' ? "solution.cpp:5:15: error: expected initializer before 'cin'" : undefined,
    securityMessage: verdict === 'SEC' ? 'Phát hiện thư viện cấm `#include <windows.h>`' : undefined,
    history: [
      { time: createdAt, status: 'IN_QUEUE', note: 'Nhận bài qua HTTP POST /api/submissions' },
      { time: createdAt + 30, status: 'ASSIGNED', workerId: worker.id, note: `OP_TASK_ASSIGN → ${worker.id}` },
      { time: createdAt + 1800, status: 'FINISHED', workerId: worker.id, note: `Kết quả ${verdict}` },
    ],
  }
}

function seedHistory() {
  const verdictPool = ['AC', 'AC', 'AC', 'WA', 'AC', 'TLE', 'AC', 'CE', 'AC', 'RTE', 'AC', 'WA', 'MLE', 'AC', 'SEC']
  const now = Date.now()
  let k = 0
  STUDENTS.forEach((user, si) => {
    for (let j = 0; j < 9 - si; j++) {
      const problem = problems[(si * 3 + j * 2) % problems.length]
      const verdict = verdictPool[(si * 5 + j * 3) % verdictPool.length]
      const sub = finishedSubmission({ problem, user, verdict, createdAt: now - (k * 47 + 12) * 60_000, k })
      submissions.set(sub.id, sub)
      k++
    }
  })
  log('success', 'Master khởi động: HTTP :8000, WebSocket :8001, TCP :9000')
  workers.forEach((w) => log('info', `OP_WORKER_REGISTER: ${w.id} kết nối từ ${w.address}`))
}
seedHistory()

// ---------- Kỳ thi ----------
const HOUR = 3_600_000
const contests = []
let nextContestId = 1

function contestStatus(c, now = Date.now()) {
  if (now < c.startAt) return 'UPCOMING'
  if (now < c.startAt + c.durationMin * 60_000) return 'RUNNING'
  return 'ENDED'
}

function addContest(data) {
  // id đặt sau ...data: form tạo mới gửi id: undefined.
  const c = { participants: [], createdAt: Date.now(), ...data, id: nextContestId++ }
  contests.push(c)
  return c
}

// Sinh bài nộp trong khung giờ thi để bảng xếp hạng có dữ liệu.
function seedContestSubmissions(c, upTo) {
  const wrong = ['WA', 'TLE', 'WA', 'RTE', 'CE']
  let k = 0
  c.participants.forEach((uid, ui) => {
    const user = STUDENTS.find((s) => s.id === uid)
    c.problemIds.forEach((pid, pi) => {
      if ((ui + pi) % 4 === 3) return // thí sinh bỏ qua bài này
      const tries = (ui + pi) % 3 // số lần nộp sai trước lần cuối
      const solvesInTheEnd = (ui + pi * 2) % 5 !== 4
      for (let t = 0; t <= tries; t++) {
        const createdAt = c.startAt + (6 + pi * 17 + ui * 5 + t * 9) * 60_000
        if (createdAt > upTo) return
        const verdict = t === tries && solvesInTheEnd ? 'AC' : wrong[(ui * 3 + pi + t) % wrong.length]
        const problem = problems.find((p) => p.id === pid)
        const sub = finishedSubmission({ problem, user, verdict, createdAt, k: k++, contestId: c.id })
        submissions.set(sub.id, sub)
      }
    })
  })
}

function seedContests() {
  const now = Date.now()
  const ended = addContest({
    title: 'Kỳ thi thử Lập trình mạng – Vòng 1',
    description: 'Vòng làm quen với hệ thống chấm tự động. 4 bài cơ bản về I/O, số học và xâu.',
    startAt: now - 26 * HOUR,
    durationMin: 120,
    problemIds: [1, 3, 5, 6],
    participants: STUDENTS.map((s) => s.id),
  })
  seedContestSubmissions(ended, ended.startAt + ended.durationMin * 60_000)
  const running = addContest({
    title: 'Kỳ thi giữa kỳ – Thuật toán cơ bản',
    description:
      'Kỳ thi giữa kỳ học phần. Thể thức ICPC: xếp hạng theo số bài đúng, sau đó theo tổng thời gian phạt.\nMỗi lần nộp sai (trừ lỗi biên dịch) trước khi AC bị cộng 20 phút phạt.',
    startAt: now - 50 * 60_000,
    durationMin: 150,
    problemIds: [2, 4, 7, 8, 9],
    participants: STUDENTS.slice(0, 6).map((s) => s.id),
  })
  seedContestSubmissions(running, now)
  addContest({
    title: 'Kỳ thi cuối kỳ – Quy hoạch động & Số lớn',
    description: 'Kỳ thi cuối kỳ gồm 4 bài. Đăng ký trước khi kỳ thi bắt đầu.',
    startAt: now + 20 * HOUR,
    durationMin: 180,
    problemIds: [8, 9, 10, 3],
    participants: STUDENTS.slice(0, 3).map((s) => s.id),
  })
}
seedContests()

// ---------- API công khai cho lớp mock ----------
export const engine = {
  subscribe(fn) {
    listeners.add(fn)
    return () => listeners.delete(fn)
  },
  problems: () => problems,
  submissions: () => [...submissions.values()].sort((a, b) => b.id - a.id),
  submission: (id) => submissions.get(Number(id)),
  workers: () => workers.map(publicWorker),
  queue: () => [...queue],
  logs: () => [...logs],

  submit({ problemId, sourceCode, user, contestId }) {
    const problem = problems.find((p) => p.id === Number(problemId))
    if (!problem) throw new Error('Không tìm thấy đề bài')
    if (contestId) {
      const c = contests.find((x) => x.id === Number(contestId))
      if (!c) throw new Error('Không tìm thấy kỳ thi')
      if (contestStatus(c) !== 'RUNNING') throw new Error('Kỳ thi không trong thời gian làm bài')
      if (!c.participants.includes(user.id)) throw new Error('Bạn chưa đăng ký kỳ thi này')
      if (!c.problemIds.includes(problem.id)) throw new Error('Bài không thuộc kỳ thi')
    }
    const id = nextSubmissionId++
    const sub = {
      id,
      contestId: contestId ? Number(contestId) : null,
      problemId: problem.id,
      problemTitle: problem.title,
      userId: user.id,
      userName: user.name,
      language: 'C++17',
      sourceCode,
      status: 'IN_QUEUE',
      verdict: null,
      score: null,
      timeMs: null,
      memoryKb: null,
      workerId: null,
      attempts: 0,
      createdAt: Date.now(),
      progress: { current: 0, total: problem.tests.length },
      tests: [],
      history: [],
    }
    pushHistory(sub, 'IN_QUEUE', 'Nhận bài qua HTTP POST /api/submissions, lưu SQLite và đưa vào hàng đợi FIFO')
    submissions.set(id, sub)
    queue.push(id)
    log('info', `Nhận bài #${id} (${user.id} – bài #${problem.id}), hàng đợi: ${queue.length}`)
    emitSubmission(sub)
    setTimeout(schedule, 300)
    return structuredClone(sub)
  },

  killWorker(id) {
    const w = workers.find((x) => x.id === id)
    if (!w || w.status === 'DEAD') return
    clearTimers(w)
    const taskId = w.currentTask
    w.status = 'DEAD'
    w.currentTask = null
    log('error', `Mất kết nối ${w.id} (socket RST/FIN) – đánh dấu DEAD`)
    if (taskId) {
      const sub = submissions.get(taskId)
      if (sub.attempts >= MAX_ATTEMPTS) {
        Object.assign(sub, { status: 'FINISHED', verdict: 'RTE', score: 0 })
        pushHistory(sub, 'FAILOVER', `Đã thử ${MAX_ATTEMPTS} lần – dừng chấm`)
        log('error', `Bài #${sub.id} vượt quá ${MAX_ATTEMPTS} lần thử`)
      } else {
        sub.status = 'IN_QUEUE'
        sub.tests = []
        sub.progress = { current: 0, total: sub.progress.total }
        pushHistory(sub, 'FAILOVER', `${w.id} chết – thu hồi bài, đưa về ĐẦU hàng đợi`)
        sub.workerId = null
        queue.unshift(sub.id)
        log('warning', `FAILOVER: thu hồi bài #${sub.id} từ ${w.id}, đưa về đầu hàng đợi`)
      }
      emitSubmission(sub)
    }
    emitWorkers()
    setTimeout(schedule, 85)
  },

  reviveWorker(id) {
    const w = workers.find((x) => x.id === id)
    if (!w || w.status !== 'DEAD') return
    Object.assign(w, { status: 'IDLE', connectedAt: Date.now(), lastHeartbeat: Date.now() })
    log('success', `OP_WORKER_REGISTER: ${w.id} kết nối lại từ ${w.address}`)
    emitWorkers()
    schedule()
  },

  saveProblem(data) {
    if (data.id) {
      const i = problems.findIndex((p) => p.id === data.id)
      problems[i] = { ...problems[i], ...data }
      log('info', `Admin cập nhật đề bài #${data.id}`)
      return problems[i]
    }
    const p = { ...data, id: nextProblemId++ }
    problems.push(p)
    log('info', `Admin thêm đề bài #${p.id}`)
    return p
  },

  contests: () => contests,
  contestStatus,

  registerContest(id, user) {
    const c = contests.find((x) => x.id === Number(id))
    if (!c) throw new Error('Không tìm thấy kỳ thi')
    if (contestStatus(c) === 'ENDED') throw new Error('Kỳ thi đã kết thúc')
    if (!c.participants.includes(user.id)) c.participants.push(user.id)
    log('info', `${user.id} đăng ký kỳ thi #${c.id}`)
    emit({ type: 'CONTEST_UPDATE', contestId: c.id })
    return c
  },

  saveContest(data) {
    if (data.id) {
      const c = contests.find((x) => x.id === data.id)
      Object.assign(c, data)
      log('info', `Admin cập nhật kỳ thi #${c.id}`)
      emit({ type: 'CONTEST_UPDATE', contestId: c.id })
      return c
    }
    const c = addContest(data)
    log('info', `Admin tạo kỳ thi #${c.id}: ${c.title}`)
    emit({ type: 'CONTEST_UPDATE', contestId: c.id })
    return c
  },

  deleteContest(id) {
    const i = contests.findIndex((x) => x.id === Number(id))
    if (i >= 0) contests.splice(i, 1)
    log('warning', `Admin xoá kỳ thi #${id}`)
    emit({ type: 'CONTEST_UPDATE', contestId: Number(id) })
  },

  deleteProblem(id) {
    const i = problems.findIndex((p) => p.id === Number(id))
    if (i >= 0) problems.splice(i, 1)
    log('warning', `Admin xóa đề bài #${id}`)
  },
}
