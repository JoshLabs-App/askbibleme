"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { diskAuthHeaders } from "@/lib/disk-auth-headers";
import type { VerseRepeatRankItem } from "@/lib/scripture/reader-verse-repeat-rank";

const PAGE_SIZE = 500;
const LIST_MAX_HEIGHT_PX = 560;

/** 次数快捷筛选：≥ N 次收录 */
const COUNT_PRESETS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 20, 30, 40, 50, 100] as const;

type RankOk = {
  ok: true;
  totalRows: number;
  uniqueVerses: number;
  offset: number;
  limit: number;
  items: VerseRepeatRankItem[];
};

async function parseJson(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function pageWindow(current: number, total: number, maxButtons = 9): number[] {
  if (total <= 1) return total === 1 ? [1] : [];
  const half = Math.floor(maxButtons / 2);
  let start = Math.max(1, current - half);
  let end = Math.min(total, start + maxButtons - 1);
  start = Math.max(1, end - maxButtons + 1);
  const out: number[] = [];
  for (let p = start; p <= end; p += 1) out.push(p);
  return out;
}

export function AdminVerseRepeatRankClient() {
  const { t } = useLocale();
  const rt = useCallback((key: string, vars?: Record<string, string>) => t(`admin.verseRepeatRank.${key}`, vars), [t]);

  const [err, setErr] = useState<string | null>(null);
  const [missingDb, setMissingDb] = useState(false);
  const [loading, setLoading] = useState(true);
  const [totalRows, setTotalRows] = useState(0);
  const [uniqueVerses, setUniqueVerses] = useState(0);
  const [items, setItems] = useState<VerseRepeatRankItem[]>([]);
  const [query, setQuery] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [minCount, setMinCount] = useState("");
  const [maxCount, setMaxCount] = useState("");
  const [debouncedMinCount, setDebouncedMinCount] = useState("");
  const [debouncedMaxCount, setDebouncedMaxCount] = useState("");
  const [page, setPage] = useState(1);
  const [jumpInput, setJumpInput] = useState("1");

  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedQ(query.trim()), 300);
    return () => window.clearTimeout(id);
  }, [query]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setDebouncedMinCount(minCount.trim());
      setDebouncedMaxCount(maxCount.trim());
    }, 300);
    return () => window.clearTimeout(id);
  }, [minCount, maxCount]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(uniqueVerses / PAGE_SIZE) || 1),
    [uniqueVerses],
  );

  const safePage = Math.min(Math.max(1, page), totalPages);

  const fetchPage = useCallback(
    async (pageNum: number) => {
      setLoading(true);
      setErr(null);
      try {
        const offset = (pageNum - 1) * PAGE_SIZE;
        const params = new URLSearchParams({
          mode: "verse-repeat-rank",
          limit: String(PAGE_SIZE),
          offset: String(offset),
        });
        if (debouncedQ) params.set("q", debouncedQ);
        if (debouncedMinCount) params.set("minCount", debouncedMinCount);
        if (debouncedMaxCount) params.set("maxCount", debouncedMaxCount);
        const res = await fetch(`/api/admin/bible/reader-verse-themes?${params}`, {
          headers: { ...diskAuthHeaders() },
        });
        const j = await parseJson(res);
        if (!res.ok) {
          const e = typeof j.error === "string" ? j.error : rt("loadFailed", { status: String(res.status) });
          throw new Error(e + (res.status === 403 ? ` ${rt("diskHint")}` : ""));
        }
        if (j.missingDb) {
          setMissingDb(true);
          setItems([]);
          return;
        }
        if (j.ok !== true) throw new Error(rt("badResponse"));

        const data = j as unknown as RankOk;
        setTotalRows(Number(data.totalRows ?? 0));
        const unique = Number(data.uniqueVerses ?? 0);
        setUniqueVerses(unique);
        setItems(Array.isArray(data.items) ? data.items : []);
        setPage(pageNum);
        setJumpInput(String(pageNum));
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
        setItems([]);
      } finally {
        setLoading(false);
      }
    },
    [debouncedMaxCount, debouncedMinCount, debouncedQ, rt],
  );

  useEffect(() => {
    void fetchPage(1);
  }, [debouncedQ, debouncedMinCount, debouncedMaxCount]); // eslint-disable-line react-hooks/exhaustive-deps -- filters → page 1

  const applyCountPreset = (min: number | null) => {
    setMinCount(min != null ? String(min) : "");
    setMaxCount("");
  };

  const goToPage = (p: number) => {
    const next = Math.min(Math.max(1, p), totalPages);
    if (next === page && items.length > 0 && !loading) return;
    void fetchPage(next);
  };

  const pages = pageWindow(safePage, totalPages);

  if (missingDb) {
    return (
      <div className="mt-6 rounded-lg border border-adminBorder bg-adminSurface p-4 text-[13px] text-adminMuted">
        <p className="font-medium text-adminFg">{rt("missingTitle")}</p>
        <p className="mt-2">{rt("missingBody")}</p>
        <p className="mt-2 font-mono text-[12px]">npm run import:reader-verse-themes -- /path/to/reader_zh_cn_verse_categories.json</p>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="block min-w-[200px] flex-1">
          <span className="text-[12px] text-adminMuted">{rt("searchLabel")}</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={rt("searchPlaceholder")}
            className="mt-1 w-full rounded-md border border-adminBorder bg-adminBg px-2.5 py-1.5 text-[13px] text-adminFg"
          />
        </label>
        <label className="block w-24">
          <span className="text-[12px] text-adminMuted">{rt("countMinLabel")}</span>
          <input
            type="number"
            min={1}
            value={minCount}
            onChange={(e) => setMinCount(e.target.value)}
            placeholder={rt("countMinPlaceholder")}
            className="mt-1 w-full rounded-md border border-adminBorder bg-adminBg px-2.5 py-1.5 text-[13px] tabular-nums text-adminFg"
          />
        </label>
        <label className="block w-24">
          <span className="text-[12px] text-adminMuted">{rt("countMaxLabel")}</span>
          <input
            type="number"
            min={1}
            value={maxCount}
            onChange={(e) => setMaxCount(e.target.value)}
            placeholder={rt("countMaxPlaceholder")}
            className="mt-1 w-full rounded-md border border-adminBorder bg-adminBg px-2.5 py-1.5 text-[13px] tabular-nums text-adminFg"
          />
        </label>
        <p className="text-[12px] text-adminMuted">
          {rt("statsPaged", {
            rows: String(totalRows),
            unique: String(uniqueVerses),
            pageSize: String(PAGE_SIZE),
          })}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 text-[12px]">
        <span className="mr-0.5 text-adminMuted">{rt("countPresetsLabel")}</span>
        <button
          type="button"
          disabled={loading}
          onClick={() => applyCountPreset(null)}
          className={[
            "rounded border px-2 py-0.5",
            !debouncedMinCount && !debouncedMaxCount
              ? "border-adminFg bg-adminFg text-adminBg"
              : "border-adminBorder text-adminFg hover:bg-adminSurface",
          ].join(" ")}
        >
          {rt("countPresetAll")}
        </button>
        {COUNT_PRESETS.map((n) => {
          const active = debouncedMinCount === String(n) && !debouncedMaxCount;
          return (
            <button
              key={n}
              type="button"
              disabled={loading}
              title={rt("countPresetTitle", { n: String(n) })}
              onClick={() => applyCountPreset(n)}
              className={[
                "min-w-[1.75rem] rounded border px-1.5 py-0.5 tabular-nums",
                active
                  ? "border-adminFg bg-adminFg text-adminBg"
                  : "border-adminBorder text-adminFg hover:bg-adminSurface",
              ].join(" ")}
            >
              {n}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-[13px]">
        <span className="text-adminMuted">
          {rt("pageOf", { current: String(safePage), total: String(totalPages) })}
        </span>
        <button
          type="button"
          disabled={loading || safePage <= 1}
          onClick={() => goToPage(1)}
          className="rounded border border-adminBorder px-2 py-1 text-adminFg disabled:opacity-40"
        >
          {rt("pageFirst")}
        </button>
        <button
          type="button"
          disabled={loading || safePage <= 1}
          onClick={() => goToPage(safePage - 1)}
          className="rounded border border-adminBorder px-2 py-1 text-adminFg disabled:opacity-40"
        >
          {rt("pagePrev")}
        </button>
        {pages[0]! > 1 ? <span className="text-adminMuted">…</span> : null}
        {pages.map((p) => (
          <button
            key={p}
            type="button"
            disabled={loading}
            onClick={() => goToPage(p)}
            className={[
              "min-w-[2rem] rounded border px-2 py-1 tabular-nums",
              p === safePage
                ? "border-adminFg bg-adminFg text-adminBg"
                : "border-adminBorder text-adminFg hover:bg-adminSurface",
            ].join(" ")}
            aria-current={p === safePage ? "page" : undefined}
          >
            {p}
          </button>
        ))}
        {pages.length > 0 && pages[pages.length - 1]! < totalPages ? (
          <span className="text-adminMuted">…</span>
        ) : null}
        <button
          type="button"
          disabled={loading || safePage >= totalPages}
          onClick={() => goToPage(safePage + 1)}
          className="rounded border border-adminBorder px-2 py-1 text-adminFg disabled:opacity-40"
        >
          {rt("pageNext")}
        </button>
        <button
          type="button"
          disabled={loading || safePage >= totalPages}
          onClick={() => goToPage(totalPages)}
          className="rounded border border-adminBorder px-2 py-1 text-adminFg disabled:opacity-40"
        >
          {rt("pageLast")}
        </button>
        <form
          className="ml-1 flex items-center gap-1"
          onSubmit={(e) => {
            e.preventDefault();
            const n = Number(jumpInput);
            if (Number.isFinite(n)) goToPage(n);
          }}
        >
          <label className="sr-only" htmlFor="verse-rank-jump">
            {rt("pageJumpLabel")}
          </label>
          <input
            id="verse-rank-jump"
            type="number"
            min={1}
            max={totalPages}
            value={jumpInput}
            onChange={(e) => setJumpInput(e.target.value)}
            className="w-14 rounded border border-adminBorder bg-adminBg px-1.5 py-1 text-center text-[13px] tabular-nums text-adminFg"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded border border-adminBorder px-2 py-1 text-adminFg disabled:opacity-40"
          >
            {rt("pageGo")}
          </button>
        </form>
      </div>

      {err ? <p className="text-[13px] text-red-600">{err}</p> : null}

      <div className="overflow-hidden rounded-lg border border-adminBorder">
        <div className="grid grid-cols-[3.5rem_1fr_5rem_minmax(0,2fr)_4.5rem] gap-2 border-b border-adminBorder bg-adminSurface px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-adminMuted">
          <span>{rt("colRank")}</span>
          <span>{rt("colRef")}</span>
          <span className="text-right">{rt("colCount")}</span>
          <span>{rt("colText")}</span>
          <span className="text-right">{rt("colRead")}</span>
        </div>
        <div
          className="overflow-auto bg-adminBg"
          style={{ maxHeight: LIST_MAX_HEIGHT_PX }}
          aria-busy={loading}
        >
          {loading ? (
            <p className="px-3 py-6 text-[13px] text-adminMuted">{rt("loadingIndex")}</p>
          ) : items.length === 0 ? (
            <p className="px-3 py-6 text-[13px] text-adminMuted">{rt("empty")}</p>
          ) : (
            items.map((row) => (
              <div
                key={`${row.bookId}:${row.chapter}:${row.verse}`}
                className="grid grid-cols-[3.5rem_1fr_5rem_minmax(0,2fr)_4.5rem] gap-2 border-b border-adminBorder/60 px-3 py-2.5 text-[13px] text-adminFg"
              >
                <span className="tabular-nums text-adminMuted">{row.rank}</span>
                    <span className="min-w-0 truncate" title={row.sourcePassage ? `${row.reference} · ${row.sourcePassage}` : row.reference}>
                      <span className="font-medium">{row.reference}</span>
                      {row.sourcePassage ? (
                        <span className="mt-0.5 block truncate text-[11px] font-normal text-adminMuted">
                          {rt("sourcePassage", { ref: row.sourcePassage })}
                        </span>
                      ) : null}
                    </span>
                <span className="text-right tabular-nums font-medium">{row.repeatCount}</span>
                <span className="truncate text-adminMuted" title={row.sampleText}>
                  {row.sampleText || "—"}
                </span>
                <span className="text-right">
                  <Link
                    href={row.readHref}
                    className="text-[12px] font-medium text-adminFg underline underline-offset-2"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {rt("openRead")}
                  </Link>
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {!loading && items.length > 0 ? (
        <p className="text-[12px] text-adminMuted">
          {rt("pageRange", {
            from: String(items[0]!.rank),
            to: String(items[items.length - 1]!.rank),
            count: String(items.length),
          })}
        </p>
      ) : null}
    </div>
  );
}
