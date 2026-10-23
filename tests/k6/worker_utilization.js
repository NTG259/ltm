/**
 * Worker Utilization Monitor
 *
 * Connects to the WebSocket endpoint and counts BUSY/IDLE ticks per worker
 * over a 2-minute window while Scenario A runs concurrently.
 *
 * Outputs:
 *   - worker_busy_ticks: total BUSY heartbeat ticks across all workers
 *   - worker_idle_ticks: total IDLE heartbeat ticks
 *   - utilization ratio = busy / (busy + idle)
 *
 * Run alongside Scenario A:
 *   k6 run -e K6_TOKEN=<token> worker_utilization.js
 */

import ws from "k6/ws";
import { sleep, check } from "k6";
import { Counter, Gauge } from "k6/metrics";

const busyTicks = new Counter("worker_busy_ticks");
const idleTicks = new Counter("worker_idle_ticks");
const activeWorkers = new Gauge("active_workers");

export const options = {
  scenarios: {
    ws_monitor: {
      executor: "constant-vus",
      vus: 1,
      duration: "2m",
    },
  },
  thresholds: {
    worker_busy_ticks: ["count>0"], // at least some work happened
  },
};

const BASE_WS = __ENV.WS_URL || "ws://localhost:8001";
const TOKEN = __ENV.K6_TOKEN || "";

export default function () {
  const url = `${BASE_WS}?token=${TOKEN}`;

  const res = ws.connect(url, {}, function (socket) {
    socket.on("open", () => {
      console.log("WebSocket connected");
    });

    socket.on("message", (data) => {
      let msg;
      try {
        msg = JSON.parse(data);
      } catch {
        return;
      }

      if (msg.type === "WORKER_UPDATE" && Array.isArray(msg.workers)) {
        let busy = 0;
        let idle = 0;
        for (const w of msg.workers) {
          if (w.status === "BUSY") busy++;
          else if (w.status === "IDLE") idle++;
        }
        busyTicks.add(busy);
        idleTicks.add(idle);
        activeWorkers.add(msg.workers.filter((w) => w.status !== "DEAD").length);
      }
    });

    socket.on("error", (e) => {
      console.error("WS error:", e.error());
    });

    socket.on("close", () => {
      console.log("WebSocket closed");
    });

    // Hold connection for duration
    socket.setTimeout(() => {
      socket.close();
    }, 115000); // 115s < 2m duration
  });

  check(res, { "WS connected (101)": (r) => r && r.status === 101 });
}
