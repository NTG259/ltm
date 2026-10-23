/**
 * Scenario C — Queue durability after Master restart
 *
 * Submits 10 submissions, then waits for user to kill+restart Master,
 * then verifies all 10 submissions eventually get a terminal verdict.
 *
 * This is a semi-manual scenario: after the script prints "PAUSE",
 * restart the Master process, then press Enter in the k6 terminal (or
 * set PAUSE_SECONDS to a fixed wait time).
 *
 * Run:
 *   k6 run -e K6_TOKEN=<token> -e PAUSE_SECONDS=30 scenario_c_durability.js
 */

import http from "k6/http";
import { sleep, check } from "k6";
import { Counter } from "k6/metrics";

const recovered = new Counter("recovered_after_restart");
const lost = new Counter("lost_after_restart");

export const options = {
  scenarios: {
    durability_test: {
      executor: "shared-iterations",
      vus: 1,
      iterations: 1,
      maxDuration: "10m",
    },
  },
  thresholds: {
    lost_after_restart: ["count<1"], // no submissions lost
  },
};

const BASE = __ENV.BASE_URL || "http://localhost:8000";
const TOKEN = __ENV.K6_TOKEN || "";
const PAUSE_SECONDS = parseInt(__ENV.PAUSE_SECONDS || "30", 10);

const SOURCE = `
#include<bits/stdc++.h>
using namespace std;
int main(){ int a,b; cin>>a>>b; cout<<a+b<<endl; }
`;

export default function () {
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${TOKEN}`,
  };

  // Submit 10 submissions
  const ids = [];
  for (let i = 0; i < 10; i++) {
    const res = http.post(
      `${BASE}/api/submissions`,
      JSON.stringify({ problemId: 1, sourceCode: SOURCE, language: "cpp17" }),
      { headers }
    );
    if (res.status === 200 || res.status === 201) {
      const sub = res.json();
      if (sub && sub.id) ids.push(sub.id);
    }
    sleep(0.2);
  }

  console.log(`Submitted ${ids.length} submissions: ${ids.join(", ")}`);
  console.log(`Pausing ${PAUSE_SECONDS}s — restart Master now!`);
  sleep(PAUSE_SECONDS);
  console.log("Resuming — polling for verdicts...");

  // Poll all submissions for up to 5 minutes
  const terminal = new Set(["AC", "WA", "TLE", "MLE", "RTE", "CE", "SEC", "FAILED"]);
  const results = {};

  for (let attempt = 0; attempt < 90; attempt++) {
    sleep(3);
    let allDone = true;
    for (const id of ids) {
      if (results[id]) continue;
      const poll = http.get(`${BASE}/api/submissions/${id}`, { headers });
      if (poll.status === 200) {
        const s = poll.json();
        const st = s.status || s.verdict || "";
        if (terminal.has(st)) {
          results[id] = st;
          console.log(`Submission ${id}: ${st}`);
        } else {
          allDone = false;
        }
      } else {
        allDone = false;
      }
    }
    if (allDone) break;
  }

  for (const id of ids) {
    if (results[id]) {
      recovered.add(1);
      check(results[id], { "recovered with verdict": (v) => terminal.has(v) });
    } else {
      lost.add(1);
      console.error(`Submission ${id} never got a verdict!`);
      check(null, { "recovered with verdict": () => false });
    }
  }
}
