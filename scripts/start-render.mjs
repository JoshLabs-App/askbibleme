import { spawn } from "node:child_process";

const port = process.env.PORT || "3000";
const enabled = process.env.BINANCE_TESTNET_AUTOTRADE_ENABLED === "1";
const cronSecret = process.env.INVEST_AUTOTRADE_CRON_SECRET?.trim();
const intervalMs = 5 * 60 * 1000;
let stopped = false;
let timer = null;
let running = false;

const nextBin = new URL("../node_modules/next/dist/bin/next", import.meta.url);
const child = spawn(process.execPath, [nextBin.pathname, "start", "--hostname", "0.0.0.0", "--port", port], {
  env: process.env,
  stdio: "inherit",
});

async function runStrategy() {
  if (stopped || running || !enabled || !cronSecret) return;
  running = true;
  try {
    const response = await fetch(
      `http://127.0.0.1:${port}/api/invest/testnet/automation/run`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${cronSecret}` },
        signal: AbortSignal.timeout(30_000),
      },
    );
    const payload = await response.json().catch(() => null);
    const action = payload?.decision?.action ?? "UNKNOWN";
    console.log(
      `[invest-auto] ${new Date().toISOString()} status=${response.status} action=${action}`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    console.error(`[invest-auto] ${new Date().toISOString()} ${message}`);
  } finally {
    running = false;
  }
}

if (enabled && cronSecret) {
  console.log("[invest-auto] Binance Spot Testnet scheduler enabled (5 minutes)");
  timer = setTimeout(() => {
    void runStrategy();
    timer = setInterval(() => void runStrategy(), intervalMs);
  }, 20_000);
} else {
  console.log("[invest-auto] scheduler disabled");
}

function shutdown(signal) {
  if (stopped) return;
  stopped = true;
  if (timer) clearTimeout(timer);
  child.kill(signal);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
child.on("exit", (code, signal) => {
  const wasStopping = stopped;
  stopped = true;
  if (timer) clearTimeout(timer);
  process.exit(wasStopping ? 0 : code ?? (signal ? 1 : 1));
});
