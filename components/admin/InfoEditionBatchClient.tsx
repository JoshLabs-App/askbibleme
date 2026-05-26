"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type BatchBook = {
  bookId: string;
  bookName: string;
  chapters: number;
  percent: number;
  syncedAt: string | null;
  lastSyncError: string | null;
};

type TargetBatchBook = {
  bookId: string;
  bookName: string;
  chapters: number;
  infoHave: number;
  guideHave: number;
  infoMissing: number;
  guideMissing: number;
  doneTasks: number;
  totalTasks: number;
  percent: number;
};

type BatchPayload = {
  ok: boolean;
  error?: string;
  onlineBatchEnabled?: boolean;
  directDisk?: boolean;
  message?: string;
  process?: { pid: number | null; alive: boolean };
  config?: {
    remoteScpTarget: string;
    pushEachBook: boolean;
    translationId?: string;
    outputLanguage?: "zh-CN" | "en";
    infoRoleId?: string;
    guideRoleId?: string;
  };
  state?: {
    running: boolean;
    updatedAt: string;
    stats: { ok: number; failed: number; skipped: number };
    lastRun: { error?: string } | null;
    cursor: { bookName: string | null; chapter: number; edition: string };
  };
  progress?: {
    percent: number;
    doneTasks: number;
    totalTasks: number;
    missingTasks?: number;
    totalChapters?: number;
    info?: {
      roleId: string;
      doneChapters: number;
      missingChapters: number;
      percent: number;
    };
    guide?: {
      roleId: string;
      doneChapters: number;
      missingChapters: number;
      percent: number;
    };
  };
  batchProgress?: {
    percent: number;
    doneTasks: number;
    totalTasks: number;
    booksSynced: number;
  };
  books?: BatchBook[];
  targetBooks?: TargetBatchBook[];
  logTail?: string[];
  fullBible?: {
    complete: boolean;
    endBookId: string;
    endBookName: string;
    resumeBookId: string | null;
    resumeBookName: string | null;
    resumeChapter: number;
    resumeEdition: string;
    publishedRel: string;
  };
  invalidChapters?: {
    count: number;
    sample: {
      bookId: string;
      bookName: string;
      chapter: number;
      edition: string;
      issues: string[];
    }[];
  };
};

type Props = {
  apiPath: string;
  mode: "local" | "online";
  title: string;
  subtitle: string;
};

function parseOkDurationsFromLog(logTail: string[] | undefined): number[] {
  if (!logTail?.length) return [];
  const secs: number[] = [];
  for (const line of logTail) {
    const m = line.match(/\[ok\].*\((\d+)s,/);
    if (!m) continue;
    const n = Number(m[1]);
    if (Number.isFinite(n) && n > 0) secs.push(n);
  }
  return secs;
}

function average(values: number[]): number | null {
  if (!values.length) return null;
  const total = values.reduce((sum, n) => sum + n, 0);
  return total / values.length;
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0m";
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${Math.max(1, m)}m`;
}

export function InfoEditionBatchClient({ apiPath, mode, title, subtitle }: Props) {
  const isLocal = mode === "local";
  const [data, setData] = useState<BatchPayload | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [force, setForce] = useState(false);
  const [bookStart, setBookStart] = useState("");
  const [bookEnd, setBookEnd] = useState("");
  const [remoteScp, setRemoteScp] = useState("");
  const [flash, setFlash] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(apiPath, { cache: "no-store" });
      const j = (await res.json()) as BatchPayload;
      if (!res.ok || !j.ok) {
        setErr(j.error ?? `HTTP ${res.status}`);
        setData(j);
        return;
      }
      setData(j);
      if (j.config?.remoteScpTarget && !remoteScp) {
        setRemoteScp(j.config.remoteScpTarget);
      }
      setErr(null);
    } catch {
      setErr(isLocal ? "无法连接：请先在本机运行 npm run dev" : "无法连接接口");
    }
  }, [apiPath, isLocal, remoteScp]);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 2500);
    return () => clearInterval(id);
  }, [load]);

  const startBlocked =
    !isLocal && data != null && data.onlineBatchEnabled === false;

  async function postAction(body: Record<string, unknown>) {
    setBusy(true);
    setFlash(null);
    try {
      const res = await fetch(apiPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = (await res.json()) as BatchPayload;
      if (!res.ok || !j.ok) {
        setErr(j.error ?? `HTTP ${res.status}`);
      } else {
        setErr(null);
        if (j.message) setFlash(j.message);
      }
      setData(j);
    } catch {
      setErr("请求失败");
    } finally {
      setBusy(false);
    }
  }

  function startRange(start?: string, end?: string) {
    void postAction({
      action: "start",
      force,
      ...(start ? { bookStart: start } : {}),
      ...(end ? { bookEnd: end } : {}),
    });
  }

  function startOneBook(bookId: string) {
    void postAction({
      action: "start",
      force,
      bookStart: bookId,
      bookEnd: bookId,
    });
  }

  function startFullBible() {
    void postAction({ action: "start-full-bible", force });
  }

  function regenerateInvalid() {
    void postAction({ action: "regenerate-invalid" });
  }

  const st = data?.state;
  const fb = data?.fullBible;
  const prog = data?.progress;
  const cfg = data?.config;
  const running = Boolean(st?.running || data?.process?.alive);
  const directDisk = data?.directDisk === true;
  const remainingTasks = Math.max(0, (prog?.totalTasks ?? 0) - (prog?.doneTasks ?? 0));
  const okDurations = useMemo(() => parseOkDurationsFromLog(data?.logTail), [data?.logTail]);
  const avgTaskSeconds = useMemo(() => average(okDurations), [okDurations]);
  const etaSeconds =
    avgTaskSeconds != null && remainingTasks > 0 ? avgTaskSeconds * remainingTasks : null;
  const etaText = etaSeconds != null ? formatDuration(etaSeconds) : null;

  const nextIncomplete = useMemo(() => {
    const books = data?.targetBooks ?? [];
    return books.find((b) => b.infoMissing + b.guideMissing > 0) ?? null;
  }, [data?.targetBooks]);

  const invalidCount = data?.invalidChapters?.count ?? 0;

  const shellClass = isLocal
    ? "info-edition-batch-page bible-catalog-on-parchment w-full min-h-0"
    : "max-w-3xl";

  return (
    <div className={shellClass}>
      <p className={isLocal ? "ieb-meta" : "text-[12px] text-adminMuted"}>
        {isLocal ? (
          <>
            本机批量 ·{" "}
            <Link href="/admin/read/info-edition-v1" className="underline-offset-2 hover:underline">
              内容生成系统
            </Link>
            {" · "}
            <Link href="/" className="underline-offset-2 hover:underline">
              首页
            </Link>
          </>
        ) : (
          <>
            <Link href="/admin/read/info-edition-v1" className="underline-offset-2 hover:underline">
              内容生成系统
            </Link>
            {" · "}
            {subtitle}
          </>
        )}
      </p>
      <h1 className={isLocal ? "ieb-title" : "mt-2 text-lg font-semibold tracking-tight text-adminFg"}>
        {title}
      </h1>
      {isLocal ? <p className="ieb-lead">{subtitle}</p> : null}
      {cfg ? (
        <p className={isLocal ? "mt-2 text-[13px] leading-relaxed text-[#4f3a2c]" : "mt-2 text-[13px] text-adminMuted"}>
          当前生成：
          <strong> {cfg.outputLanguage === "en" ? "英文" : "中文"} </strong>
          （translation: <code className="text-[11px]">{cfg.translationId || "默认"}</code>）
          {" · "}V1 role: <code className="text-[11px]">{cfg.infoRoleId || "默认"}</code>
          {" · "}V2 role: <code className="text-[11px]">{cfg.guideRoleId || "默认"}</code>
        </p>
      ) : null}

      {startBlocked ? (
        <p className="mt-4 rounded-md border border-amber-200/80 bg-amber-50/90 px-3 py-2 text-[13px] text-amber-950">
          线上批量未开启。在 Render 设置 <code className="text-[12px]">INFO_EDITION_BATCH_ONLINE=1</code>
          并重新部署。
        </p>
      ) : null}

      {fb ? (
        <section className={isLocal ? "ieb-card ieb-card--hero" : "mt-4 rounded-lg border border-adminFg/15 bg-adminFg/[0.04] p-4"}>
          <h2 className={isLocal ? undefined : "text-[15px] font-semibold text-adminFg"}>
            全书 · 断点续跑
          </h2>
          <p className={isLocal ? "mt-2" : "mt-2 text-[13px] leading-relaxed text-adminMuted"}>
            按章生成<strong>讲解版 + 发现版</strong>，每章写完即保存到{" "}
            <code className="text-[11px]">{fb.publishedRel}</code>；已有章节自动跳过，停止后可再点继续，直至{" "}
            <strong>{fb.endBookName}</strong>（{fb.endBookId}）完成。
          </p>
          {fb.complete ? (
            <p className="mt-2 text-[13px] font-medium text-emerald-800">
              全本任务已完成。若要全书重跑，请勾选「强制重生成」后再启动。
            </p>
          ) : fb.resumeBookName ? (
            <p className={isLocal ? "mt-2" : "mt-2 text-[13px] text-[#444]"}>
              下次续跑起点：
              <strong>
                {" "}
                {fb.resumeBookName} 第 {fb.resumeChapter} 章 ·{" "}
                {fb.resumeEdition === "guide" ? "发现版" : "讲解版"}
              </strong>
              {" → "}
              {fb.endBookName}
            </p>
          ) : null}
          <div className={isLocal ? "ieb-actions" : "mt-4 flex flex-wrap items-center gap-3"}>
            <button
              type="button"
              disabled={busy || running || startBlocked || (fb.complete && !force)}
              onClick={() => startFullBible()}
              className={
                isLocal
                  ? "ieb-btn-primary"
                  : "rounded-md bg-adminFg px-4 py-2 text-[14px] font-medium text-adminBg disabled:opacity-40"
              }
            >
              {fb.complete ? "全书已完成" : running ? "全书生成中…" : "启动全书断点续跑"}
            </button>
            <button
              type="button"
              disabled={busy || startBlocked}
              onClick={() => void postAction({ action: "restart-full-bible", force })}
              className={
                isLocal
                  ? "ieb-btn-secondary"
                  : "rounded-md border border-adminFg/20 px-3 py-1.5 text-[13px] text-adminFg disabled:opacity-40"
              }
            >
              {busy ? "重启中…" : "重启并断点续跑"}
            </button>
            <button
              type="button"
              disabled={busy || !running}
              onClick={() => void postAction({ action: "stop" })}
              className={
                isLocal
                  ? "ieb-btn-secondary"
                  : "rounded-md border border-adminFg/20 px-3 py-1.5 text-[13px] text-adminFg disabled:opacity-40"
              }
            >
              停止
            </button>
            <label className={isLocal ? "ieb-check" : "flex items-center gap-2 text-[13px] text-adminFg"}>
              <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} />
              强制重生成（含已存在章节）
            </label>
            {invalidCount > 0 ? (
              <button
                type="button"
                disabled={busy || running || startBlocked}
                onClick={() => regenerateInvalid()}
                className={
                  isLocal
                    ? "ieb-btn-secondary"
                    : "rounded-md border border-amber-700/30 bg-amber-50 px-3 py-1.5 text-[13px] text-amber-950 disabled:opacity-40"
                }
              >
                {running ? "修复中…" : `重生成校验失败（${invalidCount}）`}
              </button>
            ) : null}
          </div>
          {invalidCount > 0 && data?.invalidChapters?.sample?.length ? (
            <p className={isLocal ? "mt-2 text-[12px] opacity-80" : "mt-2 text-[12px] text-adminMuted"}>
              例如：
              {data.invalidChapters.sample
                .map(
                  (s) =>
                    `${s.bookName}${s.chapter}·${s.edition === "guide" ? "发现" : "讲解"}`,
                )
                .join("、")}
              …
            </p>
          ) : null}
        </section>
      ) : null}

      {isLocal ? (
        <p className="ieb-hint">
          下方亦可按卷生成，或指定卷范围；与「全书续跑」共用同一进度与 published 文件。
        </p>
      ) : null}

      {directDisk && !isLocal ? (
        <p className="mt-3 text-[13px] text-adminMuted">
          已检测到持久盘：结果直接写入 <code className="text-[12px]">DATA_ROOT</code>。
        </p>
      ) : null}

      {err ? (
        <p className={isLocal ? "ieb-alert" : "mt-3 rounded-md border border-red-200/80 bg-red-50/80 px-3 py-2 text-[13px] text-red-900"}>
          {err}
        </p>
      ) : null}
      {flash ? (
        <p className={isLocal ? "ieb-flash" : "mt-2 text-[13px] text-emerald-800"}>{flash}</p>
      ) : null}

      {st && prog ? (
        <section className={isLocal ? "ieb-card" : "mt-5 rounded-lg border border-adminFg/10 bg-adminFg/[0.03] p-4"}>
          <p className={isLocal ? undefined : "text-[13px] text-adminFg"}>
            状态：{running ? "运行中" : "已停止"}
            {data?.process?.pid ? ` · PID ${data.process.pid}` : ""}
          </p>
          <p className={isLocal ? "ieb-percent" : "mt-2 text-3xl font-semibold tabular-nums text-adminFg"}>
            {prog.percent}%
          </p>
          <div
            className={
              isLocal
                ? "ieb-progress-track"
                : "mt-2 h-2 overflow-hidden rounded-full bg-adminFg/[0.12]"
            }
          >
            <div
              className={isLocal ? "ieb-progress-fill" : "h-full bg-adminFg transition-all"}
              style={{ width: `${prog.percent}%` }}
            />
          </div>
          <p className={isLocal ? "mt-1" : "mt-1 text-[13px] text-adminMuted"}>
            {prog.doneTasks} / {prog.totalTasks} 章×版本（讲解 + 发现）
          </p>
          <p className={isLocal ? "mt-1" : "mt-1 text-[13px] text-adminMuted"}>
            剩余 {prog.missingTasks ?? remainingTasks} 项
            {etaText ? ` · 预计 ${etaText}` : ""}
            {avgTaskSeconds ? `（均速 ~${Math.round(avgTaskSeconds)}s/项）` : ""}
          </p>
          {prog.info && prog.guide ? (
            <p className={isLocal ? "mt-2 text-[12px] opacity-80" : "mt-2 text-[12px] text-adminMuted"}>
              当前角色覆盖：
              V1 <code className="text-[11px]">{prog.info.roleId}</code> {prog.info.doneChapters}/{prog.totalChapters ?? "?"}
              （{prog.info.percent}%）
              {" · "}
              V2 <code className="text-[11px]">{prog.guide.roleId}</code> {prog.guide.doneChapters}/{prog.totalChapters ?? "?"}
              （{prog.guide.percent}%）
            </p>
          ) : null}
          <p className={isLocal ? "mt-2" : "mt-2 text-[13px] text-adminMuted"}>
            批次累计（历史）：成功 {st.stats.ok} · 跳过 {st.stats.skipped} · 失败 {st.stats.failed}
          </p>
          {st.cursor.bookName ? (
            <p className={isLocal ? "mt-2" : "mt-2 text-[13px] text-adminMuted"}>
              当前：{st.cursor.bookName} 第 {st.cursor.chapter} 章 ·{" "}
              {st.cursor.edition === "guide" ? "发现版" : "讲解版"}
            </p>
          ) : null}
          {st.lastRun?.error ? (
            <p className="mt-2 text-[13px] text-red-800">最近错误：{st.lastRun.error}</p>
          ) : null}
          <p className={isLocal ? "ieb-updated" : "mt-3 text-[11px] text-adminMuted/80"}>
            更新 {new Date(st.updatedAt).toLocaleString()}
          </p>
        </section>
      ) : null}

      <section className={isLocal ? "ieb-actions" : "mt-5 flex flex-wrap items-end gap-3"}>
        <label className={isLocal ? "ieb-label" : "flex flex-col gap-1 text-[12px] text-adminMuted"}>
          起始卷
          <input
            value={bookStart}
            onChange={(e) => setBookStart(e.target.value.toUpperCase())}
            placeholder="GEN"
            className={isLocal ? "ieb-input" : "w-24 rounded border border-adminFg/15 bg-white px-2 py-1 text-[13px] text-adminFg"}
          />
        </label>
        <label className={isLocal ? "ieb-label" : "flex flex-col gap-1 text-[12px] text-adminMuted"}>
          结束卷
          <input
            value={bookEnd}
            onChange={(e) => setBookEnd(e.target.value.toUpperCase())}
            placeholder="REV"
            className={isLocal ? "ieb-input" : "w-24 rounded border border-adminFg/15 bg-white px-2 py-1 text-[13px] text-adminFg"}
          />
        </label>
        <label className={isLocal ? "ieb-check" : "flex items-center gap-2 text-[13px] text-adminFg"}>
          <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} />
          强制重生成
        </label>
        <button
          type="button"
          disabled={busy || running || startBlocked}
          onClick={() => startRange(bookStart || undefined, bookEnd || undefined)}
          className={
            isLocal
              ? "ieb-btn-primary"
              : "rounded-md bg-adminFg px-3 py-1.5 text-[13px] text-adminBg disabled:opacity-40"
          }
        >
          按范围启动
        </button>
        {nextIncomplete && !running ? (
          <button
            type="button"
            disabled={busy || startBlocked}
            onClick={() => startOneBook(nextIncomplete.bookId)}
            className={isLocal ? "ieb-btn-secondary" : "rounded-md border border-adminFg/20 px-3 py-1.5 text-[13px] text-adminFg disabled:opacity-40"}
          >
            生成下一卷（{nextIncomplete.bookId}）
          </button>
        ) : null}
        <button
          type="button"
          disabled={busy || !running}
          onClick={() => void postAction({ action: "stop" })}
          className={isLocal ? "ieb-btn-secondary" : "rounded-md border border-adminFg/20 px-3 py-1.5 text-[13px] text-adminFg disabled:opacity-40"}
        >
          停止
        </button>
      </section>

      {data?.targetBooks && data.targetBooks.length > 0 ? (
        <section className={isLocal ? undefined : "mt-8"}>
          <h2 className={isLocal ? "ieb-section-title" : "text-[13px] font-medium text-adminFg"}>
            各卷进度 · 可逐卷生成
          </h2>
          <ul
            className={
              isLocal
                ? "ieb-book-list"
                : "mt-2 max-h-[420px] overflow-y-auto border-t border-adminFg/10 text-[12px]"
            }
          >
            {data.targetBooks.map((b) => {
              const done = b.infoMissing + b.guideMissing === 0;
              const isCurrent =
                running && st?.cursor.bookName === b.bookName;
              return (
                <li
                  key={b.bookId}
                  className={
                    isLocal
                      ? `ieb-book-row${isCurrent ? " ieb-book-row--active" : ""}`
                      : `flex flex-wrap items-center gap-2 border-b border-adminFg/5 py-2${isCurrent ? " bg-adminFg/[0.04]" : ""}`
                  }
                >
                  <span className="w-9 shrink-0 font-mono text-[11px]">{b.bookId}</span>
                  <span className="min-w-0 flex-1 truncate">{b.bookName}</span>
                  <span className="w-9 text-right tabular-nums">{b.percent}%</span>
                  <span className="text-[11px] text-[#6b4d39]">
                    V1 {b.infoHave}/{b.chapters} · V2 {b.guideHave}/{b.chapters}
                  </span>
                  <span
                    className={`w-12 text-right text-[11px] ${
                      done ? (isLocal ? "ieb-done" : "text-emerald-700") : isLocal ? "" : "text-adminMuted"
                    }`}
                  >
                    {done ? "完成" : "—"}
                  </span>
                  <button
                    type="button"
                    disabled={busy || running || startBlocked}
                    onClick={() => startOneBook(b.bookId)}
                    className={
                      isLocal
                        ? "ieb-btn-book"
                        : "shrink-0 rounded border border-adminFg/15 px-2 py-0.5 text-[11px] disabled:opacity-40"
                    }
                  >
                    生成本卷
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {isLocal && !directDisk ? (
        <section className="ieb-card">
          <p>
            <strong>可选：每卷完成后推到 Render</strong>
          </p>
          <div className="ieb-actions">
            <input
              value={remoteScp}
              onChange={(e) => setRemoteScp(e.target.value)}
              placeholder="user@host:/var/data/info-edition-v1-published.json"
              className="ieb-input ieb-input--wide"
            />
            <button
              type="button"
              disabled={busy || !remoteScp.trim()}
              onClick={() =>
                void postAction({
                  action: "save-config",
                  remoteScpTarget: remoteScp,
                  pushEachBook: true,
                })
              }
              className="ieb-btn-secondary"
            >
              保存并启用每卷推送
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void postAction({
                  action: "push-remote",
                  remoteScpTarget: remoteScp,
                })
              }
              className="ieb-btn-secondary"
            >
              立即推送一次
            </button>
          </div>
        </section>
      ) : null}

      {data?.logTail && data.logTail.length > 0 ? (
        <section className="mt-8">
          <h2 className={isLocal ? "ieb-section-title" : "text-[13px] font-medium text-adminFg"}>
            日志
          </h2>
          <pre className={isLocal ? "ieb-log" : "mt-2 max-h-48 overflow-auto rounded-md bg-[#1e1e1e] p-3 text-[11px] leading-relaxed text-[#e8e8e8]"}>
            {data.logTail.join("\n")}
          </pre>
        </section>
      ) : null}

      {!isLocal ? (
        <section className="mt-10 rounded-md border border-adminFg/10 bg-adminFg/[0.02] p-3 text-[12px] text-adminMuted">
          <p className="font-medium text-adminFg">跑完后请关闭</p>
          <ol className="mt-2 list-decimal space-y-1 pl-4">
            <li>确认进度 100% 或已手动停止。</li>
            <li>Render 设 INFO_EDITION_BATCH_ONLINE=0 并重新部署。</li>
          </ol>
        </section>
      ) : null}
    </div>
  );
}
