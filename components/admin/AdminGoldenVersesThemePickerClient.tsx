"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { diskAuthHeaders } from "@/lib/disk-auth-headers";
import {
  groupCompositeReaderThemeItems,
  groupReaderThemeRows,
  type ReaderThemeFlatRow,
} from "@/lib/scripture/reader-verse-themes-bucket";
import { SITE_VERSE_POOL_MAX } from "@/lib/scripture/site-verse-pool";

type IndexOk = { ok: true; rows: ReaderThemeFlatRow[] };

async function parseJson(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function normalizeSearch(s: string): string {
  return String(s ?? "").trim().toLowerCase();
}

export function AdminGoldenVersesThemePickerClient() {
  const { t } = useLocale();
  const gv = useCallback((key: string, vars?: Record<string, string>) => t(`admin.goldenVerses.${key}`, vars), [t]);
  const rt = useCallback((key: string, vars?: Record<string, string>) => t(`admin.readerVerseThemes.${key}`, vars), [t]);

  const [err, setErr] = useState<string | null>(null);
  const [missingDb, setMissingDb] = useState(false);
  const [rows, setRows] = useState<ReaderThemeFlatRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setErr(null);
    setMissingDb(false);
    setSaveMsg(null);
    try {
      const r0 = await fetch("/api/admin/bible/reader-verse-themes?mode=meta", { headers: { ...diskAuthHeaders() } });
      const j0 = await parseJson(r0);
      if (!r0.ok) {
        const e = typeof j0.error === "string" ? j0.error : rt("loadFailed", { status: String(r0.status) });
        throw new Error(e + (r0.status === 403 ? ` ${rt("diskHint")}` : ""));
      }
      if (j0.missingDb) {
        setMissingDb(true);
        setRows([]);
        return;
      }

      const r1 = await fetch("/api/admin/bible/reader-verse-themes?mode=index", { headers: { ...diskAuthHeaders() } });
      const j1 = await parseJson(r1);
      if (!r1.ok) {
        const e = typeof j1.error === "string" ? j1.error : rt("loadFailed", { status: String(r1.status) });
        throw new Error(e);
      }
      const ix = j1 as unknown as IndexOk;
      setRows(Array.isArray(ix.rows) ? ix.rows : []);

      const r2 = await fetch("/api/admin/bible/home-golden-theme-selection", { headers: { ...diskAuthHeaders() } });
      const j2 = await parseJson(r2);
      if (!r2.ok) {
        const e = typeof j2.error === "string" ? j2.error : gv("selectionLoadFailed", { status: String(r2.status) });
        throw new Error(e + (r2.status === 403 ? ` ${rt("diskHint")}` : ""));
      }
      const keys = Array.isArray(j2.selectedSubcategoryKeys)
        ? (j2.selectedSubcategoryKeys as unknown[]).map((x) => (typeof x === "string" ? x.trim() : "")).filter(Boolean)
        : [];
      setSelected(new Set(keys));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [gv, rt]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const filteredRows = useMemo(() => {
    const q = normalizeSearch(query);
    if (!q) return rows;
    return rows.filter((row) => {
      const hay = [row.name, row.displayName, row.categoryName, row.bucket].join(" ");
      return normalizeSearch(hay).includes(q) || hay.includes(query.trim());
    });
  }, [rows, query]);

  const grouped = useMemo(() => groupReaderThemeRows(filteredRows), [filteredRows]);

  const filteredKeys = useMemo(() => new Set(filteredRows.map((r) => r.key)), [filteredRows]);

  const toggleKey = useCallback((key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    setSaveMsg(null);
  }, []);

  const clearAll = useCallback(() => {
    setSelected(new Set());
    setSaveMsg(null);
  }, []);

  const selectAllFiltered = useCallback(() => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const k of filteredKeys) next.add(k);
      return next;
    });
    setSaveMsg(null);
  }, [filteredKeys]);

  const save = useCallback(async () => {
    setSaving(true);
    setErr(null);
    setSaveMsg(null);
    try {
      const res = await fetch("/api/admin/bible/home-golden-theme-selection", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...diskAuthHeaders() },
        body: JSON.stringify({ selectedSubcategoryKeys: [...selected] }),
      });
      const j = await parseJson(res);
      if (!res.ok) {
        const e = typeof j.error === "string" ? j.error : gv("saveFailed", { status: String(res.status) });
        throw new Error(e + (res.status === 403 ? ` ${rt("diskHint")}` : ""));
      }
      const n = Number(j.writtenVerseRefs ?? 0);
      setSaveMsg(gv("saveDone", { count: String(n), cap: String(SITE_VERSE_POOL_MAX) }));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }, [gv, rt, selected]);

  if (loading) {
    return <p className="mt-6 text-[13px] text-adminMuted">{rt("loading")}</p>;
  }

  if (missingDb) {
    return (
      <div className="mt-8 max-w-2xl rounded-lg border border-adminLine/80 bg-adminPanel/40 p-5 text-[13px] leading-relaxed text-adminMuted">
        <p className="font-medium text-adminFg">{rt("missingTitle")}</p>
        <p className="mt-3">{rt("missingBody")}</p>
        <pre className="mt-4 overflow-x-auto rounded-md border border-adminLine/60 bg-adminBg/50 p-3 font-mono text-[11px] text-adminFg/90">
          {`npm run import:reader-verse-themes -- ~/Desktop/APP/BIBLE/data/reader_zh_cn_verse_categories.json`}
        </pre>
        <p className="mt-3 text-[12px]">{rt("missingNote")}</p>
        <p className="mt-4 text-[12px]">
          <Link href="/admin/read/golden-verse-themes" className="font-medium text-adminFg underline underline-offset-2">
            {gv("openThemesPage")}
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-6">
      {err ? <p className="text-[12px] text-red-700/90 dark:text-red-300/90">{err}</p> : null}
      {saveMsg ? <p className="text-[12px] text-emerald-800/90 dark:text-emerald-200/90">{saveMsg}</p> : null}

      <section className="rounded-lg border border-adminLine/80 bg-adminPanel/40 p-4 md:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[12px] text-adminMuted">
            {gv("selectedCount", { count: String(selected.size) })}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={selectAllFiltered}
              disabled={!filteredKeys.size}
              className="rounded-md border border-adminLine/80 bg-adminBg/60 px-3 py-1.5 text-[12px] font-medium text-adminFg transition hover:bg-adminFg/[0.06] disabled:opacity-40"
            >
              {gv("selectFiltered")}
            </button>
            <button
              type="button"
              onClick={clearAll}
              disabled={!selected.size}
              className="rounded-md border border-adminLine/80 bg-adminBg/60 px-3 py-1.5 text-[12px] font-medium text-adminFg transition hover:bg-adminFg/[0.06] disabled:opacity-40"
            >
              {gv("clearAll")}
            </button>
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving}
              className="rounded-md border border-adminFg/30 bg-adminFg/[0.12] px-4 py-1.5 text-[12px] font-semibold text-adminFg transition hover:bg-adminFg/[0.18] disabled:opacity-50"
            >
              {saving ? gv("saving") : gv("save")}
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-adminLine/80 bg-adminPanel/40 p-4 md:p-5">
        <label className="block text-[12px] font-medium text-adminFg" htmlFor="golden-theme-search">
          {rt("searchLabel")}
        </label>
        <input
          id="golden-theme-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={rt("searchPlaceholder")}
          className="mt-2 w-full rounded-md border border-adminLine bg-adminBg px-3 py-2 text-[13px] text-adminFg outline-none ring-adminFg/10 placeholder:text-adminMuted/60 focus:border-adminFg/25 focus:ring-2"
        />
        <p className="mt-2 text-[11px] text-adminMuted">{rt("searchHint")}</p>
      </section>

      <section className="min-w-0 space-y-6">
        {grouped.length === 0 ? (
          <div className="rounded-lg border border-dashed border-adminLine/80 bg-adminBg/30 px-4 py-8 text-center text-[13px] text-adminMuted">
            {rt("emptyTags")}
          </div>
        ) : (
          grouped.map((g) => (
            <div key={g.categoryName} id={`golden-group-${g.categoryName}`} className="scroll-mt-6">
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2 border-b border-adminLine/70 pb-2">
                <h3 className="text-[15px] font-semibold tracking-tight text-adminFg">{g.categoryName}</h3>
                <span className="text-[11px] text-adminMuted">
                  {g.count} {rt("tagsSuffix")}
                </span>
              </div>
              {g.categoryName === "复合标签" ? (
                <div className="space-y-5">
                  {groupCompositeReaderThemeItems(g.items).map((sub) => (
                    <div key={sub.name}>
                      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                        <h4 className="text-[13px] font-medium text-adminFg">{sub.name}</h4>
                        <span className="text-[11px] text-adminMuted">
                          {sub.items.length} {rt("tagsSuffix")}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {sub.items.map((row) => {
                          const on = selected.has(row.key);
                          return (
                            <button
                              key={row.key}
                              type="button"
                              onClick={() => toggleKey(row.key)}
                              aria-pressed={on}
                              className={[
                                "inline-flex max-w-full items-center gap-1.5 rounded-full border px-3 py-1.5 text-left text-[12px] font-medium transition-colors",
                                on
                                  ? "border-adminFg/40 bg-adminFg/[0.12] text-adminFg"
                                  : "border-adminLine/80 bg-adminBg/50 text-adminFg/90 hover:border-adminFg/20 hover:bg-adminFg/[0.06]",
                              ].join(" ")}
                            >
                              <span className="truncate">{row.displayName || row.name}</span>
                              <span className="shrink-0 tabular-nums text-[11px] text-adminMuted">{row.verseCount}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {g.items.map((row) => {
                    const on = selected.has(row.key);
                    return (
                      <button
                        key={row.key}
                        type="button"
                        onClick={() => toggleKey(row.key)}
                        aria-pressed={on}
                        className={[
                          "inline-flex max-w-full items-center gap-1.5 rounded-full border px-3 py-1.5 text-left text-[12px] font-medium transition-colors",
                          on
                            ? "border-adminFg/40 bg-adminFg/[0.12] text-adminFg"
                            : "border-adminLine/80 bg-adminBg/50 text-adminFg/90 hover:border-adminFg/20 hover:bg-adminFg/[0.06]",
                        ].join(" ")}
                      >
                        <span className="truncate">{row.displayName || row.name}</span>
                        <span className="shrink-0 tabular-nums text-[11px] text-adminMuted">{row.verseCount}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))
        )}
      </section>
    </div>
  );
}
