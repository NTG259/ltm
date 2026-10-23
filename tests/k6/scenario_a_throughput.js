/**
 * Scenario A — Throughput under concurrent load
 *
 * 50 VUs submit in parallel for 2 minutes.
 * Measures: submission drop rate, verdict_time_ms p95.
 *
 * Prerequisites:
 *   - Backend running on localhost:8000
 *   - At least 1 judge worker online
 *   - Problem ID 1 exists with ≥1 test case
 *   - Admin token set via env: K6_TOKEN=<bearer>
 *
 * Run:
 *   k6 run -e K6_TOKEN=<token> scenario_a_throughput.js
 */

import http from "k6/http";
import { sleep, check } from "k6";
import { Trend, Counter } from "k6/metrics";

const verdictTime = new Trend("verdict_time_ms", true);
const submitErrors = new Counter("submit_errors");
const queueDrops = new Counter("queue_drops");

export const options = {
  scenarios: {
    concurrent_submit: {
      executor: "constant-vus",
      vus: 50,
      duration: "2m",
    },
  },
  thresholds: {
    verdict_time_ms: ["p(95)<30000"], // p95 verdict within 30s
    submit_errors: ["count<10"],       // fewer than 10 HTTP errors
  },
};

const BASE = __ENV.BASE_URL || "http://localhost:8000";
const TOKEN = __ENV.K6_TOKEN || "";

const AC_SOURCE = `
#include<bits/stdc++.h>
using namespace std;
int main(){
  int a,b; cin>>a>>b; cout<<a+b<<endl;
}
`;

export default function () {
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${TOKEN}`,
  };

  // Submit
  const tStart = Date.now();
  const res = http.post(
    `${BASE}/api/submissions`,
    JSON.stringify({
      problemId: 1,
      sourceCode: AC_SOURCE,
      language: "cpp17",
    }),
    { headers }
  );

  if (res.status !== 200 && res.status !== 201) {
    submitErrors.add(1);
    sleep(1);
    return;
  }

  const sub = res.json();
  if (!sub || !sub.id) {
    submitErrors.add(1);
    return;
  }

  // Poll until terminal verdict (max 60s)
  let verdict = null;
  for (let i = 0; i < 30; i++) {
    sleep(2);
    const poll = http.get(`${BASE}/api/submissions/${sub.id}`, { headers });
    if (poll.status === 200) {
      const s = poll.json();
      const terminal = ["AC", "WA", "TLE", "MLE", "RTE", "CE", "SEC", "FAILED"];
      if (terminal.includes(s.status || s.verdict)) {
        verdict = s.status || s.verdict;
        break;
      }
    }
  }

  if (!verdict) {
    queueDrops.add(1);
  } else {
    verdictTime.add(Date.now() - tStart);
  }

  check(verdict, { "got verdict": (v) => v !== null });
  sleep(1);
}
