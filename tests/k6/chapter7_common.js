import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';

const postMs = new Trend('submission_post_ms', true);
const verdictMs = new Trend('verdict_time_ms', true);
const queueMs = new Trend('queue_wait_ms', true);
const postErrors = new Counter('submission_post_errors');
const terminalTimeouts = new Counter('submission_terminal_timeouts');
const finishedCount = new Counter('submission_finished');
const failedCount = new Counter('submission_failed');

const source = '#include <iostream>\nint main(){long long a,b;std::cin>>a>>b;std::cout<<a+b<<"\\n";}\n';
const base = __ENV.BASE_URL || 'http://127.0.0.1:18000';

export function submitAndObserve() {
  if (!__ENV.K6_TOKEN || !__ENV.RUN_ID) throw new Error('K6_TOKEN and RUN_ID are required');
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${__ENV.K6_TOKEN}` };
  const started = Date.now();
  const response = http.post(`${base}/api/submissions`, JSON.stringify({
    problemId: Number(__ENV.PROBLEM_ID || 1), language: 'cpp17',
    sourceCode: `// chapter7 run_id=${__ENV.RUN_ID}\n${source}`,
  }), { headers, tags: { name: 'POST /api/submissions', run_id: __ENV.RUN_ID } });
  postMs.add(response.timings.duration);
  let id = null;
  try { if (response.status === 200) id = response.json('id'); } catch (_) { id = null; }
  if (response.status !== 200 || !id) {
    postErrors.add(1);
    check(response, { 'POST accepted with ID': () => false });
    return;
  }
  console.log(`CHAPTER7_SUBMISSION ${__ENV.RUN_ID} ${id}`);
  const deadline = started + Number(__ENV.OBSERVE_MS || 300000);
  while (Date.now() < deadline) {
    sleep(0.5);
    const poll = http.get(`${base}/api/submissions/${id}`, {
      headers, tags: { name: 'GET /api/submissions/{id}', run_id: __ENV.RUN_ID },
    });
    if (poll.status !== 200) continue;
    const s = poll.json();
    if (s.status !== 'FINISHED' && s.status !== 'FAILED') continue;
    const assigned = (s.history || []).find(e => e.status === 'ASSIGNED');
    const requeued = (s.history || []).filter(e => e.status === 'REQUEUED' && (!assigned || e.time < assigned.time));
    const origin = requeued.length ? requeued[requeued.length - 1].time : s.createdAt;
    if (assigned && origin) queueMs.add(assigned.time - origin);
    verdictMs.add(Date.now() - s.createdAt);
    if (s.status === 'FINISHED') finishedCount.add(1); else failedCount.add(1);
    check(s, { 'finished with AC': x => x.status === 'FINISHED' && x.verdict === 'AC' });
    return;
  }
  terminalTimeouts.add(1);
  check(null, { 'terminal before observation deadline': () => false });
}
