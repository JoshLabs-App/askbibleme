"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { ADMIN_MAIN_CLASS } from "@/components/admin/admin-layout";
import { diskAuthHeaders } from "@/lib/disk-auth-headers";

async function parseJson(res: Response, badJsonMessage: string): Promise<Record<string, unknown>> {
  const text = await res.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(badJsonMessage);
  }
}

type CompanionFlags = { quiet: boolean; pray: boolean; form: boolean };

type ListRow = {
  id: number;
  topic: string;
  osis: string;
  osisDisplay: string;
  qualityScore: number;
  verseCount: number | null;
  topicZh: string | null;
  companion: CompanionFlags;
};

type TopicIndexEntry = { topic: string; count: number; topicZh: string | null };

type DetailPayload = {
  row: ListRow;
  footnote: string | null;
  previewLines: string[] | null;
  parseNote: string | null;
  readHref: string | null;
  verseSpan: { bookId: string; chapter: number; verseStart: number; verseEnd: number } | null;
};

const LETTER_KEYS = "abcdefghijklmnopqrstuvwxyz".split("") as string[];

const VERSE_BUCKET_KEYS = ["all", "1", "2", "3", "4plus", "unknown"] as const;

const COMPANION_DIRECTION_KEYS = ["all", "quiet", "pray", "form"] as const;

function companionFromApiPayload(c: unknown): CompanionFlags {
  if (!c || typeof c !== "object") return { quiet: false, pray: false, form: false };
  const o = c as Record<string, unknown>;
  return {
    quiet: Boolean(o.quiet),
    pray: Boolean(o.pray),
    form: Boolean(o.form),
  };
}

/** 陪伴方向：仅图形；说明用外层 title / aria-label */
function CompanionDirIcon({
  kind,
  className,
}: {
  kind: (typeof COMPANION_DIRECTION_KEYS)[number] | "quietBadge" | "prayBadge" | "formBadge";
  className?: string;
}) {
  const cn = className ?? "h-5 w-5";
  const common = { className: cn, viewBox: "0 0 24 24", fill: "none", "aria-hidden": true as const };
  if (kind === "all") {
    return (
      <svg {...common} xmlns="http://www.w3.org/2000/svg">
        <path
          d="M4 4h7v7H4V4zm9 0h7v7h-7V4zM4 13h7v7H4v-7zm9 0h7v7h-7v-7z"
          stroke="currentColor"
          strokeWidth="1.35"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (kind === "quiet" || kind === "quietBadge") {
    return (
      <svg {...common} xmlns="http://www.w3.org/2000/svg">
        <path
          d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"
          stroke="currentColor"
          strokeWidth="1.35"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (kind === "pray" || kind === "prayBadge") {
    return (
      <svg {...common} xmlns="http://www.w3.org/2000/svg">
        <path
          d="M12 3a3 3 0 00-3 3v6a3 3 0 006 0V6a3 3 0 00-3-3zM19 10v1a7 7 0 01-14 0v-1M12 19v3"
          stroke="currentColor"
          strokeWidth="1.35"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (kind === "form" || kind === "formBadge") {
    return (
      <svg {...common} xmlns="http://www.w3.org/2000/svg">
        <path
          d="M5 3h14v18l-7-3.5L5 21V3z"
          stroke="currentColor"
          strokeWidth="1.35"
          strokeLinejoin="round"
        />
        <path d="M9 8h6M9 11h6M9 14h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    );
  }
  return null;
}

export function OpenbibleTopicsAdminClient() {
  const { t, locale } = useLocale();
  const ot = useCallback((key: string, vars?: Record<string, string>) => t(`admin.openbibleTopics.${key}`, vars), [t]);

  const [topicDraft, setTopicDraft] = useState("");
  const [osisDraft, setOsisDraft] = useState("");
  const [topicDebounced, setTopicDebounced] = useState("");
  const [osisDebounced, setOsisDebounced] = useState("");

  const [topicExact, setTopicExact] = useState("");
  const [minScore, setMinScore] = useState("");
  const [maxScore, setMaxScore] = useState("");
  const [sort, setSort] = useState<string>("id_asc");
  const [verseBucket, setVerseBucket] = useState<(typeof VERSE_BUCKET_KEYS)[number]>("all");
  const [companionDirection, setCompanionDirection] = useState<(typeof COMPANION_DIRECTION_KEYS)[number]>("all");
  const [limit, setLimit] = useState(50);
  const [offset, setOffset] = useState(0);

  const [verseCountReady, setVerseCountReady] = useState<boolean | null>(null);
  const [verseCountFilterIgnored, setVerseCountFilterIgnored] = useState(false);
  const [companionDirectionReady, setCompanionDirectionReady] = useState<boolean | null>(null);
  const [companionDirectionFilterIgnored, setCompanionDirectionFilterIgnored] = useState(false);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [rows, setRows] = useState<ListRow[]>([]);
  const [meta, setMeta] = useState<Record<string, string>>({});
  const [noDb, setNoDb] = useState(false);

  const [facets, setFacets] = useState<{
    rowCount: number;
    distinctTopics: number;
    scoreBuckets: { score: number; count: number }[];
  } | null>(null);

  const [browsePrefix, setBrowsePrefix] = useState<string>("a");
  const [topicIndexRows, setTopicIndexRows] = useState<TopicIndexEntry[]>([]);
  const [topicIndexTotal, setTopicIndexTotal] = useState(0);
  const [topicIndexLoading, setTopicIndexLoading] = useState(false);

  const pinnedTopicZh = useMemo(() => {
    if (!topicExact) return null;
    const hit = topicIndexRows.find((x) => x.topic === topicExact);
    return hit?.topicZh ?? null;
  }, [topicExact, topicIndexRows]);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<DetailPayload | null>(null);
  const [detailBusy, setDetailBusy] = useState(false);
  const [copyMsg, setCopyMsg] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setTopicDebounced(topicDraft.trim());
      setOsisDebounced(osisDraft.trim());
    }, 380);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [topicDraft, osisDraft]);

  useEffect(() => {
    setOffset(0);
  }, [topicDebounced, osisDebounced, topicExact, minScore, maxScore, sort, verseBucket, companionDirection]);

  const listQueryString = useMemo(() => {
    const p = new URLSearchParams();
    if (topicExact.trim()) p.set("topicExact", topicExact.trim());
    else if (topicDebounced) p.set("topic", topicDebounced);
    if (osisDebounced) p.set("osis", osisDebounced);
    if (minScore.trim()) p.set("minScore", minScore.trim());
    if (maxScore.trim()) p.set("maxScore", maxScore.trim());
    if (sort && sort !== "id_asc") p.set("sort", sort);
    if (verseBucket !== "all") p.set("verseBucket", verseBucket);
    if (companionDirection !== "all") p.set("companionDirection", companionDirection);
    p.set("limit", String(limit));
    p.set("offset", String(offset));
    p.set("locale", locale);
    return p.toString();
  }, [
    topicDebounced,
    osisDebounced,
    topicExact,
    minScore,
    maxScore,
    sort,
    limit,
    offset,
    locale,
    verseBucket,
    companionDirection,
  ]);

  const loadList = useCallback(async () => {
    setLoading(true);
    setErr(null);
    setNoDb(false);
    try {
      const res = await fetch(`/api/admin/bible/openbible-topics?${listQueryString}`, {
        headers: { ...diskAuthHeaders() },
      });
      const j = await parseJson(res, ot("badJsonResponse", { status: String(res.status) }));
      if (res.status === 404 && j.error === "NO_DB") {
        setNoDb(true);
        setTotal(null);
        setRows([]);
        setMeta({});
        setVerseCountReady(null);
        setCompanionDirectionReady(null);
        setCompanionDirectionFilterIgnored(false);
        return;
      }
      if (!res.ok) {
        const msg = typeof j.error === "string" ? j.error : ot("loadFailed", { status: String(res.status) });
        throw new Error(msg + (res.status === 403 ? ` ${ot("diskHint")}` : ""));
      }
      if (!j.ok) throw new Error(ot("loadFailed", { status: String(res.status) }));
      setVerseCountReady(j.verseCountReady !== false);
      setVerseCountFilterIgnored(j.verseCountFilterIgnored === true);
      setCompanionDirectionReady(j.companionDirectionReady !== false);
      setCompanionDirectionFilterIgnored(j.companionDirectionFilterIgnored === true);
      setTotal(Number(j.total ?? 0));
      const rawRows = (j.rows as Partial<ListRow>[]) ?? [];
      setRows(
        rawRows.map((r) => ({
          id: Number(r.id),
          topic: String(r.topic ?? ""),
          osis: String(r.osis ?? ""),
          osisDisplay: String(r.osisDisplay ?? r.osis ?? ""),
          qualityScore: Number(r.qualityScore ?? 0),
          verseCount:
            r.verseCount === undefined || r.verseCount === null || Number.isNaN(Number(r.verseCount))
              ? null
              : Number(r.verseCount),
          topicZh: r.topicZh === undefined || r.topicZh === "" ? null : (r.topicZh as string | null),
          companion: companionFromApiPayload(r.companion),
        })),
      );
      setMeta((j.meta as Record<string, string>) ?? {});
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setRows([]);
      setTotal(null);
    } finally {
      setLoading(false);
    }
  }, [listQueryString, ot]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const loadFacetsOnce = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/bible/openbible-topics?facetsOnly=1`, {
        headers: { ...diskAuthHeaders() },
      });
      const j = await parseJson(res, ot("badJsonResponse", { status: String(res.status) }));
      if (!res.ok || !j.ok) return;
      const f = j.facets as {
        rowCount?: number;
        distinctTopics?: number;
        scoreBuckets?: { score: number; count: number }[];
      } | null;
      if (f && typeof f.rowCount === "number" && typeof f.distinctTopics === "number" && Array.isArray(f.scoreBuckets)) {
        setFacets({
          rowCount: f.rowCount,
          distinctTopics: f.distinctTopics,
          scoreBuckets: f.scoreBuckets,
        });
      }
    } catch {
      /* ignore */
    }
  }, [ot]);

  useEffect(() => {
    if (!noDb) void loadFacetsOnce();
  }, [noDb, loadFacetsOnce]);

  const loadTopicIndexPage = useCallback(
    async (offset: number, append: boolean) => {
      setTopicIndexLoading(true);
      try {
        const p = new URLSearchParams();
        p.set("topicIndex", "1");
        p.set("prefix", browsePrefix);
        p.set("limit", "120");
        p.set("offset", String(offset));
        p.set("locale", locale);
        const res = await fetch(`/api/admin/bible/openbible-topics?${p.toString()}`, {
          headers: { ...diskAuthHeaders() },
        });
        const j = await parseJson(res, ot("badJsonResponse", { status: String(res.status) }));
        if (res.ok && j.ok && j.mode === "topicIndex") {
          const next = (j.topics as TopicIndexEntry[]) ?? [];
          const tot = Number(j.topicTotal ?? 0);
          setTopicIndexTotal(tot);
          setTopicIndexRows((prev) => (append ? [...prev, ...next] : next));
        }
      } catch {
        if (!append) setTopicIndexRows([]);
      } finally {
        setTopicIndexLoading(false);
      }
    },
    [browsePrefix, locale, ot],
  );

  useEffect(() => {
    if (noDb) return;
    void loadTopicIndexPage(0, false);
  }, [noDb, browsePrefix, loadTopicIndexPage]);

  const loadMoreTopics = useCallback(() => {
    void loadTopicIndexPage(topicIndexRows.length, true);
  }, [loadTopicIndexPage, topicIndexRows.length]);

  const loadDetail = useCallback(
    async (id: number) => {
      setDetailBusy(true);
      setErr(null);
      try {
        const p = new URLSearchParams();
        p.set("id", String(id));
        p.set("includeText", "1");
        p.set("locale", locale);
        const res = await fetch(`/api/admin/bible/openbible-topics?${p.toString()}`, {
          headers: { ...diskAuthHeaders() },
        });
        const j = await parseJson(res, ot("badJsonResponse", { status: String(res.status) }));
        if (!res.ok) {
          const msg = typeof j.error === "string" ? j.error : ot("detailFailed");
          throw new Error(msg);
        }
        const row = j.row as {
          id?: number;
          topic?: string;
          osis?: string;
          osisDisplay?: string;
          qualityScore?: number;
          verseCount?: number | null;
          topicZh?: string | null;
          companion?: unknown;
        };
        const osisRaw = String(row.osis ?? "");
        const payload: DetailPayload = {
          row: {
            id: Number(row.id),
            topic: String(row.topic ?? ""),
            osis: osisRaw,
            osisDisplay: String(row.osisDisplay ?? osisRaw),
            qualityScore: Number(row.qualityScore ?? 0),
            verseCount:
              row.verseCount === undefined || row.verseCount === null || Number.isNaN(Number(row.verseCount))
                ? null
                : Number(row.verseCount),
            topicZh: row.topicZh === undefined || row.topicZh === "" ? null : String(row.topicZh),
            companion: companionFromApiPayload(row.companion),
          },
          footnote: (j.footnote as string | null) ?? null,
          previewLines: (j.previewLines as string[] | null) ?? null,
          parseNote: (j.parseNote as string | null) ?? null,
          readHref: (j.readHref as string | null) ?? null,
          verseSpan: (j.verseSpan as DetailPayload["verseSpan"]) ?? null,
        };
        setDetail(payload);
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
        setDetail(null);
      } finally {
        setDetailBusy(false);
      }
    },
    [locale, ot],
  );

  useEffect(() => {
    if (selectedId == null) {
      setDetail(null);
      return;
    }
    void loadDetail(selectedId);
  }, [selectedId, loadDetail]);

  const copyText = useCallback(async (_label: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyMsg("1");
      window.setTimeout(() => setCopyMsg(null), 1600);
    } catch {
      setCopyMsg(null);
    }
  }, []);

  const canPrev = offset > 0;
  const canNext = total != null && offset + rows.length < total;
  const maxBucket = facets?.scoreBuckets.length
    ? Math.max(...facets.scoreBuckets.map((b) => b.count), 1)
    : 1;

  const resetAll = () => {
    setTopicDraft("");
    setOsisDraft("");
    setTopicDebounced("");
    setOsisDebounced("");
    setTopicExact("");
    setMinScore("");
    setMaxScore("");
    setSort("id_asc");
    setVerseBucket("all");
    setCompanionDirection("all");
    setLimit(50);
    setOffset(0);
    setSelectedId(null);
    setVerseCountFilterIgnored(false);
    setCompanionDirectionFilterIgnored(false);
  };

  return (
    <div className={`${ADMIN_MAIN_CLASS} max-w-[100rem]`}>
      <h1 className="text-lg font-medium tracking-tight text-adminFg">{ot("title")}</h1>
      <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-adminMuted">{ot("intro")}</p>
      <p className="mt-2 font-mono text-[11px] leading-relaxed text-adminMuted">{ot("dataPaths")}</p>
      <p className="mt-1 text-[11px] text-adminMuted/90">{ot("layoutHint")}</p>

      <section className="mt-4 overflow-x-auto rounded-lg border border-adminLine/80 bg-adminPanel/40 p-3 md:p-4" aria-labelledby="openbible-directions-heading">
        <h2 id="openbible-directions-heading" className="text-[13px] font-medium text-adminFg">
          {ot("directionsTitle")}
        </h2>
        <p className="mt-1.5 max-w-3xl text-[11px] leading-relaxed text-adminMuted">{ot("directionsBlurb")}</p>
        <table className="mt-3 w-full min-w-[min(100%,42rem)] border-collapse text-left text-[12px]">
          <thead>
            <tr className="border-b border-adminLine text-[11px] text-adminMuted">
              <th className="py-2 pr-3 font-medium whitespace-nowrap align-bottom">{ot("directionsThDirection")}</th>
              <th className="py-2 pr-3 font-medium align-bottom">{ot("directionsThRole")}</th>
              <th className="py-2 pr-2 font-medium align-bottom">{ot("directionsThPromise")}</th>
            </tr>
          </thead>
          <tbody className="text-adminFg/95">
            <tr className="border-b border-adminLine/70 align-top">
              <td className="py-2.5 pr-3 font-medium text-adminFg whitespace-nowrap">{ot("directionRow1Name")}</td>
              <td className="py-2.5 pr-3 leading-snug text-adminFg/90">{ot("directionRow1Role")}</td>
              <td className="py-2.5 pr-2 leading-snug text-adminMuted">{ot("directionRow1Promise")}</td>
            </tr>
            <tr className="border-b border-adminLine/70 align-top">
              <td className="py-2.5 pr-3 font-medium text-adminFg whitespace-nowrap">{ot("directionRow2Name")}</td>
              <td className="py-2.5 pr-3 leading-snug text-adminFg/90">{ot("directionRow2Role")}</td>
              <td className="py-2.5 pr-2 leading-snug text-adminMuted">{ot("directionRow2Promise")}</td>
            </tr>
            <tr className="align-top">
              <td className="py-2.5 pr-3 font-medium text-adminFg whitespace-nowrap">{ot("directionRow3Name")}</td>
              <td className="py-2.5 pr-3 leading-snug text-adminFg/90">{ot("directionRow3Role")}</td>
              <td className="py-2.5 pr-2 leading-snug text-adminMuted">{ot("directionRow3Promise")}</td>
            </tr>
          </tbody>
        </table>

        <div className="mt-4 border-t border-adminLine/70 pt-3" role="group" aria-label={ot("companionDirectionSection")}>
          <div className="flex flex-wrap items-center gap-2">
            {COMPANION_DIRECTION_KEYS.map((k) => (
              <button
                key={k}
                type="button"
                aria-label={
                  k === "all"
                    ? ot("companionAll")
                    : k === "quiet"
                      ? ot("directionRow1Name")
                      : k === "pray"
                        ? ot("directionRow2Name")
                        : ot("directionRow3Name")
                }
                title={
                  k === "all"
                    ? ot("companionAll")
                    : k === "quiet"
                      ? ot("directionRow1Name")
                      : k === "pray"
                        ? ot("directionRow2Name")
                        : ot("directionRow3Name")
                }
                className={`flex h-11 min-w-[2.75rem] items-center justify-center rounded-xl border px-3 transition-colors ${
                  companionDirection === k
                    ? "border-adminFg/50 bg-adminFg/[0.16] text-adminFg shadow-sm"
                    : "border-adminLine bg-adminBg/50 text-adminFg/90 hover:border-adminFg/30 hover:bg-adminFg/[0.06]"
                }`}
                onClick={() => setCompanionDirection(k)}
              >
                <CompanionDirIcon kind={k} className="h-6 w-6" />
              </button>
            ))}
          </div>
          {companionDirectionReady === false ? (
            <p className="mt-2 text-[11px] leading-snug text-amber-800 dark:text-amber-200/90">{ot("companionDirectionHintNoColumn")}</p>
          ) : null}
          {companionDirectionFilterIgnored ? (
            <p className="mt-1 text-[11px] leading-snug text-amber-800 dark:text-amber-200/90">{ot("companionDirectionFilterIgnored")}</p>
          ) : null}
        </div>
      </section>

      {noDb ? (
        <p className="mt-4 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[13px] text-amber-900 dark:text-amber-100/90">
          {ot("missingDb")}
        </p>
      ) : null}

      {Object.keys(meta).length > 0 ? (
        <div className="mt-4 rounded-lg border border-adminLine/80 bg-adminPanel/40 px-3 py-2 text-[12px] text-adminMuted">
          {meta.imported_at ? (
            <p>
              <span className="text-adminFg/80">{ot("metaImported")}</span> {meta.imported_at}
            </p>
          ) : null}
          {meta.row_count ? (
            <p>
              <span className="text-adminFg/80">{ot("metaRows")}</span> {meta.row_count}
            </p>
          ) : null}
          {meta.source_tsv ? (
            <p className="break-all">
              <span className="text-adminFg/80">{ot("metaSource")}</span> {meta.source_tsv}
            </p>
          ) : null}
        </div>
      ) : null}

      {facets ? (
        <section className="mt-5 rounded-lg border border-adminLine/80 bg-adminPanel/40 p-4">
          <h2 className="text-[13px] font-medium text-adminFg">{ot("statsTitle")}</h2>
          <div className="mt-2 flex flex-wrap gap-4 text-[12px] text-adminMuted">
            <span>
              <span className="text-adminFg/85">{ot("statsRows")}</span>{" "}
              <span className="tabular-nums text-adminFg">{facets.rowCount}</span>
            </span>
            <span>
              <span className="text-adminFg/85">{ot("statsDistinct")}</span>{" "}
              <span className="tabular-nums text-adminFg">{facets.distinctTopics}</span>
            </span>
          </div>
          <p className="mt-3 text-[11px] font-medium text-adminFg/80">{ot("scoreDist")}</p>
          <div className="mt-2 flex max-h-24 flex-wrap gap-x-3 gap-y-1 overflow-y-auto">
            {facets.scoreBuckets.slice(0, 24).map((b) => (
              <div key={b.score} className="flex items-center gap-1.5 text-[10px] text-adminMuted">
                <span className="w-5 tabular-nums text-adminFg/80">{b.score}</span>
                <div className="h-2 w-16 overflow-hidden rounded-sm bg-adminLine/60">
                  <div
                    className="h-full bg-adminFg/30"
                    style={{ width: `${Math.max(8, (b.count / maxBucket) * 100)}%` }}
                  />
                </div>
                <span className="tabular-nums">{b.count}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(200px,240px)_minmax(0,1fr)_minmax(260px,340px)]">
        {/* 左：首字母 + 主题目录 */}
        <aside className="rounded-lg border border-adminLine/80 bg-adminPanel/40 p-3 xl:sticky xl:top-4 xl:self-start">
          <h2 className="text-[13px] font-medium text-adminFg">{ot("browseTitle")}</h2>
          <p className="mt-1 text-[11px] leading-snug text-adminMuted">{ot("browseHint")}</p>
          <div className="mt-3 flex flex-wrap gap-1">
            {LETTER_KEYS.map((ch) => (
              <button
                key={ch}
                type="button"
                title={ch}
                className={`h-7 min-w-[1.65rem] rounded border px-1.5 text-[11px] font-medium ${
                  browsePrefix === ch
                    ? "border-adminFg/40 bg-adminFg/[0.12] text-adminFg"
                    : "border-adminLine/80 text-adminMuted hover:bg-adminFg/[0.06] hover:text-adminFg"
                }`}
                onClick={() => setBrowsePrefix(ch)}
              >
                {ch.toUpperCase()}
              </button>
            ))}
            <button
              type="button"
              className={`h-7 min-w-[2.25rem] rounded border px-1.5 text-[10px] font-medium ${
                browsePrefix === "@"
                  ? "border-adminFg/40 bg-adminFg/[0.12] text-adminFg"
                  : "border-adminLine/80 text-adminMuted hover:bg-adminFg/[0.06]"
              }`}
              onClick={() => setBrowsePrefix("@")}
            >
              {ot("prefixDigit")}
            </button>
            <button
              type="button"
              className={`h-7 min-w-[2.25rem] rounded border px-1.5 text-[10px] font-medium ${
                browsePrefix === "#"
                  ? "border-adminFg/40 bg-adminFg/[0.12] text-adminFg"
                  : "border-adminLine/80 text-adminMuted hover:bg-adminFg/[0.06]"
              }`}
              onClick={() => setBrowsePrefix("#")}
            >
              {ot("prefixOther")}
            </button>
          </div>
          <h3 className="mt-4 text-[12px] font-medium text-adminFg/90">{ot("topicListHeading")}</h3>
          {topicIndexLoading ? (
            <p className="mt-2 text-[11px] text-adminMuted">{ot("loading")}</p>
          ) : (
            <ul className="mt-2 max-h-[min(52vh,28rem)] space-y-0.5 overflow-y-auto pr-1 text-[11px]">
              {topicIndexRows.map((tr) => (
                <li key={tr.topic}>
                  <button
                    type="button"
                    className={`flex w-full flex-col items-start gap-0.5 rounded px-1.5 py-1 text-left hover:bg-adminFg/[0.06] ${
                      topicExact === tr.topic ? "bg-adminFg/[0.1] text-adminFg" : "text-adminFg/85"
                    }`}
                    onClick={() => {
                      setTopicExact(tr.topic);
                      setTopicDraft("");
                      setTopicDebounced("");
                    }}
                  >
                    {tr.topicZh ? (
                      <>
                        <span className="w-full break-words text-[12px] font-medium leading-snug text-adminFg">
                          {tr.topicZh}
                        </span>
                        <span className="w-full break-all text-[10px] leading-snug text-adminMuted">{tr.topic}</span>
                      </>
                    ) : (
                      <span className="w-full break-words text-[11px] leading-snug">{tr.topic}</span>
                    )}
                    <span className="self-end tabular-nums text-[10px] text-adminMuted">{tr.count}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {topicIndexRows.length < topicIndexTotal ? (
            <button
              type="button"
              className="mt-2 w-full rounded border border-adminLine py-1 text-[11px] text-adminFg hover:bg-adminFg/[0.05]"
              disabled={topicIndexLoading}
              onClick={() => void loadMoreTopics()}
            >
              {ot("topicsMore")}
            </button>
          ) : null}
        </aside>

        {/* 中：筛选 + 表 */}
        <div className="min-w-0 space-y-4">
          <section className="rounded-lg border border-adminLine/80 bg-adminPanel/40 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h2 className="text-[13px] font-medium text-adminFg">{ot("searchTitle")}</h2>
              <button
                type="button"
                className="shrink-0 rounded border border-adminLine px-2 py-1 text-[11px] text-adminMuted hover:text-adminFg"
                onClick={resetAll}
              >
                {ot("resetAll")}
              </button>
            </div>
            {topicExact ? (
              <div className="mt-2 flex flex-wrap items-center gap-2 rounded border border-adminFg/20 bg-adminFg/[0.06] px-2 py-1.5 text-[12px]">
                <span className="text-adminMuted">{ot("pinnedTopic")}:</span>
                <div className="flex min-w-0 flex-col">
                  {pinnedTopicZh ? (
                    <span className="font-medium text-adminFg">{pinnedTopicZh}</span>
                  ) : null}
                  <span className={`break-all font-mono text-[11px] ${pinnedTopicZh ? "text-adminMuted" : "font-medium text-adminFg"}`}>
                    {topicExact}
                  </span>
                </div>
                <button
                  type="button"
                  className="text-[11px] text-adminFg underline underline-offset-2"
                  onClick={() => setTopicExact("")}
                >
                  {ot("clearTopicPin")}
                </button>
              </div>
            ) : null}
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="block text-[12px]">
                <span className="mb-1 block text-adminFg/90">{ot("fieldTopicContains")}</span>
                <input
                  className="w-full rounded border border-adminLine bg-adminBg px-2 py-1.5 text-[12px] text-adminFg"
                  value={topicDraft}
                  onChange={(e) => setTopicDraft(e.target.value)}
                  placeholder={ot("placeholderTopic")}
                  disabled={Boolean(topicExact)}
                />
              </label>
              <label className="block text-[12px]">
                <span className="mb-1 block text-adminFg/90">{ot("fieldOsis")}</span>
                <input
                  className="w-full rounded border border-adminLine bg-adminBg px-2 py-1.5 font-mono text-[11px] text-adminFg"
                  value={osisDraft}
                  onChange={(e) => setOsisDraft(e.target.value)}
                  placeholder={ot("placeholderOsis")}
                />
              </label>
              <label className="block text-[12px]">
                <span className="mb-1 block text-adminFg/90">{ot("fieldMinScore")}</span>
                <input
                  type="number"
                  className="w-full rounded border border-adminLine bg-adminBg px-2 py-1.5 text-[12px] text-adminFg"
                  value={minScore}
                  onChange={(e) => setMinScore(e.target.value)}
                />
              </label>
              <label className="block text-[12px]">
                <span className="mb-1 block text-adminFg/90">{ot("fieldMaxScore")}</span>
                <input
                  type="number"
                  className="w-full rounded border border-adminLine bg-adminBg px-2 py-1.5 text-[12px] text-adminFg"
                  value={maxScore}
                  onChange={(e) => setMaxScore(e.target.value)}
                />
              </label>
              <label className="block text-[12px] sm:col-span-2">
                <span className="mb-1 block text-adminFg/90">{ot("fieldSort")}</span>
                <select
                  className="w-full max-w-md rounded border border-adminLine bg-adminBg px-2 py-1.5 text-[12px] text-adminFg"
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                >
                  <option value="id_asc">{ot("sortId")}</option>
                  <option value="score_desc">{ot("sortScoreDesc")}</option>
                  <option value="topic_asc">{ot("sortTopicAsc")}</option>
                  <option value="osis_asc">{ot("sortOsisAsc")}</option>
                </select>
              </label>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-[11px] text-adminMuted">{ot("quickFilters")}:</span>
              <button
                type="button"
                className="rounded-full border border-adminLine px-2.5 py-0.5 text-[11px] hover:bg-adminFg/[0.06]"
                onClick={() => {
                  setMinScore("7");
                  setMaxScore("");
                }}
              >
                {ot("chipHighScore")}
              </button>
              <button
                type="button"
                className="rounded-full border border-adminLine px-2.5 py-0.5 text-[11px] hover:bg-adminFg/[0.06]"
                onClick={() => {
                  setMinScore("4");
                  setMaxScore("6");
                }}
              >
                {ot("chipMidScore")}
              </button>
              <button
                type="button"
                className="rounded-full border border-adminLine px-2.5 py-0.5 text-[11px] hover:bg-adminFg/[0.06]"
                onClick={() => {
                  setMinScore("");
                  setMaxScore("");
                }}
              >
                {ot("chipClearScores")}
              </button>
            </div>
            <div className="mt-3">
              <p className="text-[11px] font-medium text-adminFg/85">{ot("verseCountSection")}</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {VERSE_BUCKET_KEYS.map((k) => (
                  <button
                    key={k}
                    type="button"
                    className={`rounded-full border px-2.5 py-0.5 text-[11px] ${
                      verseBucket === k
                        ? "border-adminFg/50 bg-adminFg/[0.14] text-adminFg"
                        : k === "unknown"
                          ? "border-adminLine/70 text-adminMuted hover:bg-adminFg/[0.06]"
                          : "border-adminLine text-adminFg/90 hover:bg-adminFg/[0.06]"
                    }`}
                    onClick={() => setVerseBucket(k)}
                  >
                    {k === "all"
                      ? ot("verseAll")
                      : k === "1"
                        ? ot("verse1")
                        : k === "2"
                          ? ot("verse2")
                          : k === "3"
                            ? ot("verse3")
                            : k === "4plus"
                              ? ot("verse4plus")
                              : ot("verseUnknown")}
                  </button>
                ))}
              </div>
              {verseCountReady === false ? (
                <p className="mt-2 text-[11px] leading-snug text-amber-800 dark:text-amber-200/90">{ot("verseCountHintNoColumn")}</p>
              ) : null}
              {verseCountFilterIgnored ? (
                <p className="mt-1 text-[11px] leading-snug text-amber-800 dark:text-amber-200/90">{ot("verseCountFilterIgnored")}</p>
              ) : null}
            </div>
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <label className="block text-[12px]">
                <span className="mb-1 block text-adminFg/90">{ot("fieldLimit")}</span>
                <select
                  className="rounded border border-adminLine bg-adminBg px-2 py-1.5 text-[12px] text-adminFg"
                  value={limit}
                  onChange={(e) => setLimit(Number(e.target.value))}
                >
                  {[25, 50, 100, 200].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="rounded-md border border-adminLine bg-adminFg/[0.06] px-3 py-1.5 text-[12px] font-medium text-adminFg hover:bg-adminFg/[0.1]"
                onClick={() => void loadList()}
                disabled={loading}
              >
                {loading ? ot("loading") : ot("refresh")}
              </button>
            </div>
          </section>

          {err ? (
            <p className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-[13px] text-red-900 dark:text-red-200/90">
              {err}
            </p>
          ) : null}

          <section className="overflow-x-auto rounded-lg border border-adminLine/80 bg-adminPanel/40 p-2 md:p-3">
            <div className="flex flex-wrap items-center justify-between gap-2 px-1 py-2">
              <p className="text-[12px] text-adminMuted">
                {total != null
                  ? ot("summary", {
                      from: String(offset + 1),
                      to: String(offset + rows.length),
                      total: String(total),
                    })
                  : ot("summaryPending")}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded border border-adminLine px-2 py-1 text-[11px] text-adminFg disabled:opacity-40"
                  disabled={!canPrev || loading}
                  onClick={() => setOffset((x) => Math.max(0, x - limit))}
                >
                  {ot("prev")}
                </button>
                <button
                  type="button"
                  className="rounded border border-adminLine px-2 py-1 text-[11px] text-adminFg disabled:opacity-40"
                  disabled={!canNext || loading}
                  onClick={() => setOffset((x) => x + limit)}
                >
                  {ot("next")}
                </button>
              </div>
            </div>
            <table className="w-full min-w-[44rem] border-collapse text-left text-[12px]">
              <thead>
                <tr className="border-b border-adminLine text-[11px] uppercase tracking-wide text-adminMuted">
                  <th className="py-2 pl-2 pr-2 font-medium">{ot("colId")}</th>
                  <th className="py-2 pr-2 font-medium">{ot("colTopicBilingual")}</th>
                  <th className="py-2 pr-2 font-medium whitespace-nowrap" scope="col">
                    <span className="sr-only">{ot("colCompanion")}</span>
                    <span className="inline-flex items-center gap-0.5 text-adminMuted" aria-hidden>
                      <CompanionDirIcon kind="quietBadge" className="h-3.5 w-3.5" />
                      <CompanionDirIcon kind="prayBadge" className="h-3.5 w-3.5" />
                      <CompanionDirIcon kind="formBadge" className="h-3.5 w-3.5" />
                    </span>
                  </th>
                  <th className="py-2 pr-2 font-medium whitespace-nowrap">{ot("colVerseCount")}</th>
                  <th className="py-2 pr-2 font-medium">{ot("colOsisDisplay")}</th>
                  <th className="py-2 pr-2 font-medium">{ot("colScore")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    role="button"
                    tabIndex={0}
                    className={`cursor-pointer border-b border-adminLine/60 hover:bg-adminFg/[0.04] ${
                      selectedId === r.id ? "bg-adminFg/[0.08]" : ""
                    }`}
                    onClick={() => setSelectedId(r.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedId(r.id);
                      }
                    }}
                  >
                    <td className="py-2 pl-2 pr-2 font-mono text-[11px] text-adminMuted">{r.id}</td>
                    <td className="max-w-[20rem] py-2 pr-2">
                      {r.topicZh ? (
                        <div className="space-y-0.5">
                          <div className="text-[13px] font-medium leading-snug text-adminFg">{r.topicZh}</div>
                          <div className="break-words text-[10px] leading-snug text-adminMuted">{r.topic}</div>
                        </div>
                      ) : (
                        <div className="text-[12px] leading-snug text-adminFg/90">{r.topic}</div>
                      )}
                    </td>
                    <td className="py-2 pr-2 align-top">
                      <span className="inline-flex flex-wrap items-center gap-0.5">
                        {r.companion.quiet ? (
                          <span
                            className="flex h-7 w-7 items-center justify-center rounded-md border border-emerald-500/35 bg-emerald-500/10 text-emerald-200/95"
                            title={ot("directionRow1Name")}
                          >
                            <CompanionDirIcon kind="quietBadge" className="h-4 w-4" />
                          </span>
                        ) : null}
                        {r.companion.pray ? (
                          <span
                            className="flex h-7 w-7 items-center justify-center rounded-md border border-sky-500/35 bg-sky-500/10 text-sky-200/95"
                            title={ot("directionRow2Name")}
                          >
                            <CompanionDirIcon kind="prayBadge" className="h-4 w-4" />
                          </span>
                        ) : null}
                        {r.companion.form ? (
                          <span
                            className="flex h-7 w-7 items-center justify-center rounded-md border border-amber-500/40 bg-amber-500/10 text-amber-200/95"
                            title={ot("directionRow3Name")}
                          >
                            <CompanionDirIcon kind="formBadge" className="h-4 w-4" />
                          </span>
                        ) : null}
                        {!r.companion.quiet && !r.companion.pray && !r.companion.form ? (
                          <span
                            className="inline-block h-2 w-2 shrink-0 rounded-full bg-adminMuted/35"
                            title={ot("companionNone")}
                            aria-label={ot("companionNone")}
                          />
                        ) : null}
                      </span>
                    </td>
                    <td className="py-2 pr-2 tabular-nums text-[12px] text-adminFg/90 whitespace-nowrap">
                      {r.verseCount == null ? ot("verseDash") : r.verseCount}
                    </td>
                    <td className="max-w-[22rem] py-2 pr-2">
                      <div className="text-[12px] leading-snug text-adminFg">{r.osisDisplay}</div>
                      <div className="mt-0.5 break-all font-mono text-[10px] leading-snug text-adminMuted">{r.osis}</div>
                    </td>
                    <td className="py-2 pr-2 tabular-nums text-adminFg/90">{r.qualityScore}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === 0 && !loading && !noDb ? (
              <p className="px-2 py-4 text-[13px] text-adminMuted">{ot("empty")}</p>
            ) : null}
          </section>
        </div>

        {/* 右：经文详情 */}
        <aside className="rounded-lg border border-adminLine/80 bg-adminPanel/40 p-3 xl:sticky xl:top-4 xl:max-h-[calc(100vh-6rem)] xl:overflow-y-auto xl:self-start">
          <h2 className="text-[13px] font-medium text-adminFg">{ot("panelTitle")}</h2>
          {selectedId == null ? (
            <p className="mt-3 text-[12px] leading-relaxed text-adminMuted">{ot("panelEmpty")}</p>
          ) : detailBusy ? (
            <p className="mt-3 text-[12px] text-adminMuted">{ot("loadingDetail")}</p>
          ) : detail ? (
            <div className="mt-3 space-y-3 text-[12px]">
              <div className="rounded border border-adminLine/60 bg-adminBg/40 p-2 text-[11px] leading-relaxed">
                <p>
                  <span className="text-adminMuted">id</span>{" "}
                  <span className="font-mono tabular-nums">{detail.row.id}</span>
                </p>
                <p className="mt-1">
                  <span className="text-adminMuted">{ot("colTopicBilingual")}</span>
                </p>
                {detail.row.topicZh ? (
                  <p className="mt-0.5 text-[14px] font-medium leading-snug text-adminFg">{detail.row.topicZh}</p>
                ) : null}
                <p className={`mt-0.5 break-words ${detail.row.topicZh ? "text-[11px] text-adminMuted" : "text-[13px] text-adminFg"}`}>
                  {detail.row.topic}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-0.5" role="group" aria-label={ot("colCompanion")}>
                  {detail.row.companion.quiet ? (
                    <span
                      className="flex h-7 w-7 items-center justify-center rounded-md border border-emerald-500/35 bg-emerald-500/10 text-emerald-200/95"
                      title={ot("directionRow1Name")}
                    >
                      <CompanionDirIcon kind="quietBadge" className="h-4 w-4" />
                    </span>
                  ) : null}
                  {detail.row.companion.pray ? (
                    <span
                      className="flex h-7 w-7 items-center justify-center rounded-md border border-sky-500/35 bg-sky-500/10 text-sky-200/95"
                      title={ot("directionRow2Name")}
                    >
                      <CompanionDirIcon kind="prayBadge" className="h-4 w-4" />
                    </span>
                  ) : null}
                  {detail.row.companion.form ? (
                    <span
                      className="flex h-7 w-7 items-center justify-center rounded-md border border-amber-500/40 bg-amber-500/10 text-amber-200/95"
                      title={ot("directionRow3Name")}
                    >
                      <CompanionDirIcon kind="formBadge" className="h-4 w-4" />
                    </span>
                  ) : null}
                  {!detail.row.companion.quiet && !detail.row.companion.pray && !detail.row.companion.form ? (
                    <span
                      className="inline-block h-2 w-2 shrink-0 rounded-full bg-adminMuted/35"
                      title={ot("companionNone")}
                      aria-label={ot("companionNone")}
                    />
                  ) : null}
                </div>
                <p className="mt-1">
                  <span className="text-adminMuted">{ot("colVerseCount")}</span>{" "}
                  <span className="tabular-nums text-adminFg">
                    {detail.row.verseCount == null ? ot("verseDash") : detail.row.verseCount}
                  </span>
                </p>
                <p className="mt-1 break-words">
                  <span className="text-adminMuted">{ot("colOsisDisplay")}</span>
                </p>
                <p className="mt-0.5 text-[13px] font-medium leading-snug text-adminFg">{detail.row.osisDisplay}</p>
                <p className="mt-1 break-all">
                  <span className="text-adminMuted">{ot("colOsisRaw")}</span>{" "}
                  <span className="font-mono text-[11px] text-adminMuted">{detail.row.osis}</span>
                </p>
                <p className="mt-1">
                  <span className="text-adminMuted">{ot("colScore")}</span>{" "}
                  <span className="tabular-nums">{detail.row.qualityScore}</span>
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded border border-adminLine px-2 py-1 text-[11px] hover:bg-adminFg/[0.06]"
                  onClick={() => void copyText("osisDisplay", detail.row.osisDisplay)}
                >
                  {ot("copyOsisDisplay")}
                </button>
                <button
                  type="button"
                  className="rounded border border-adminLine px-2 py-1 text-[11px] hover:bg-adminFg/[0.06]"
                  onClick={() => void copyText("osis", detail.row.osis)}
                >
                  {ot("copyOsis")}
                </button>
                {detail.footnote && detail.footnote !== detail.row.osisDisplay ? (
                  <button
                    type="button"
                    className="rounded border border-adminLine px-2 py-1 text-[11px] hover:bg-adminFg/[0.06]"
                    onClick={() => void copyText("ref", detail.footnote!)}
                  >
                    {ot("copyRef")}
                  </button>
                ) : null}
                {detail.previewLines?.length ? (
                  <button
                    type="button"
                    className="rounded border border-adminLine px-2 py-1 text-[11px] hover:bg-adminFg/[0.06]"
                    onClick={() => void copyText("preview", detail.previewLines!.join("\n"))}
                  >
                    {ot("copyPreview")}
                  </button>
                ) : null}
                {detail.readHref ? (
                  <Link
                    href={detail.readHref}
                    className="rounded border border-adminLine px-2 py-1 text-[11px] hover:bg-adminFg/[0.06]"
                  >
                    {ot("openRead")}
                  </Link>
                ) : null}
              </div>
              {copyMsg ? <p className="text-[11px] text-emerald-700 dark:text-emerald-300/90">{ot("copied")}</p> : null}
              {detail.parseNote ? (
                <p className="text-[11px] leading-snug text-amber-800 dark:text-amber-200/90">{detail.parseNote}</p>
              ) : null}
              {detail.footnote && detail.footnote !== detail.row.osisDisplay ? (
                <p className="text-[14px] font-medium leading-snug text-adminFg">{detail.footnote}</p>
              ) : null}
              {detail.previewLines?.length ? (
                <div className="space-y-2 rounded border border-adminLine/50 bg-adminBg/30 p-3 text-[14px] leading-relaxed text-adminFg/95">
                  {detail.previewLines.map((line, i) => (
                    <p key={i}>{line}</p>
                  ))}
                </div>
              ) : detail.verseSpan ? (
                <p className="text-[12px] text-adminMuted">{ot("noVerseText")}</p>
              ) : null}
            </div>
          ) : null}
        </aside>
      </div>

      <p className="mt-6 text-[11px] leading-relaxed text-adminMuted">{ot("footnote")}</p>
    </div>
  );
}
