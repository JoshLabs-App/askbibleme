"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ScriptureSearchHighlightedText } from "@/components/bible/ScriptureSearchHighlightedText";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { useReadBibleTranslationSettings } from "@/components/bible/ReadBibleTypographyProvider";
import {
  SCRIPTURE_SEARCH_MIN_LEN,
  type ScriptureSearchChapterRef,
  type ScriptureSearchHit,
  type ScriptureSearchScope,
} from "@/lib/bible/scripture-search";
import { readLastReadPosition } from "@/lib/read/read-last-position";
import {
  getScriptureSearchScope,
  writeScriptureSearchScope,
} from "@/lib/read/scripture-search-scope-prefs";
import {
  pushScriptureRecentSearch,
  readScriptureRecentSearches,
} from "@/lib/read/scripture-recent-searches";
import { resolveReadChapterPrimaryTranslationId } from "@/lib/read/read-bible-translation-prefs";
import { warmScriptureSearchWeb } from "@/lib/read/warm-scripture-search-web";

const SCOPE_OPTIONS: { key: ScriptureSearchScope; labelKey: string }[] = [
  { key: "all", labelKey: "pages.read.scriptureSearchScopeAll" },
  { key: "old", labelKey: "pages.read.scriptureSearchScopeOld" },
  { key: "new", labelKey: "pages.read.scriptureSearchScopeNew" },
  { key: "chapter", labelKey: "pages.read.scriptureSearchScopeChapter" },
];

function parseChapterRefFromParams(
  bookIdRaw: string | null,
  chapterRaw: string | null,
): ScriptureSearchChapterRef | null {
  const bookId = String(bookIdRaw ?? "").trim();
  const chapter = Number(chapterRaw);
  if (!bookId || !Number.isInteger(chapter) || chapter < 1) return null;
  return { bookId, chapter };
}

type Props = {
  /** 宽屏章页内嵌搜索：无 URL 查询时注入当前章。 */
  routeChapterRef?: ScriptureSearchChapterRef | null;
};

export function ReadScriptureSearchClient({ routeChapterRef: routeChapterRefProp = null }: Props = {}) {
  const { t, locale } = useLocale();
  const searchParams = useSearchParams();
  const routeChapterRefFromUrl = useMemo(
    () => parseChapterRefFromParams(searchParams.get("bookId"), searchParams.get("chapter")),
    [searchParams],
  );
  const routeChapterRef = routeChapterRefFromUrl ?? routeChapterRefProp ?? null;
  const { translation, translationCatalog, translationCatalogReady } = useReadBibleTranslationSettings();
  const searchTranslationId = useMemo(() => {
    if (!translationCatalogReady || translationCatalog.length === 0) {
      return translation.primaryTranslationId;
    }
    return resolveReadChapterPrimaryTranslationId(
      translation,
      {
        translations: translationCatalog,
        defaultTranslationId: translationCatalog[0]?.id ?? translation.primaryTranslationId,
      },
      locale,
    );
  }, [locale, translation, translationCatalog, translationCatalogReady]);
  const [scope, setScopeState] = useState<ScriptureSearchScope>(() => getScriptureSearchScope());
  const [chapterRef, setChapterRef] = useState<ScriptureSearchChapterRef | null>(routeChapterRef);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ScriptureSearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  const setScope = useCallback((next: ScriptureSearchScope) => {
    setScopeState(next);
    writeScriptureSearchScope(next);
  }, []);

  const pushRecentSearch = useCallback((raw: string) => {
    const record = pushScriptureRecentSearch(raw);
    setRecentSearches(record.terms);
  }, []);

  useEffect(() => {
    setRecentSearches(readScriptureRecentSearches().terms);
  }, []);

  useEffect(() => {
    if (!translationCatalogReady || !searchTranslationId) return;
    void warmScriptureSearchWeb(searchTranslationId);
  }, [searchTranslationId, translationCatalogReady]);

  useEffect(() => {
    if (routeChapterRef) {
      setChapterRef(routeChapterRef);
      return;
    }
    const pos = readLastReadPosition();
    if (pos) {
      setChapterRef((prev) => prev ?? { bookId: pos.bookId, chapter: pos.chapter });
    }
  }, [routeChapterRef]);

  const runSearch = useCallback(
    async (raw: string) => {
      const q = raw.trim();
      if (!q) {
        setResults([]);
        setSearched(false);
        setError(null);
        return;
      }
      if (q.length < SCRIPTURE_SEARCH_MIN_LEN) return;
      if (scope === "chapter" && !chapterRef) {
        setResults([]);
        setSearched(true);
        setError(null);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          q,
          translationId: searchTranslationId,
          scope,
        });
        if (scope === "chapter" && chapterRef) {
          params.set("bookId", chapterRef.bookId);
          params.set("chapter", String(chapterRef.chapter));
        }
        const res = await fetch(`/api/read/scripture-search?${params.toString()}`, { cache: "no-store" });
        const j = (await res.json()) as { ok?: boolean; results?: ScriptureSearchHit[]; error?: string };
        if (!res.ok || j.ok === false) {
          throw new Error(
            j.error ||
              (res.status === 503
                ? t("pages.read.scriptureSearchDbError")
                : `HTTP ${res.status}`),
          );
        }
        setResults(j.results ?? []);
        setSearched(true);
        pushRecentSearch(q);
      } catch (e) {
        setResults([]);
        setSearched(true);
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    },
    [chapterRef, searchTranslationId, pushRecentSearch, scope, t],
  );

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      setSearched(false);
      setError(null);
      return;
    }
    const timer = setTimeout(() => {
      void runSearch(q);
    }, 320);
    return () => clearTimeout(timer);
  }, [query, scope, chapterRef, runSearch]);

  const hint =
    query.trim().length > 0 && query.trim().length < SCRIPTURE_SEARCH_MIN_LEN
      ? t("pages.read.scriptureSearchMinHint")
      : scope === "chapter" && !chapterRef
        ? t("pages.read.scriptureSearchNoChapterHint")
        : null;

  return (
    <div className="read-scripture-search">
      <h1 className="read-scripture-search-title">{t("pages.read.scriptureSearchTitle")}</h1>
      <p className="read-scripture-search-lead">{t("pages.read.scriptureSearchLead")}</p>

      <div className="read-scripture-search-scope" role="tablist" aria-label={t("pages.read.scriptureSearchScopeAria")}>
        {SCOPE_OPTIONS.map((opt) => {
          const active = scope === opt.key;
          return (
            <button
              key={opt.key}
              type="button"
              role="tab"
              aria-selected={active}
              className={active ? "read-scripture-search-scope-btn is-active" : "read-scripture-search-scope-btn"}
              onClick={() => setScope(opt.key)}
            >
              {t(opt.labelKey)}
            </button>
          );
        })}
      </div>

      <label className="read-scripture-search-field">
        <span className="sr-only">{t("pages.read.scriptureSearchPlaceholder")}</span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("pages.read.scriptureSearchPlaceholder")}
          className="read-scripture-search-input"
          autoComplete="off"
          spellCheck={false}
        />
      </label>

      {recentSearches.length > 0 ? (
        <section className="read-scripture-search-recent" aria-label={t("pages.read.scriptureSearchRecentAria")}>
          <p className="read-scripture-search-recent-title">{t("pages.read.scriptureSearchRecentTitle")}</p>
          <div className="read-scripture-search-recent-list">
            {recentSearches.map((term) => (
              <button
                key={term}
                type="button"
                className="read-scripture-search-recent-chip"
                onClick={() => {
                  setQuery(term);
                  void runSearch(term);
                }}
              >
                {term}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {hint ? <p className="read-scripture-search-hint">{hint}</p> : null}
      {loading ? <p className="read-scripture-search-status">{t("pages.read.scriptureSearchLoading")}</p> : null}
      {error ? <p className="read-scripture-search-error">{error}</p> : null}
      {!loading && searched && results.length === 0 && !error ? (
        <p className="read-scripture-search-empty">{t("pages.read.scriptureSearchEmpty")}</p>
      ) : null}

      <ul className="read-scripture-search-results">
        {results.map((hit) => (
          <li key={`${hit.bookId}:${hit.chapter}:${hit.verse}`}>
            <Link
              href={`/read/${encodeURIComponent(hit.bookId)}/${hit.chapter}?verse=${hit.verse}${
                query.trim() ? `&q=${encodeURIComponent(query.trim())}` : ""
              }`}
              className="read-scripture-search-hit"
            >
              <span className="read-scripture-search-hit-ref">
                {hit.bookName} {hit.chapter}:{hit.verse}
              </span>
              <span className="read-scripture-search-hit-text">
                <ScriptureSearchHighlightedText text={hit.text} query={query} />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
