"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type AllowlistRow = {
  verseKey: string;
  repeatCount: number;
  reference: string;
  text: string;
};

type LoadResponse = {
  ok: boolean;
  error?: string;
  scopeId?: string;
  minCount?: number;
  total?: number;
  rows?: AllowlistRow[];
};

type SaveResponse = {
  ok: boolean;
  error?: string;
  total?: number;
  kept?: number;
  removed?: number;
};

export function ThemeRepeatAllowlistEditor({ minCount = 5 }: { minCount?: number }) {
  const [rows, setRows] = useState<AllowlistRow[]>([]);
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const [strictMode, setStrictMode] = useState(false);
  const [onlyRisky, setOnlyRisky] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [scopeId, setScopeId] = useState("");

  const load = useCallback(async () => {
    setBusy(true);
    setErr(null);
    setFlash(null);
    try {
      const res = await fetch(`/api/dev/theme-repeat-allowlist?minCount=${minCount}`, { cache: "no-store" });
      const data = (await res.json()) as LoadResponse;
      if (!res.ok || !data.ok) {
        setErr(data.error ?? `HTTP ${res.status}`);
        setRows([]);
        setRemoved(new Set());
        return;
      }
      setRows(data.rows ?? []);
      setRemoved(new Set());
      setScopeId(data.scopeId ?? "");
    } catch {
      setErr("加载失败，请确认 npm run dev 正在运行。");
    } finally {
      setBusy(false);
    }
  }, [minCount]);

  useEffect(() => {
    void load();
  }, [load]);

  function stripTailQuotes(text: string): string {
    return text.replace(/[」』”"\)\]）】〕〉》]+$/g, "").trimEnd();
  }

  function isLikelyCjk(text: string): boolean {
    return /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/.test(text);
  }

  function isStrictRiskyTail(row: AllowlistRow): boolean {
    const text = stripTailQuotes(row.text.trim());
    if (!text || !isLikelyCjk(text)) return false;
    return !/[。！？!?…]\s*$/.test(text);
  }

  const normalizedQ = q.trim().toLowerCase();
  const visibleRows = useMemo(() => {
    const live = rows.filter((row) => !removed.has(row.verseKey));
    if (!normalizedQ) return live;
    const queried = live.filter((row) => {
      const hay = `${row.verseKey}\n${row.reference}\n${row.text}`.toLowerCase();
      return hay.includes(normalizedQ);
    });
    return queried;
  }, [rows, removed, normalizedQ]);

  const displayedRows = useMemo(() => {
    if (!strictMode || !onlyRisky) return visibleRows;
    return visibleRows.filter((row) => isStrictRiskyTail(row));
  }, [strictMode, onlyRisky, visibleRows]);

  const riskyCount = useMemo(
    () => visibleRows.filter((row) => isStrictRiskyTail(row)).length,
    [visibleRows],
  );

  const keptCount = rows.length - removed.size;

  function removeOne(verseKey: string) {
    setRemoved((prev) => {
      const next = new Set(prev);
      next.add(verseKey);
      return next;
    });
  }

  function undoOne(verseKey: string) {
    setRemoved((prev) => {
      const next = new Set(prev);
      next.delete(verseKey);
      return next;
    });
  }

  function removeRiskyInView() {
    const riskyKeys = displayedRows
      .filter((row) => isStrictRiskyTail(row))
      .map((row) => row.verseKey);
    if (riskyKeys.length === 0) return;
    setRemoved((prev) => {
      const next = new Set(prev);
      for (const key of riskyKeys) next.add(key);
      return next;
    });
    setFlash(`已删除当前列表中的可疑条目 ${riskyKeys.length} 条（未保存，记得点保存）。`);
  }

  async function save() {
    if (saving) return;
    setSaving(true);
    setErr(null);
    setFlash(null);
    try {
      const keepVerseKeys = rows
        .map((row) => row.verseKey)
        .filter((verseKey) => !removed.has(verseKey));
      const res = await fetch("/api/dev/theme-repeat-allowlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minCount, keepVerseKeys }),
      });
      const data = (await res.json()) as SaveResponse;
      if (!res.ok || !data.ok) {
        setErr(data.error ?? `HTTP ${res.status}`);
        return;
      }
      setFlash(`已保存：保留 ${data.kept ?? keepVerseKeys.length} 条，移除 ${data.removed ?? removed.size} 条。`);
      await load();
    } catch {
      setErr("保存失败，请稍后重试。");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-6 text-[14px] text-slate-200">
      <h1 className="text-xl font-semibold text-white">首页金句池审阅（网页版）</h1>
      <p className="text-[13px] text-slate-300">
        逐条删掉不合适的经文，点击保存后将写回 allowlist。之后重建池时，被删条目不会再入池。
      </p>

      <div className="rounded-lg border border-white/15 bg-black/20 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜索：经文编号 / 引用 / 内容"
            className="min-w-[240px] flex-1 rounded border border-white/20 bg-black/30 px-3 py-2 text-[13px] outline-none focus:border-white/45"
          />
          <button
            type="button"
            onClick={() => void load()}
            disabled={busy || saving}
            className="rounded border border-white/20 px-3 py-2 text-[13px] hover:bg-white/10 disabled:opacity-50"
          >
            刷新
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={busy || saving}
            className="rounded bg-white px-3 py-2 text-[13px] font-medium text-black hover:bg-white/90 disabled:opacity-50"
          >
            {saving ? "保存中…" : "保存删除结果"}
          </button>
          <label className="ml-1 inline-flex items-center gap-2 rounded border border-amber-300/30 px-2 py-1 text-[12px] text-amber-200">
            <input
              type="checkbox"
              checked={strictMode}
              onChange={(e) => setStrictMode(e.target.checked)}
            />
            更严模式
          </label>
          {strictMode ? (
            <>
              <label className="inline-flex items-center gap-2 rounded border border-amber-300/30 px-2 py-1 text-[12px] text-amber-200">
                <input
                  type="checkbox"
                  checked={onlyRisky}
                  onChange={(e) => setOnlyRisky(e.target.checked)}
                />
                只看可疑
              </label>
              <button
                type="button"
                onClick={removeRiskyInView}
                disabled={busy || saving || riskyCount === 0}
                className="rounded border border-amber-300/40 px-2 py-1 text-[12px] text-amber-200 hover:bg-amber-400/10 disabled:opacity-40"
              >
                删除可疑（当前筛选）
              </button>
            </>
          ) : null}
        </div>

        <div className="mt-2 text-[12px] text-slate-300">
          scope: <code>{scopeId || `theme-repeat-ge${minCount}`}</code> · 总数 {rows.length} · 已删 {removed.size} · 当前保留 {keptCount}
        </div>
        {strictMode ? (
          <p className="mt-1 text-[12px] text-amber-200">
            更严模式规则：中文文本末尾若不是 `。！？`（含英文 `.!?`、省略号）则标为可疑。当前可疑 {riskyCount} 条。
          </p>
        ) : null}
        {err ? <p className="mt-2 text-[13px] text-rose-300">{err}</p> : null}
        {flash ? <p className="mt-2 text-[13px] text-emerald-300">{flash}</p> : null}
      </div>

      <div className="flex flex-col gap-2">
        {displayedRows.map((row) => {
          const isRemoved = removed.has(row.verseKey);
          const isRisky = strictMode && isStrictRiskyTail(row);
          return (
            <article
              key={row.verseKey}
              className={`rounded-lg border p-3 ${
                isRisky
                  ? "border-amber-300/45 bg-amber-600/10"
                  : "border-white/15 bg-black/20"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-[12px] text-slate-300">
                  <code>{row.verseKey}</code> · 次数 {row.repeatCount}
                  {isRisky ? " · 可疑尾句" : ""}
                </div>
                {isRemoved ? (
                  <button
                    type="button"
                    onClick={() => undoOne(row.verseKey)}
                    className="rounded border border-emerald-300/40 px-2 py-1 text-[12px] text-emerald-200 hover:bg-emerald-400/10"
                  >
                    撤销删除
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => removeOne(row.verseKey)}
                    className="rounded border border-rose-300/40 px-2 py-1 text-[12px] text-rose-200 hover:bg-rose-400/10"
                  >
                    删除这条
                  </button>
                )}
              </div>
              <div className="mt-1 text-[13px] text-white">{row.reference}</div>
              <div className="mt-1 text-[13px] leading-relaxed text-slate-200">{row.text}</div>
            </article>
          );
        })}
        {!busy && displayedRows.length === 0 ? (
          <p className="rounded-lg border border-white/15 bg-black/20 px-3 py-4 text-[13px] text-slate-300">
            没有匹配结果。
          </p>
        ) : null}
      </div>
    </div>
  );
}
