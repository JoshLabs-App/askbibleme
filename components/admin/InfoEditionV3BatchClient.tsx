"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { diskAuthHeaders } from "@/lib/disk-auth-headers";

type V3BatchPayload = {
  ok: boolean;
  error?: string;
  message?: string;
  process?: { pid: number | null; alive: boolean };
  config?: {
    bookStart: string;
    bookEnd: string;
    delayMs: number;
    skipCorrected: boolean;
  };
  state?: {
    running: boolean;
    updatedAt: string;
    skipCorrected: boolean;
    force: boolean;
    stats: { ok: number; failed: number; skipped: number; partial: number };
    lastRun: {
      bookId: string;
      chapter: number;
      error?: string;
      infoPublished?: boolean;
      guidePublished?: boolean;
      at?: string;
    } | null;
    cursor: { bookId: string | null; bookName: string | null; chapter: number };
  };
  progress?: { totalChapters: number; doneChapters: number; percent: number };
  fullBible?: {
    complete: boolean;
    resumeBookName: string | null;
    resumeChapter: number;
    stateRel: string;
    publishedRel: string;
  };
  books?: {
    bookId: string;
    bookName: string;
    chapters: number;
    ok: number;
    failed: number;
    skipped: number;
    partial: number;
    pending: number;
    done: number;
    percent: number;
  }[];
  recentChapters?: {
    bookId: string;
    bookName: string;
    chapter: number;
    status: string;
    infoPublished?: boolean;
    guidePublished?: boolean;
    at?: string;
    error?: string;
    durationSec?: number;
  }[];
  logTail?: string[];
};

function statusLabel(status: string): string {
  if (status === "ok") return "完成";
  if (status === "partial") return "部分";
  if (status === "failed") return "失败";
  if (status === "skipped") return "跳过";
  return status;
}

function statusClass(status: string): string {
  if (status === "ok") return "text-emerald-700 dark:text-emerald-300";
  if (status === "partial") return "text-amber-800 dark:text-amber-200";
  if (status === "failed") return "text-red-700 dark:text-red-300";
  return "text-adminMuted";
}

function formatSavedAt(iso: string | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso;
  }
}

export function InfoEditionV3BatchClient() {
  const [data, setData] = useState<V3BatchPayload | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [force, setForce] = useState(false);
  const [skipCorrected, setSkipCorrected] = useState(true);
  const [bookStart, setBookStart] = useState("");
  const [bookEnd, setBookEnd] = useState("");
  const [bookFilter, setBookFilter] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/bible/info-edition-v3-batch", {
        cache: "no-store",
        headers: { ...diskAuthHeaders() },
      });
      const j = (await res.json()) as V3BatchPayload;
      if (!res.ok || !j.ok) {
        setErr(j.error ?? `HTTP ${res.status}`);
        setData(j);
        return;
      }
      setData(j);
      if (j.config) {
        if (!bookStart && j.config.bookStart) setBookStart(j.config.bookStart);
        if (!bookEnd && j.config.bookEnd) setBookEnd(j.config.bookEnd);
        setSkipCorrected(j.config.skipCorrected);
      }
      setErr(null);
    } catch {
      setErr("无法连接接口，请确认 npm run dev 已启动。");
    }
  }, [bookEnd, bookStart]);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 2500);
    return () => clearInterval(id);
  }, [load]);

  async function postAction(body: Record<string, unknown>) {
    setBusy(true);
    setFlash(null);
    try {
      const res = await fetch("/api/admin/bible/info-edition-v3-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...diskAuthHeaders() },
        body: JSON.stringify(body),
      });
      const j = (await res.json()) as V3BatchPayload;
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

  const running = data?.state?.running || data?.process?.alive;
  const stats = data?.state?.stats;
  const progress = data?.progress;
  const filteredBooks = useMemo(() => {
    const list = data?.books ?? [];
    const q = bookFilter.trim().toUpperCase();
    if (!q) return list;
    return list.filter((b) => b.bookId.includes(q) || b.bookName.includes(q));
  }, [bookFilter, data?.books]);

  return (
    <div className="mt-4 space-y-4 text-adminFg">
      <p className="text-[12px] leading-relaxed text-adminMuted">
        临时批量页：DeepSeek V3 找错诊断 → 修订讲解版 / 发现版 → 逐章写入{" "}
        <code className="text-[10px]">info-edition-v1-published.json</code>。每章完成后自动存盘，可随时停止并从断点续跑。
      </p>
      <p className="text-[10px] font-mono text-adminMuted/80">
        进度：data/bible/info-edition-v3-batch-state.json · 日志：info-edition-v3-batch.log
      </p>

      <p className="text-[11px]">
        <Link href="/admin/read/info-edition-v3" className="underline text-adminMuted hover:text-adminFg">
          ← 返回 V3 单章找错
        </Link>
      </p>

      {err ? <p className="text-[12px] text-red-700 dark:text-red-300">{err}</p> : null}
      {flash ? <p className="text-[12px] text-emerald-800 dark:text-emerald-200">{flash}</p> : null}

      <section className="rounded-lg border border-adminLine/70 bg-adminPanel/50 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-[13px] font-semibold">总进度</h2>
            <p className="mt-1 text-[11px] text-adminMuted tabular-nums">
              {progress
                ? `${progress.doneChapters} / ${progress.totalChapters} 章 · ${progress.percent}%`
                : "—"}
            </p>
          </div>
          <div className="text-right text-[10px] text-adminMuted tabular-nums">
            {running ? (
              <span className="font-medium text-amber-800 dark:text-amber-200">
                运行中 · PID {data?.process?.pid ?? "—"}
              </span>
            ) : (
              <span>已停止</span>
            )}
            <p className="mt-0.5">更新 {formatSavedAt(data?.state?.updatedAt)}</p>
          </div>
        </div>

        <div className="mt-3 h-2 overflow-hidden rounded-full bg-adminFg/10">
          <div
            className="h-full rounded-full bg-amber-800 transition-all duration-500 dark:bg-amber-300"
            style={{ width: `${progress?.percent ?? 0}%` }}
          />
        </div>

        {stats ? (
          <div className="mt-3 flex flex-wrap gap-3 text-[11px] tabular-nums">
            <span className="text-emerald-800 dark:text-emerald-200">完成 {stats.ok}</span>
            <span className="text-amber-800 dark:text-amber-200">部分 {stats.partial}</span>
            <span className="text-red-700 dark:text-red-300">失败 {stats.failed}</span>
            <span className="text-adminMuted">跳过 {stats.skipped}</span>
          </div>
        ) : null}

        {data?.state?.lastRun ? (
          <p className="mt-2 text-[10px] text-adminMuted">
            最近：{data.state.lastRun.bookId} {data.state.lastRun.chapter}章
            {data.state.lastRun.infoPublished ? " · 讲解✓" : ""}
            {data.state.lastRun.guidePublished ? " · 发现✓" : ""}
            {data.state.lastRun.error ? ` · ${data.state.lastRun.error.slice(0, 120)}` : ""}
          </p>
        ) : null}

        {data?.fullBible && !data.fullBible.complete ? (
          <p className="mt-1 text-[10px] text-adminMuted">
            断点续跑：{data.fullBible.resumeBookName ?? "—"} 第 {data.fullBible.resumeChapter} 章
          </p>
        ) : null}
      </section>

      <section className="rounded-lg border border-adminLine/70 bg-adminPanel/50 p-3">
        <h2 className="text-[12px] font-semibold">控制</h2>
        <div className="mt-2 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] text-adminMuted">起始书卷 ID</span>
            <input
              value={bookStart}
              onChange={(e) => setBookStart(e.target.value.toUpperCase())}
              placeholder="GEN"
              className="w-24 rounded border border-adminLine bg-white px-2 py-1 text-[12px]"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] text-adminMuted">结束书卷 ID</span>
            <input
              value={bookEnd}
              onChange={(e) => setBookEnd(e.target.value.toUpperCase())}
              placeholder="REV"
              className="w-24 rounded border border-adminLine bg-white px-2 py-1 text-[12px]"
            />
          </label>
        </div>
        <div className="mt-2 flex flex-wrap gap-3 text-[11px]">
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={skipCorrected} onChange={(e) => setSkipCorrected(e.target.checked)} />
            跳过已完成章节
          </label>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} />
            强制重跑
          </label>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || running}
            onClick={() =>
              void postAction({
                action: "start",
                force,
                skipCorrected,
                bookStart: bookStart || undefined,
                bookEnd: bookEnd || undefined,
              })
            }
            className="rounded border border-amber-800/40 bg-amber-900 px-3 py-1.5 text-[12px] font-semibold text-amber-50 disabled:opacity-45 dark:bg-amber-200 dark:text-amber-950"
          >
            开始 / 续跑
          </button>
          <button
            type="button"
            disabled={busy || running}
            onClick={() =>
              void postAction({
                action: "start-full-bible",
                force,
                skipCorrected,
              })
            }
            className="rounded border border-adminLine px-3 py-1.5 text-[12px] font-medium disabled:opacity-45"
          >
            全书续跑
          </button>
          <button
            type="button"
            disabled={busy || !running}
            onClick={() => void postAction({ action: "stop" })}
            className="rounded border border-red-700/30 px-3 py-1.5 text-[12px] text-red-800 disabled:opacity-45 dark:text-red-300"
          >
            停止
          </button>
          <button
            type="button"
            disabled={busy || running}
            onClick={() =>
              void postAction({
                action: "save-config",
                bookStart,
                bookEnd,
                skipCorrected,
              })
            }
            className="rounded border border-adminLine/80 px-3 py-1.5 text-[11px] disabled:opacity-45"
          >
            保存设置
          </button>
        </div>
      </section>

      <section className="rounded-lg border border-adminLine/70 bg-adminPanel/40 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[12px] font-semibold">各卷进度</h2>
          <input
            value={bookFilter}
            onChange={(e) => setBookFilter(e.target.value)}
            placeholder="筛选书卷…"
            className="rounded border border-adminLine bg-white px-2 py-0.5 text-[11px]"
          />
        </div>
        <ul className="mt-2 max-h-[min(42vh,360px)] space-y-1 overflow-y-auto">
          {filteredBooks.map((b) => (
            <li
              key={b.bookId}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded border border-adminLine/50 px-2 py-1.5 text-[11px]"
            >
              <div className="min-w-0">
                <span className="font-medium">{b.bookName}</span>
                <span className="ml-1.5 text-[10px] text-adminMuted tabular-nums">
                  {b.done}/{b.chapters} · {b.percent}%
                </span>
                <div className="mt-1 h-1 overflow-hidden rounded-full bg-adminFg/8">
                  <div
                    className="h-full rounded-full bg-adminFg/35"
                    style={{ width: `${b.percent}%` }}
                  />
                </div>
              </div>
              <div className="text-right text-[10px] tabular-nums text-adminMuted">
                {b.ok > 0 ? <span className="text-emerald-700 dark:text-emerald-300">{b.ok}✓ </span> : null}
                {b.partial > 0 ? <span className="text-amber-800">{b.partial}~ </span> : null}
                {b.failed > 0 ? <span className="text-red-700">{b.failed}✗ </span> : null}
                {b.pending > 0 ? <span>{b.pending}待</span> : null}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-lg border border-adminLine/70 bg-adminPanel/40 p-3">
        <h2 className="text-[12px] font-semibold">最近修改的章</h2>
        <ul className="mt-2 max-h-[min(36vh,280px)] space-y-1 overflow-y-auto">
          {(data?.recentChapters ?? []).map((row) => (
            <li
              key={`${row.bookId}:${row.chapter}:${row.at}`}
              className="flex flex-wrap items-baseline justify-between gap-2 rounded border border-adminLine/40 px-2 py-1 text-[11px]"
            >
              <span>
                <span className="font-medium">{row.bookName}</span> {row.chapter}章
                <span className={`ml-2 ${statusClass(row.status)}`}>{statusLabel(row.status)}</span>
                {row.infoPublished ? <span className="ml-1 text-[10px] text-adminMuted">讲解✓</span> : null}
                {row.guidePublished ? <span className="ml-1 text-[10px] text-adminMuted">发现✓</span> : null}
                {row.durationSec ? (
                  <span className="ml-1 text-[10px] text-adminMuted tabular-nums">{row.durationSec}s</span>
                ) : null}
              </span>
              <span className="text-[10px] text-adminMuted">{formatSavedAt(row.at)}</span>
            </li>
          ))}
          {!data?.recentChapters?.length ? (
            <li className="text-[11px] text-adminMuted">尚无记录。点击「开始 / 续跑」后这里会实时更新。</li>
          ) : null}
        </ul>
      </section>

      <section className="rounded-lg border border-adminLine/60 bg-adminBg/30 p-3">
        <h2 className="text-[11px] font-semibold text-adminMuted">日志尾部</h2>
        <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap font-mono text-[10px] leading-relaxed text-adminMuted">
          {(data?.logTail ?? []).join("\n") || "（空）"}
        </pre>
      </section>
    </div>
  );
}
