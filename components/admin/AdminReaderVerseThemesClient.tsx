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

type MetaOk = {
  ok: true;
  categoryCount: number;
  subcategoryCount: number;
  verseRowCount: number;
};

type IndexOk = { ok: true; rows: ReaderThemeFlatRow[] };

type VerseItem = {
  position: number;
  reference: string;
  book: string;
  bookId: string | null;
  chapterStart: number;
  verseStart: number;
  chapterEnd: number;
  verseEnd: number;
  text: string;
  readHref: string | null;
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

function normalizeSearch(s: string): string {
  return String(s ?? "").trim().toLowerCase();
}

export function AdminReaderVerseThemesClient() {
  const { t } = useLocale();
  const rt = useCallback((key: string, vars?: Record<string, string>) => t(`admin.readerVerseThemes.${key}`, vars), [t]);

  const [err, setErr] = useState<string | null>(null);
  const [missingDb, setMissingDb] = useState(false);
  const [meta, setMeta] = useState<MetaOk | null>(null);
  const [rows, setRows] = useState<ReaderThemeFlatRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState("");
  const [selectedKey, setSelectedKey] = useState<string>("");

  const [verses, setVerses] = useState<VerseItem[]>([]);
  const [versesTotal, setVersesTotal] = useState(0);
  const [versesOffset, setVersesOffset] = useState(0);
  const [versesLoading, setVersesLoading] = useState(false);

  const pageSize = 40;

  const loadAll = useCallback(async () => {
    setLoading(true);
    setErr(null);
    setMissingDb(false);
    try {
      const r0 = await fetch("/api/admin/bible/reader-verse-themes?mode=meta", { headers: { ...diskAuthHeaders() } });
      const j0 = await parseJson(r0);
      if (!r0.ok) {
        const e = typeof j0.error === "string" ? j0.error : rt("loadFailed", { status: String(r0.status) });
        throw new Error(e + (r0.status === 403 ? ` ${rt("diskHint")}` : ""));
      }
      if (j0.missingDb) {
        setMissingDb(true);
        setMeta(null);
        setRows([]);
        return;
      }
      if (j0.ok !== true) throw new Error(rt("badResponse"));

      setMeta({
        ok: true,
        categoryCount: Number(j0.categoryCount ?? 0),
        subcategoryCount: Number(j0.subcategoryCount ?? 0),
        verseRowCount: Number(j0.verseRowCount ?? 0),
      });

      const r1 = await fetch("/api/admin/bible/reader-verse-themes?mode=index", { headers: { ...diskAuthHeaders() } });
      const j1 = await parseJson(r1);
      if (!r1.ok) {
        const e = typeof j1.error === "string" ? j1.error : rt("loadFailed", { status: String(r1.status) });
        throw new Error(e);
      }
      const ix = j1 as unknown as IndexOk;
      setRows(Array.isArray(ix.rows) ? ix.rows : []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setMeta(null);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [rt]);

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

  const selected = useMemo(
    () => rows.find((r) => r.key === selectedKey) ?? null,
    [rows, selectedKey],
  );

  const loadVerses = useCallback(
    async (key: string, offset: number, append: boolean) => {
      const [ca, su] = key.split("-");
      const categoryId = Number(ca);
      const subId = Number(su);
      if (!Number.isFinite(categoryId) || !Number.isFinite(subId)) return;
      setVersesLoading(true);
      setErr(null);
      try {
        const p = new URLSearchParams({
          mode: "verses",
          categoryId: String(categoryId),
          subId: String(subId),
          limit: String(pageSize),
          offset: String(offset),
        });
        const res = await fetch(`/api/admin/bible/reader-verse-themes?${p}`, { headers: { ...diskAuthHeaders() } });
        const j = await parseJson(res);
        if (!res.ok) throw new Error(typeof j.error === "string" ? j.error : rt("loadFailed", { status: String(res.status) }));
        const items = Array.isArray(j.items) ? (j.items as VerseItem[]) : [];
        const total = Number(j.total ?? 0);
        setVersesTotal(total);
        setVersesOffset(offset + items.length);
        setVerses((prev) => (append ? [...prev, ...items] : items));
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
      } finally {
        setVersesLoading(false);
      }
    },
    [rt],
  );

  useEffect(() => {
    if (!selectedKey) {
      setVerses([]);
      setVersesTotal(0);
      setVersesOffset(0);
      return;
    }
    void loadVerses(selectedKey, 0, false);
  }, [selectedKey, loadVerses]);

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
      </div>
    );
  }

  if (err && !rows.length) {
    return <p className="mt-6 text-[13px] text-red-700/90 dark:text-red-300/90">{err}</p>;
  }

  return (
    <div className="mt-8 space-y-8">
      {err ? <p className="text-[12px] text-red-700/90 dark:text-red-300/90">{err}</p> : null}

      {meta ? (
        <section className="rounded-lg border border-adminLine/80 bg-adminPanel/40 p-4 md:p-5">
          <h2 className="text-[13px] font-medium text-adminFg">{rt("statsTitle")}</h2>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-md border border-adminLine/60 bg-adminBg/40 px-3 py-3">
              <p className="text-[22px] font-semibold tabular-nums text-adminFg">{meta.categoryCount}</p>
              <p className="text-[11px] text-adminMuted">{rt("statCategories")}</p>
            </div>
            <div className="rounded-md border border-adminLine/60 bg-adminBg/40 px-3 py-3">
              <p className="text-[22px] font-semibold tabular-nums text-adminFg">{meta.subcategoryCount}</p>
              <p className="text-[11px] text-adminMuted">{rt("statSubcategories")}</p>
            </div>
            <div className="rounded-md border border-adminLine/60 bg-adminBg/40 px-3 py-3">
              <p className="text-[22px] font-semibold tabular-nums text-adminFg">{meta.verseRowCount}</p>
              <p className="text-[11px] text-adminMuted">{rt("statVerses")}</p>
            </div>
          </div>
        </section>
      ) : null}

      <section className="rounded-lg border border-adminLine/80 bg-adminPanel/40 p-4 md:p-5">
        <label className="block text-[12px] font-medium text-adminFg" htmlFor="reader-theme-search">
          {rt("searchLabel")}
        </label>
        <input
          id="reader-theme-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={rt("searchPlaceholder")}
          className="mt-2 w-full rounded-md border border-adminLine bg-adminBg px-3 py-2 text-[13px] text-adminFg outline-none ring-adminFg/10 placeholder:text-adminMuted/60 focus:border-adminFg/25 focus:ring-2"
        />
        <p className="mt-2 text-[11px] text-adminMuted">{rt("searchHint")}</p>
      </section>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <section className="min-w-0 space-y-6">
          {grouped.length === 0 ? (
            <div className="rounded-lg border border-dashed border-adminLine/80 bg-adminBg/30 px-4 py-8 text-center text-[13px] text-adminMuted">
              {rt("emptyTags")}
            </div>
          ) : (
            grouped.map((g) => (
              <div key={g.categoryName} id={`group-${g.categoryName}`} className="scroll-mt-6">
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
                          {sub.items.map((row) => (
                            <button
                              key={row.key}
                              type="button"
                              onClick={() => setSelectedKey(row.key)}
                              className={[
                                "inline-flex max-w-full items-center gap-1.5 rounded-full border px-3 py-1.5 text-left text-[12px] font-medium transition-colors",
                                selectedKey === row.key
                                  ? "border-adminFg/40 bg-adminFg/[0.12] text-adminFg"
                                  : "border-adminLine/80 bg-adminBg/50 text-adminFg/90 hover:border-adminFg/20 hover:bg-adminFg/[0.06]",
                              ].join(" ")}
                            >
                              <span className="truncate">{row.displayName || row.name}</span>
                              <span className="shrink-0 tabular-nums text-[11px] text-adminMuted">{row.verseCount}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {g.items.map((row) => (
                      <button
                        key={row.key}
                        type="button"
                        onClick={() => setSelectedKey(row.key)}
                        className={[
                          "inline-flex max-w-full items-center gap-1.5 rounded-full border px-3 py-1.5 text-left text-[12px] font-medium transition-colors",
                          selectedKey === row.key
                            ? "border-adminFg/40 bg-adminFg/[0.12] text-adminFg"
                            : "border-adminLine/80 bg-adminBg/50 text-adminFg/90 hover:border-adminFg/20 hover:bg-adminFg/[0.06]",
                        ].join(" ")}
                      >
                        <span className="truncate">{row.displayName || row.name}</span>
                        <span className="shrink-0 tabular-nums text-[11px] text-adminMuted">{row.verseCount}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </section>

        <aside className="min-w-0 lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-lg border border-adminLine/80 bg-adminPanel/40 p-4 md:p-5">
            <h3 className="text-[13px] font-medium text-adminFg">{rt("detailTitle")}</h3>
            {!selected ? (
              <p className="mt-3 text-[12px] leading-relaxed text-adminMuted">{rt("detailEmpty")}</p>
            ) : (
              <>
                <p className="mt-2 text-[12px] text-adminMuted">
                  {selected.bucket} · <span className="text-adminFg/90">{selected.displayName || selected.name}</span>
                </p>
                {selected.title?.trim() ? <p className="mt-1 text-[11px] text-adminMuted">{selected.title}</p> : null}
                <div className="mt-4 space-y-3">
                  {verses.map((v, i) => (
                    <div
                      key={`${v.position}-${i}`}
                      className="rounded-md border border-adminLine/60 bg-adminBg/50 px-3 py-2.5 text-[13px] leading-relaxed text-adminFg/95"
                    >
                      <p className="whitespace-pre-wrap">{v.text}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                        <span className="font-medium text-adminFg/85">{v.reference}</span>
                        {v.readHref ? (
                          <Link href={v.readHref} className="text-adminFg underline underline-offset-2">
                            {rt("openRead")}
                          </Link>
                        ) : (
                          <span className="text-adminMuted">{rt("noReadLink")}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {versesLoading ? <p className="mt-3 text-[11px] text-adminMuted">{rt("versesLoading")}</p> : null}
                {selected && versesOffset < versesTotal ? (
                  <button
                    type="button"
                    disabled={versesLoading}
                    onClick={() => void loadVerses(selectedKey, versesOffset, true)}
                    className="mt-4 w-full rounded-md border border-adminLine/80 bg-adminBg/60 py-2 text-[12px] font-medium text-adminFg transition hover:bg-adminFg/[0.06] disabled:opacity-50"
                  >
                    {rt("loadMore", { from: String(versesOffset), total: String(versesTotal) })}
                  </button>
                ) : null}
              </>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
