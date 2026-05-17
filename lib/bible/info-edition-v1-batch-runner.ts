import "server-only";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
  infoEditionBatchLockPath,
  readInfoEditionBatchState,
  writeInfoEditionBatchState,
} from "@/lib/bible/info-edition-v1-batch-state";
import type { InfoEditionReaderVariant } from "@/lib/bible/info-edition-v1-publish";

export const INFO_EDITION_BATCH_LOG_REL = path.join("data", "bible", "info-edition-v1-batch.log");
export const INFO_EDITION_BATCH_UI_CONFIG_REL = path.join(
  "data",
  "bible",
  "info-edition-v1-batch-ui.json",
);

export type InfoEditionBatchUiConfig = {
  remoteScpTarget: string;
  pushEachBook: boolean;
  bookStart: string;
  delayMs: number;
  editions: InfoEditionReaderVariant[];
};

const DEFAULT_UI_CONFIG: InfoEditionBatchUiConfig = {
  remoteScpTarget: "",
  pushEachBook: false,
  bookStart: "",
  delayMs: 800,
  editions: ["info", "guide"],
};

function abs(cwd: string, rel: string): string {
  return path.join(cwd, rel);
}

export function readBatchUiConfig(cwd: string): InfoEditionBatchUiConfig {
  const p = abs(cwd, INFO_EDITION_BATCH_UI_CONFIG_REL);
  if (!fs.existsSync(p)) return { ...DEFAULT_UI_CONFIG };
  try {
    const raw = JSON.parse(fs.readFileSync(p, "utf8")) as Partial<InfoEditionBatchUiConfig>;
    const editions = Array.isArray(raw.editions)
      ? raw.editions.filter((e): e is InfoEditionReaderVariant => e === "info" || e === "guide")
      : DEFAULT_UI_CONFIG.editions;
    return {
      remoteScpTarget:
        typeof raw.remoteScpTarget === "string" ? raw.remoteScpTarget.trim() : "",
      pushEachBook: raw.pushEachBook === true,
      bookStart: typeof raw.bookStart === "string" ? raw.bookStart.trim().toUpperCase() : "",
      delayMs:
        typeof raw.delayMs === "number" && raw.delayMs >= 0
          ? Math.min(raw.delayMs, 60_000)
          : DEFAULT_UI_CONFIG.delayMs,
      editions: editions.length ? editions : DEFAULT_UI_CONFIG.editions,
    };
  } catch {
    return { ...DEFAULT_UI_CONFIG };
  }
}

export function writeBatchUiConfig(cwd: string, config: InfoEditionBatchUiConfig): void {
  const p = abs(cwd, INFO_EDITION_BATCH_UI_CONFIG_REL);
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(p, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

export function readBatchLockPid(cwd: string): number | null {
  const lock = infoEditionBatchLockPath(cwd);
  if (!fs.existsSync(lock)) return null;
  const pid = Number(fs.readFileSync(lock, "utf8").trim());
  return Number.isInteger(pid) && pid > 0 ? pid : null;
}

export function isBatchProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function readBatchLogTail(cwd: string, lines = 48): string[] {
  const p = abs(cwd, INFO_EDITION_BATCH_LOG_REL);
  if (!fs.existsSync(p)) return [];
  const text = fs.readFileSync(p, "utf8");
  return text.split("\n").filter(Boolean).slice(-lines);
}

export function reconcileBatchRunningFlag(cwd: string): boolean {
  const editions: InfoEditionReaderVariant[] = ["info", "guide"];
  const state = readInfoEditionBatchState(cwd, editions);
  const pid = readBatchLockPid(cwd);
  const alive = pid !== null && isBatchProcessAlive(pid);
  if (state.running !== alive) {
    state.running = alive;
    writeInfoEditionBatchState(cwd, state);
  }
  return alive;
}

export type StartBatchOptions = {
  force?: boolean;
  pushEachBook?: boolean;
  bookStart?: string;
  delayMs?: number;
  editions?: InfoEditionReaderVariant[];
  remoteScpTarget?: string;
};

export function startBatchProcess(
  cwd: string,
  opts: StartBatchOptions = {},
): { ok: true; pid: number } | { ok: false; error: string } {
  const pid = readBatchLockPid(cwd);
  if (pid !== null && isBatchProcessAlive(pid)) {
    return { ok: false, error: `批量任务已在运行（PID ${pid}）` };
  }

  const ui = readBatchUiConfig(cwd);
  const config: InfoEditionBatchUiConfig = {
    ...ui,
    pushEachBook: opts.pushEachBook ?? ui.pushEachBook,
    bookStart: opts.bookStart ?? ui.bookStart,
    delayMs: opts.delayMs ?? ui.delayMs,
    editions: opts.editions ?? ui.editions,
    remoteScpTarget: opts.remoteScpTarget ?? ui.remoteScpTarget,
  };
  writeBatchUiConfig(cwd, config);

  const tsx = path.join(cwd, "node_modules", ".bin", "tsx");
  const script = path.join(cwd, "scripts", "batch-info-edition-volumes.ts");
  if (!fs.existsSync(tsx) || !fs.existsSync(script)) {
    return { ok: false, error: "找不到 tsx 或批量脚本，请先 npm install。" };
  }

  const logPath = abs(cwd, INFO_EDITION_BATCH_LOG_REL);
  const logDir = path.dirname(logPath);
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
  const logFd = fs.openSync(logPath, "a");
  fs.writeSync(
    logFd,
    `\n--- batch start ${new Date().toISOString()} ---\n`,
  );

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    INFO_EDITION_BATCH_EDITIONS: config.editions.join(","),
    INFO_EDITION_BATCH_DELAY_MS: String(config.delayMs),
  };
  if (opts.force) env.INFO_EDITION_BATCH_FORCE = "1";
  if (config.bookStart) env.INFO_EDITION_BATCH_BOOK_START = config.bookStart;
  if (config.pushEachBook) env.INFO_EDITION_BATCH_PUSH_EACH_BOOK = "1";
  if (config.remoteScpTarget) {
    env.INFO_EDITION_REMOTE_SCP_TARGET = config.remoteScpTarget;
  }

  const child = spawn(tsx, [script], {
    cwd,
    detached: true,
    stdio: ["ignore", logFd, logFd],
    env,
  });
  fs.closeSync(logFd);
  child.unref();

  if (!child.pid) {
    return { ok: false, error: "无法启动子进程。" };
  }

  return { ok: true, pid: child.pid };
}

export function stopBatchProcess(cwd: string): { ok: boolean; error?: string } {
  const pid = readBatchLockPid(cwd);
  if (pid === null || !isBatchProcessAlive(pid)) {
    const editions: InfoEditionReaderVariant[] = ["info", "guide"];
    const state = readInfoEditionBatchState(cwd, editions);
    state.running = false;
    writeInfoEditionBatchState(cwd, state);
    try {
      const lock = infoEditionBatchLockPath(cwd);
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

export function pushPublishedToRemote(
  cwd: string,
  target?: string,
): { ok: boolean; error?: string } {
  const ui = readBatchUiConfig(cwd);
  const scp = target?.trim() || ui.remoteScpTarget.trim();
  if (!scp) {
    return { ok: false, error: "请填写 Render SSH 目标路径（SCP）。" };
  }
  const script = path.join(cwd, "scripts", "push-info-edition-published-remote.mjs");
  const r = spawnSync(process.execPath, [script], {
    cwd,
    env: { ...process.env, INFO_EDITION_REMOTE_SCP_TARGET: scp },
    encoding: "utf8",
  });
  if (r.status !== 0) {
    return {
      ok: false,
      error: (r.stderr || r.stdout || `退出码 ${r.status ?? 1}`).trim().slice(0, 500),
    };
  }
  return { ok: true };
}
