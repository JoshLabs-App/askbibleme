import "server-only";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { isInfoEditionBatchOnProductionDisk } from "@/lib/bible/info-edition-batch-access";
import {
  infoEditionBatchLogPath,
  infoEditionBatchUiConfigPath,
} from "@/lib/bible/info-edition-batch-paths";
import {
  infoEditionBatchLockPath,
  readInfoEditionBatchState,
  writeInfoEditionBatchState,
} from "@/lib/bible/info-edition-v1-batch-state";
import type { InfoEditionReaderVariant } from "@/lib/bible/info-edition-v1-publish";

export type InfoEditionBatchUiConfig = {
  remoteScpTarget: string;
  pushEachBook: boolean;
  bookStart: string;
  bookEnd: string;
  delayMs: number;
  editions: InfoEditionReaderVariant[];
  translationId: string;
  outputLanguage: "zh-CN" | "en";
  infoRoleId: string;
  guideRoleId: string;
};

const DEFAULT_UI_CONFIG: InfoEditionBatchUiConfig = {
  remoteScpTarget: "",
  pushEachBook: false,
  bookStart: "",
  bookEnd: "",
  delayMs: 800,
  editions: ["info", "guide"],
  translationId: "",
  outputLanguage: "zh-CN",
  infoRoleId: "",
  guideRoleId: "",
};

export function readBatchUiConfig(cwd: string): InfoEditionBatchUiConfig {
  const p = infoEditionBatchUiConfigPath(cwd);
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
      bookEnd: typeof raw.bookEnd === "string" ? raw.bookEnd.trim().toUpperCase() : "",
      delayMs:
        typeof raw.delayMs === "number" && raw.delayMs >= 0
          ? Math.min(raw.delayMs, 60_000)
          : DEFAULT_UI_CONFIG.delayMs,
      editions: editions.length ? editions : DEFAULT_UI_CONFIG.editions,
      translationId: typeof raw.translationId === "string" ? raw.translationId.trim() : "",
      outputLanguage: raw.outputLanguage === "en" ? "en" : "zh-CN",
      infoRoleId: typeof raw.infoRoleId === "string" ? raw.infoRoleId.trim() : "",
      guideRoleId: typeof raw.guideRoleId === "string" ? raw.guideRoleId.trim() : "",
    };
  } catch {
    return { ...DEFAULT_UI_CONFIG };
  }
}

export function writeBatchUiConfig(cwd: string, config: InfoEditionBatchUiConfig): void {
  const p = infoEditionBatchUiConfigPath(cwd);
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
  const p = infoEditionBatchLogPath(cwd);
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
  /** 仅重生成 published 中结构校验未通过的章×版本 */
  fixInvalid?: boolean;
  /** 从断点光标续跑至全本最后一卷（忽略配置里的卷范围） */
  fullBible?: boolean;
  pushEachBook?: boolean;
  bookStart?: string;
  bookEnd?: string;
  delayMs?: number;
  editions?: InfoEditionReaderVariant[];
  remoteScpTarget?: string;
  translationId?: string;
  outputLanguage?: "zh-CN" | "en";
  infoRoleId?: string;
  guideRoleId?: string;
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
    bookStart: opts.fullBible ? "" : (opts.bookStart ?? ui.bookStart),
    bookEnd: opts.fullBible ? "" : (opts.bookEnd ?? ui.bookEnd),
    delayMs: opts.delayMs ?? ui.delayMs,
    editions: opts.editions ?? ui.editions,
    remoteScpTarget: opts.remoteScpTarget ?? ui.remoteScpTarget,
    translationId: opts.translationId ?? ui.translationId,
    outputLanguage: opts.outputLanguage ?? ui.outputLanguage,
    infoRoleId: opts.infoRoleId ?? ui.infoRoleId,
    guideRoleId: opts.guideRoleId ?? ui.guideRoleId,
  };
  writeBatchUiConfig(cwd, config);

  const tsx = path.join(cwd, "node_modules", ".bin", "tsx");
  const script = path.join(cwd, "scripts", "batch-info-edition-volumes.ts");
  if (!fs.existsSync(tsx) || !fs.existsSync(script)) {
    return { ok: false, error: "找不到 tsx 或批量脚本，请先 npm install。" };
  }

  const logPath = infoEditionBatchLogPath(cwd);
  const logDir = path.dirname(logPath);
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
  const logFd = fs.openSync(logPath, "a");
  fs.writeSync(
    logFd,
    `\n--- batch start ${new Date().toISOString()} ---\n`,
  );

  const directDisk = isInfoEditionBatchOnProductionDisk(cwd);
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    ...(directDisk ? {} : { NODE_ENV: "development" }),
    INFO_EDITION_BATCH_EDITIONS: config.editions.join(","),
    INFO_EDITION_BATCH_DELAY_MS: String(config.delayMs),
    INFO_EDITION_BATCH_OUTPUT_LANGUAGE: config.outputLanguage,
  };
  if (opts.force) env.INFO_EDITION_BATCH_FORCE = "1";
  if (opts.fixInvalid) env.INFO_EDITION_BATCH_FIX_INVALID = "1";
  if (config.bookStart) env.INFO_EDITION_BATCH_BOOK_START = config.bookStart;
  if (config.bookEnd) env.INFO_EDITION_BATCH_BOOK_END = config.bookEnd;
  if (config.pushEachBook && !directDisk) env.INFO_EDITION_BATCH_PUSH_EACH_BOOK = "1";
  if (config.remoteScpTarget && !directDisk) {
    env.INFO_EDITION_REMOTE_SCP_TARGET = config.remoteScpTarget;
  }
  if (config.translationId) env.INFO_EDITION_BATCH_TRANSLATION_ID = config.translationId;
  if (config.infoRoleId) env.INFO_EDITION_BATCH_INFO_ROLE_ID = config.infoRoleId;
  if (config.guideRoleId) env.INFO_EDITION_BATCH_GUIDE_ROLE_ID = config.guideRoleId;

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
