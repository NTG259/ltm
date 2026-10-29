/**
 * 1000 submissions — đo khả năng chịu tải thực tế
 * 200 VU submit song song, tổng đúng 1000 bài.
 * Đo: tỉ lệ nhận verdict, verdict_time_ms p95, submit errors.
 */

import http from "k6/http";
import { sleep, check } from "k6";
import { Trend, Counter } from "k6/metrics";

const verdictTime = new Trend("verdict_time_ms", true);
const submitErrors = new Counter("submit_errors");
const queueDrops = new Counter("queue_drops");

export const options = {
  scenarios: {
    thousand_submit: {
      executor: "shared-iterations",
      vus: 200,
      iterations: 1000,
      maxDuration: "10m",
    },
  },
  thresholds: {
    verdict_time_ms: ["p(95)<300000"], // p95 verdict trong 5 phút
    submit_errors:   ["count<50"],     // < 5% lỗi
  },
};

const BASE  = __ENV.BASE_URL || "http://localhost:18000";
const TOKEN = __ENV.K6_TOKEN || "";

const AC_SOURCE = `
#include<bits/stdc++.h>
using namespace std;
int main(){ int a,b; cin>>a>>b; cout<<a+b<<endl; }
`;

export default function () {
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${TOKEN}`,
  };

  const tStart = Date.now();
  const res = http.post(
    `${BASE}/api/submissions`,
    JSON.stringify({ problemId: 1, sourceCode: AC_SOURCE, language: "cpp17" }),
    { headers }
  );

  if (res.status !== 200 && res.status !== 201) {
    submitErrors.add(1);
    sleep(1);
    return;
  }

  const sub = res.json();
  if (!sub || !sub.id) { submitErrors.add(1); return; }

  // Poll tối đa 5 phút
  const terminal = new Set(["AC","WA","TLE","MLE","RTE","CE","SEC","FAILED","FINISHED"]);
  let verdict = null;
  for (let i = 0; i < 150; i++) {
    sleep(2);
    const poll = http.get(`${BASE}/api/submissions/${sub.id}`, { headers });
    if (poll.status === 200) {
      const s = poll.json();
      if (terminal.has(s.status) || terminal.has(s.verdict)) {
        verdict = s.verdict || s.status;
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
}
