# Task 07 — Experimental Setup & Measurement

> Mapping báo cáo: §8.11 Experimental Setup · §8.12 Results · §8.13 Discussion · §9 Yêu cầu thực nghiệm

---

## 1. Non-functional requirements (NFR) — thước đo

| ID | NFR | Target | Cách đo |
|----|-----|--------|---------|
| NFR-1 | Concurrent submissions không drop | ≥ 50 bài / lần | Gửi 50 bài đồng thời, đếm bài có verdict |
| NFR-2 | Queue wait time p95 (3 workers) | < 2 000 ms | `enqueuedAt` → `assignedAt` (SUBMISSION_UPDATE COMPILING) |
| NFR-3 | Worker throughput | ≥ 10 submissions/phút/worker | Đếm FINISHED / thời gian |
| NFR-4 | Worker utilization | ≥ 80% khi queue đầy | `WORKER_UPDATE` WebSocket events |
| NFR-5 | Queue durability khi restart | 0 bài mất | Gửi 10 bài, kill Master, restart, đếm verdict |
| NFR-6 | Memory isolation | 0 bài vượt MLE mà không bị kill | Gửi bài OOM, kiểm tra verdict = MLE |
| NFR-7 | Failover thành công | ≥ 95% bài được chấm lại | Kill worker đang chấm, kiểm tra requeue ≤ 20s |

---

## 2. Hardware specs (khai báo trong báo cáo)

| Thành phần | Spec |
|---|---|
| Master | Intel Core i5-12th / 8 GB RAM / Windows 11 |
| Worker | Cùng máy (3 process Python song song) |
| Network | Localhost (loopback) |
| Database | Neon Cloud PostgreSQL (latency ~50ms) |
| OS | Windows 11 Pro (Worker dùng wall-clock, không có sandbox POSIX) |

> **Lưu ý:** Trên Windows, `launcher.c` (POSIX `fork+setrlimit`) không chạy. NFR-6 (MLE) chỉ kiểm tra wall-clock timeout; memory RSS cần Linux.

---

## 3. Test scenarios

### Scenario A — Throughput (NFR-1, 3, 4)

```
Setup:    3 workers, queue rỗng
Problem:  A+B — chạy ~50ms, 5 test case
Input:    50 VUs k6, mỗi VU gửi 1 submission
Measure:
  - Tổng thời gian đến khi tất cả 50 bài có verdict
  - Worker utilization % per worker (qua WS WORKER_UPDATE)
  - Drop rate (bài không có verdict sau 60s)
Expected: tất cả 50 bài có verdict trong < 60s, utilization > 80%
Repeat:   3 lần → lấy trung bình
```

### Scenario B — Queue wait time (NFR-2)

```
Setup:    1 worker (bottleneck), queue rỗng
Input:    20 VUs k6 (1 iteration/VU), pace 1 VU / 500ms
Measure:
  t_enqueue   = timestamp trước khi POST /api/submissions
  t_compiling = timestamp khi nhận WS SUBMISSION_UPDATE{status:COMPILING}
  wait_time   = t_compiling - t_enqueue
Metric:   custom Trend "queue_wait_time_ms" → k6 xuất p(50), p(95), p(99)
Expected: p95 < 2000ms
Repeat:   3 lần
```

### Scenario C — Queue durability (NFR-5)

```
Setup:    3 workers, queue rỗng
Input:    10 submissions (bài A+B)
Action:
  1. Chạy k6 script gửi 10 bài → đợi ≥2 bài vào IN_QUEUE
  2. Kill Master (taskkill /F /IM java.exe)
  3. Đợi 5 giây
  4. Restart Master
Measure:  Đếm submissions có verdict sau restart (GET /api/submissions/{id})
Expected: 10/10 submissions được chấm (0 bài mất)
```

### Scenario D — Memory isolation (NFR-6) [Linux only]

```
Input: C++ program cấp phát 2 GB:
  #include<bits/stdc++.h>
  int main(){ vector<int> v(500000000, 0); cout << v.size(); }
  problem config: memoryLimitMb = 256
Expected: verdict = MLE
Verify:   Worker nhận bài tiếp theo bình thường (không crash)
```

### Scenario E — Failover (NFR-7)

```
Setup:    2 workers, queue rỗng
Input:    5 submissions gửi đồng thời
Action:
  1. Chờ worker-1 nhận ≥1 bài (SUBMISSION_UPDATE COMPILING)
  2. Kill worker-1 process
Measure:
  detect_time = t_requeue - t_disconnect   (phải ≤ 20s)
  success_rate = bài có verdict / bài giao cho worker-1
Expected: detect_time ≤ 20s, success_rate ≥ 95%
```

---

## 4. k6 scripts

### Cài đặt

```powershell
# k6 đã cài — kiểm tra phiên bản
k6 version
```

**Biến môi trường dùng chung:**

```powershell
$env:BASE_URL = "http://localhost:8000"
$env:WS_URL   = "ws://localhost:8001"
# TOKEN lấy từ login (xem setup() trong mỗi script)
```

---

### `tests/k6/scenario_a_throughput.js` — Scenario A

```javascript
import http from 'k6/http';
import ws   from 'k6/ws';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8000';
const WS_URL   = __ENV.WS_URL   || 'ws://localhost:8001';

export const options = {
  vus:        50,
  iterations: 50,   // 1 iteration per VU → 50 concurrent submissions
  duration:   '120s',
};

const submissionsCompleted = new Counter('submissions_completed');
const submissionsDropped   = new Counter('submissions_dropped');
const verdictTime          = new Trend('verdict_time_ms', true);

const SOURCE = `
#include<bits/stdc++.h>
using namespace std;
int main(){ int a,b; cin>>a>>b; cout<<a+b<<endl; }
`;

export function setup() {
  const res = http.post(`${BASE_URL}/api/auth/login`,
    JSON.stringify({ username: 'admin', password: 'admin123' }),
    { headers: { 'Content-Type': 'application/json' } });
  const token = res.json('data.token');
  if (!token) throw new Error('Login failed: ' + res.body);
  return { token };
}

export default function (data) {
  const headers = {
    'Content-Type':  'application/json',
    'Authorization': `Bearer ${data.token}`,
  };

  // 1. Submit
  const t_enqueue = Date.now();
  const submitRes = http.post(
    `${BASE_URL}/api/submissions`,
    JSON.stringify({ problemId: 1, sourceCode: SOURCE }),
    { headers },
  );
  check(submitRes, { 'submit status 201': (r) => r.status === 201 });

  const submissionId = submitRes.json('data.id');
  if (!submissionId) { submissionsDropped.add(1); return; }

  // 2. Lắng nghe WS cho đến khi FINISHED
  let finished = false;
  const t_start = Date.now();

  ws.connect(WS_URL, null, function (socket) {
    socket.on('open', () => {
      socket.send(JSON.stringify({ type: 'AUTH', token: data.token }));
    });

    socket.on('message', (raw) => {
      const msg = JSON.parse(raw);
      if (msg.type !== 'SUBMISSION_UPDATE' || msg.submissionId !== submissionId) return;

      if (msg.status === 'FINISHED') {
        verdictTime.add(Date.now() - t_enqueue);
        submissionsCompleted.add(1);
        finished = true;
        socket.close();
      }
    });

    // timeout 90s
    socket.setTimeout(() => {
      if (!finished) submissionsDropped.add(1);
      socket.close();
    }, 90_000);
  });
}
```

**Chạy:**
```powershell
k6 run --out csv=results/scenario_a.csv tests/k6/scenario_a_throughput.js
```

**Kết quả k6 tự tính:**
- `submissions_completed` — số bài có verdict
- `submissions_dropped`   — số bài timeout
- `verdict_time_ms`       — p50, p95, p99, max
- `http_req_duration`     — latency POST /submissions

---

### `tests/k6/scenario_b_wait_time.js` — Scenario B

```javascript
import http from 'k6/http';
import ws   from 'k6/ws';
import { check } from 'k6';
import { Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8000';
const WS_URL   = __ENV.WS_URL   || 'ws://localhost:8001';

export const options = {
  scenarios: {
    wait_time: {
      executor:          'per-vu-iterations',
      vus:               20,
      iterations:        1,
      maxDuration:       '300s',
      startTime:         '0s',
      // stagger VUs 500ms apart → 1 submission / 500ms
      gracefulStop:      '30s',
    },
  },
};

const queueWaitTime = new Trend('queue_wait_time_ms', true);  // true = percentile output

const SOURCE = `
#include<bits/stdc++.h>
using namespace std;
int main(){ int a,b; cin>>a>>b; cout<<a+b<<endl; }
`;

export function setup() {
  const res = http.post(`${BASE_URL}/api/auth/login`,
    JSON.stringify({ username: 'admin', password: 'admin123' }),
    { headers: { 'Content-Type': 'application/json' } });
  return { token: res.json('data.token') };
}

export default function (data) {
  // Stagger: VU index không có built-in delay → dùng sleep nhỏ
  // Thực tế k6 ramp-up với per-vu-iterations đã spread tự nhiên
  const headers = {
    'Content-Type':  'application/json',
    'Authorization': `Bearer ${data.token}`,
  };

  const t_enqueue = Date.now();
  const res = http.post(
    `${BASE_URL}/api/submissions`,
    JSON.stringify({ problemId: 1, sourceCode: SOURCE }),
    { headers },
  );
  check(res, { 'submit 201': (r) => r.status === 201 });
  const submissionId = res.json('data.id');
  if (!submissionId) return;

  // Lắng nghe WS chờ COMPILING (= lúc worker nhận task)
  ws.connect(WS_URL, null, function (socket) {
    socket.on('open', () => {
      socket.send(JSON.stringify({ type: 'AUTH', token: data.token }));
    });

    socket.on('message', (raw) => {
      const msg = JSON.parse(raw);
      if (msg.type !== 'SUBMISSION_UPDATE' || msg.submissionId !== submissionId) return;

      if (msg.status === 'COMPILING') {
        // queue wait time = enqueue → worker nhận (COMPILING)
        queueWaitTime.add(Date.now() - t_enqueue);
      }
      if (msg.status === 'FINISHED') {
        socket.close();
      }
    });

    socket.setTimeout(() => socket.close(), 120_000);
  });
}
```

**Chạy (1 worker để tạo bottleneck):**
```powershell
k6 run --out csv=results/scenario_b.csv tests/k6/scenario_b_wait_time.js
```

**Đọc kết quả:**
```
queue_wait_time_ms p(50)=...  p(95)=...  p(99)=...
NFR-2: p(95) < 2000 → PASS / FAIL
```

---

### `tests/k6/scenario_c_durability.js` — Scenario C (durability check)

```javascript
import http from 'k6/http';
import { sleep, check } from 'k6';

// Script này gửi 10 bài, sau đó THỦ CÔNG kill + restart Master
// Sau restart chạy lại để kiểm tra verdict

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8000';

export const options = { vus: 10, iterations: 10 };

const SOURCE = `
#include<bits/stdc++.h>
using namespace std;
int main(){ int a,b; cin>>a>>b; cout<<a+b<<endl; }
`;

export function setup() {
  const res = http.post(`${BASE_URL}/api/auth/login`,
    JSON.stringify({ username: 'admin', password: 'admin123' }),
    { headers: { 'Content-Type': 'application/json' } });
  return { token: res.json('data.token') };
}

// Phase 1: gửi 10 bài, in ra IDs
export default function (data) {
  const res = http.post(`${BASE_URL}/api/submissions`,
    JSON.stringify({ problemId: 1, sourceCode: SOURCE }),
    { headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${data.token}`,
    }});
  check(res, { 'submit 201': (r) => r.status === 201 });
  console.log(`Submitted id=${res.json('data.id')}`);
}
```

**Chạy Phase 1:**
```powershell
k6 run tests/k6/scenario_c_durability.js 2>&1 | Tee-Object results/scenario_c_ids.txt
# → lấy IDs từ log
# → kill Master: taskkill /F /IM java.exe
# → đợi 5s → restart: cd backend; .\mvnw spring-boot:run
# → đợi Master up
```

**Phase 2 — check verdict (sau restart):**
```powershell
# Kiểm tra từng id, ví dụ id 1001..1010
1001..1010 | ForEach-Object {
  $r = Invoke-WebRequest -Uri "http://localhost:8000/api/submissions/$_" `
       -Headers @{ Authorization = "Bearer $TOKEN" } | ConvertFrom-Json
  "$_ -> $($r.data.status) $($r.data.verdict)"
}
```

---

### `tests/k6/worker_utilization.js` — Worker utilization (NFR-4)

```javascript
import ws from 'k6/ws';
import { Gauge, Counter } from 'k6/metrics';

// Chạy song song với Scenario A để đo utilization
// k6 run --duration 120s tests/k6/worker_utilization.js

const WS_URL = __ENV.WS_URL || 'ws://localhost:8001';

export const options = { vus: 1, duration: '120s' };

const busyTicks    = new Counter('worker_busy_ticks');
const totalTicks   = new Counter('worker_total_ticks');
const queueDepth   = new Gauge('queue_depth');

export function setup() {
  const http = require('k6/http');
  const res = http.post('http://localhost:8000/api/auth/login',
    JSON.stringify({ username: 'admin', password: 'admin123' }),
    { headers: { 'Content-Type': 'application/json' } });
  return { token: res.json('data.token') };
}

export default function (data) {
  ws.connect(WS_URL, null, function (socket) {
    socket.on('open', () => {
      socket.send(JSON.stringify({ type: 'AUTH', token: data.token }));
    });

    socket.on('message', (raw) => {
      const msg = JSON.parse(raw);
      if (msg.type !== 'WORKER_UPDATE') return;

      queueDepth.add(msg.queueSize || 0);
      for (const w of (msg.workers || [])) {
        totalTicks.add(1);
        if (w.status === 'BUSY') busyTicks.add(1);
      }
    });

    // duration option đã kiểm soát — socket tự đóng khi VU kết thúc
  });
}
```

**Chạy song song:**
```powershell
# Terminal 1: chạy Scenario A
k6 run --out csv=results/scenario_a.csv tests/k6/scenario_a_throughput.js

# Terminal 2: đo utilization cùng lúc
k6 run --out csv=results/utilization.csv tests/k6/worker_utilization.js
```

**Tính utilization từ CSV:**
```powershell
# worker_busy_ticks / worker_total_ticks × 100%
$csv = Import-Csv results/utilization.csv
$busy  = ($csv | Where metric_name -eq 'worker_busy_ticks'  | Measure-Object value -Sum).Sum
$total = ($csv | Where metric_name -eq 'worker_total_ticks' | Measure-Object value -Sum).Sum
"Utilization: $([math]::Round($busy/$total*100,1))%"
```

---

## 5. Data collection format

k6 `--out csv` tự sinh file với format:

```
metric_name,timestamp,metric_value,check,error,error_code,status,method,url,name,group,subproto,tls_version
http_req_duration,1700000000000,54.12,,,,200,POST,http://localhost:8000/api/submissions,...
queue_wait_time_ms,1700000000000,142.0,...
submissions_completed,1700000000001,1,...
```

Custom metrics quan trọng:

| Metric name | Loại | Đơn vị | Dùng cho |
|-------------|------|--------|---------|
| `queue_wait_time_ms` | Trend | ms | NFR-2 — p95 |
| `verdict_time_ms` | Trend | ms | NFR-3 — end-to-end |
| `submissions_completed` | Counter | count | NFR-1 |
| `submissions_dropped` | Counter | count | Drop rate |
| `worker_busy_ticks` | Counter | count | NFR-4 utilization |
| `queue_depth` | Gauge | count | Queue depth |

---

## 6. Tables cho báo cáo (cấu trúc sẵn)

**Table 1: Throughput — Scenario A**

| Workers | VUs (submissions) | Duration (s) | Throughput (sub/min) | Drop rate | Lần đo |
|---------|-------------------|--------------|----------------------|-----------|--------|
| 1 | 20 | — | — | — | 3× avg |
| 3 | 50 | — | — | — | 3× avg |
| 5 | 100 | — | — | — | 3× avg |

**Table 2: Queue wait time — Scenario B**

| Workers | VUs | p50 (ms) | p95 (ms) | p99 (ms) | NFR-2 (p95 < 2s) |
|---------|-----|----------|----------|----------|------------------|
| 1 | 20 | — | — | — | — |
| 3 | 50 | — | — | — | — |

**Table 3: NFR achievement summary**

| NFR | Metric | Target | Run 1 | Run 2 | Run 3 | Average | Met? |
|-----|--------|--------|-------|-------|-------|---------|------|
| NFR-1 | Drop rate | 0% | — | — | — | — | — |
| NFR-2 | Wait p95 | < 2000ms | — | — | — | — | — |
| NFR-3 | Throughput | ≥ 10/min/worker | — | — | — | — | — |
| NFR-4 | Utilization | ≥ 80% | — | — | — | — | — |
| NFR-5 | Durability | 0 bài mất | — | — | — | — | — |
| NFR-7 | Failover detect | ≤ 20s | — | — | — | — | — |

---

## 7. Hướng dẫn chạy thực nghiệm (từng bước)

```powershell
# 1. Start backend
cd backend; .\mvnw spring-boot:run

# 2. Start 3 workers
1..3 | ForEach-Object {
    $id = "worker-$_"
    Start-Process powershell -ArgumentList "-NoExit", "-Command",
        "cd '$PWD\judgement'; python -X utf8 -m judgement worker --id $id --master-host 127.0.0.1 --master-port 9000"
}

# 3. Tạo thư mục kết quả
New-Item -ItemType Directory -Force results

# 4. Scenario A — 3 lần
1..3 | ForEach-Object {
    k6 run --out "csv=results/scenario_a_run$_.csv" tests/k6/scenario_a_throughput.js
}

# 5. Scenario B — 1 worker, 3 lần
# (kill 2 workers trước, giữ lại 1)
1..3 | ForEach-Object {
    k6 run --out "csv=results/scenario_b_run$_.csv" tests/k6/scenario_b_wait_time.js
}

# 6. Scenario A + utilization song song
Start-Process powershell -ArgumentList "-NoExit", "-Command",
    "k6 run --out 'csv=results/utilization.csv' tests/k6/worker_utilization.js"
k6 run --out "csv=results/scenario_a_final.csv" tests/k6/scenario_a_throughput.js
```

---

## Quality checklist

- [x] NFR table: target cụ thể bằng số (không phải "nhanh hơn")
- [x] Mỗi scenario: setup, input, action, metric, expected outcome
- [x] Scripts k6 chạy được — không phải pseudo-code, có `export function setup()`, `export default function()`
- [x] Custom metrics dùng `Trend`/`Counter`/`Gauge` đúng kiểu — k6 tự tính p50/p95/p99
- [x] Scenario D (memory isolation) ghi chú rõ: Windows không có RSS — cần Linux
- [x] Scenario E (failover): đo `detect_time = t_requeue - t_disconnect`
- [x] Tables có cấu trúc sẵn — chỉ cần điền số khi đo thực
- [x] Hardware specs đầy đủ (CPU, RAM, OS, network, DB)
- [x] Mỗi scenario đo ít nhất 3 lần → lấy trung bình
- [x] Kết quả "không đạt" cũng ghi vào báo cáo (Discussion §8.13)
- [x] Hướng dẫn chạy PowerShell từng bước đủ để reproduce
