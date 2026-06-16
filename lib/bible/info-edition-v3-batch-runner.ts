import "server-only";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
  infoEditionV3BatchLockPath,
  infoEditionV3BatchLogPath,
  infoEditionV3BatchUiConfigPath,
} from "@/lib/bible/info-edition-v3-batch-paths";
import {
  readInfoEditionV3BatchState,
  writeInfoEditionV3BatchState,
} from "@/lib/bible/info-edition-v3-batch-state";

export type InfoEditionV3BatchUiConfig = {
  bookStart: string;
  bookEnd: string;
  delayMs: number;
  skipCorrected: boolean;
};

const DEFAULT_UI_CONFIG: InfoEditionV3BatchUiConfig = {
  bookStart: "",
  bookEnd: "",
  delayMs: 1200,
  skipCorrected: true,
};

export function readV3BatchUiConfig(cwd: string): InfoEditionV3BatchUiConfig {
  const p = infoEditionV3BatchUiConfigPath(cwd);
  if (!fs.existsSync(p)) return { ...DEFAULT_UI_CONFIG };
  try {
    const raw = JSON.parse(fs.readFileSync(p, "utf8")) as Partial<InfoEditionV3BatchUiConfig>;
    return {
      bookStart: typeof raw.bookStart === "string" ? raw.bookStart.trim().toUpperCase() : "",
      bookEnd: typeof raw.bookEnd === "string" ? raw.bookEnd.trim().toUpperCase() : "",
      delayMs:
        typeof raw.delayMs === "number" && raw.delayMs >= 0
          ? Math.min(raw.delayMs, 60_000)
          : DEFAULT_UI_CONFIG.delayMs,
      skipCorrected: typeof raw.skipCorrected === "boolean" ? raw.skipCorrected : true,
    };
  } catch {
    return { ...DEFAULT_UI_CONFIG };
  }
}

export function writeV3BatchUiConfig(cwd: string, config: InfoEditionV3BatchUiConfig): void {
  const p = infoEditionV3BatchUiConfigPath(cwd);
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(p, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

export function readV3BatchLockPid(cwd: string): number | null {
  const lock = infoEditionV3BatchLockPath(cwd);
  if (!fs.existsSync(lock)) return null;
  const pid = Number(fs.readFileSync(lock, "utf8").trim());
  return Number.isInteger(pid) && pid > 0 ? pid : null;
}

export function isV3BatchProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function readV3BatchLogTail(cwd: string, lines = 60): string[] {
  const p = infoEditionV3BatchLogPath(cwd);
  if (!fs.existsSync(p)) return [];
  const text = fs.readFileSync(p, "utf8");
  return text.split("\n").filter(Boolean).slice(-lines);
}

export function reconcileV3BatchRunningFlag(cwd: string): boolean {
  const state = readInfoEditionV3BatchState(cwd);
  const pid = readV3BatchLockPid(cwd);
  const alive = pid !== null && isV3BatchProcessAlive(pid);
  if (state.running !== alive) {
    state.running = alive;
    writeInfoEditionV3BatchState(cwd, state);
  }
  return alive;
}

export type StartV3BatchOptions = {
  force?: boolean;
  fullBible?: boolean;
  bookStart?: string;
  bookEnd?: string;
  delayMs?: number;
  skipCorrected?: boolean;
};

export function startV3BatchProcess(
  cwd: string,
  opts: StartV3BatchOptions = {},
): { ok: true; pid: number } | { ok: false; error: string } {
  const pid = readV3BatchLockPid(cwd);
  if (pid !== null && isV3BatchProcessAlive(pid)) {
    return { ok: false, error: `V3 批量纠错已在运行（PID ${pid}）` };
  }

  const ui = readV3BatchUiConfig(cwd);
  const config: InfoEditionV3BatchUiConfig = {
    bookStart: opts.fullBible ? "" : (opts.bookStart ?? ui.bookStart),
    bookEnd: opts.fullBible ? "" : (opts.bookEnd ?? ui.bookEnd),
    delayMs: opts.delayMs ?? ui.delayMs,
    skipCorrected: opts.skipCorrected ?? ui.skipCorrected,
  };
  writeV3BatchUiConfig(cwd, config);

  const tsx = path.join(cwd, "node_modules", ".bin", "tsx");
  const script = path.join(cwd, "scripts", "batch-info-edition-v3-correction.ts");
  if (!fs.existsSync(tsx) || !fs.existsSync(script)) {
    return { ok: false, error: "找不到 tsx 或 V3 批量脚本，请先 npm install。" };
  }

  const logPath = infoEditionV3BatchLogPath(cwd);
  const logDir = path.dirname(logPath);
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
  const logFd = fs.openSync(logPath, "a");
  fs.writeSync(logFd, `\n--- v3 batch start ${new Date().toISOString()} ---\n`);

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: "development",
    INFO_EDITION_V3_BATCH_DELAY_MS: String(config.delayMs),
    INFO_EDITION_V3_BATCH_SKIP_CORRECTED: config.skipCorrected ? "1" : "0",
  };
  if (opts.force) env.INFO_EDITION_V3_BATCH_FORCE = "1";
  if (config.bookStart) env.INFO_EDITION_V3_BATCH_BOOK_START = config.bookStart;
  if (config.bookEnd) env.INFO_EDITION_V3_BATCH_BOOK_END = config.bookEnd;

  const shim = path.join(cwd, "scripts", "register-server-only.cjs");
  const child = spawn(tsx, [script], {
    cwd,
    detached: true,
    stdio: ["ignore", logFd, logFd],
    env: {
      ...env,
      NODE_OPTIONS: [process.env.NODE_OPTIONS, `--require ${shim}`].filter(Boolean).join(" "),
    },
  });
  fs.closeSync(logFd);
  child.unref();

  if (!child.pid) {
    return { ok: false, error: "无法启动子进程。" };
  }

  const state = readInfoEditionV3BatchState(cwd);
  state.running = true;
  state.force = opts.force === true;
  state.skipCorrected = config.skipCorrected;
  writeInfoEditionV3BatchState(cwd, state);

  return { ok: true, pid: child.pid };
}

export function stopV3BatchProcess(cwd: string): { ok: boolean; error?: string } {
  const pid = readV3BatchLockPid(cwd);
  if (pid === null || !isV3BatchProcessAlive(pid)) {
    const state = readInfoEditionV3BatchState(cwd);
    state.running = false;
    writeInfoEditionV3BatchState(cwd, state);
    try {
      const lock = infoEditionV3BatchLockPath(cwd);
      if (fs.existsSync(lock)) fs.unlinkSync(lock);
    } catch {
      /* ignore */
    }
    return { ok: true };
  }
  try {
    process.kill(pid, "SIGTERM");
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}
