/**
 * Scenario B — Queue wait time with single-worker bottleneck
 *
 * 1 judge worker, 20 submissions queued in burst.
 * Measures: queue_wait_ms p95 (time from submit to COMPILING/TESTING state).
 *
 * Run:
 *   k6 run -e K6_TOKEN=<token> scenario_b_wait_time.js
 */

import http from "k6/http";
import { sleep, check } from "k6";
import { Trend, Counter } from "k6/metrics";

const queueWait = new Trend("queue_wait_ms", true);
const submitErrors = new Counter("submit_errors_b");

export const options = {
  scenarios: {
    burst_submit: {
      executor: "shared-iterations",
      vus: 20,
      iterations: 20,
      maxDuration: "3m",
    },
  },
  thresholds: {
    queue_wait_ms: ["p(95)<60000"], // p95 wait under 60s
    submit_errors_b: ["count<5"],
  },
};

const BASE = __ENV.BASE_URL || "http://localhost:8000";
const TOKEN = __ENV.K6_TOKEN || "";

const SLOW_SOURCE = `
#include<bits/stdc++.h>
using namespace std;
int main(){
  int a,b; cin>>a>>b;
  // Simulate light computation
  long long s=0;
  for(int i=0;i<1000000;i++) s+=i;
  cout<<a+b<<endl;
}
`;

export default function () {
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${TOKEN}`,
  };

  const tSubmit = Date.now();
  const res = http.post(
    `${BASE}/api/submissions`,
    JSON.stringify({
      problemId: 1,
      sourceCode: SLOW_SOURCE,
      language: "cpp17",
    }),
    { headers }
  );

  if (res.status !== 200 && res.status !== 201) {
    submitErrors.add(1);
    return;
  }

  const sub = res.json();
  if (!sub || !sub.id) {
    submitErrors.add(1);
    return;
  }

  // Poll until leaves IN_QUEUE (worker picks it up)
  for (let i = 0; i < 60; i++) {
    sleep(1);
    const poll = http.get(`${BASE}/api/submissions/${sub.id}`, { headers });
    if (poll.status === 200) {
      const s = poll.json();
      const status = s.status || "";
      if (status !== "IN_QUEUE") {
        queueWait.add(Date.now() - tSubmit);
        check(status, { "left queue": (st) => st !== "IN_QUEUE" });
        return;
      }
    }
  }

  // Timed out waiting for dispatch
  check(null, { "left queue": () => false });
}
