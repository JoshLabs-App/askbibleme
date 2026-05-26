"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { useReadBibleTranslationSettings } from "@/components/bible/ReadBibleTypographyProvider";
import {
  SCRIPTURE_SEARCH_MIN_LEN,
  type ScriptureSearchHit,
  type ScriptureSearchScope,
} from "@/lib/bible/scripture-search";

const RECENT_SEARCH_STORAGE_KEY = "askbible-read-scripture-recent-searches-v1";
const RECENT_SEARCH_MAX_ITEMS = 8;

const SCOPE_OPTIONS: { key: ScriptureSearchScope; labelKey: string }[] = [
  { key: "all", labelKey: "pages.read.scriptureSearchScopeAll" },
  { key: "old", labelKey: "pages.read.scriptureSearchScopeOld" },
  { key: "new", labelKey: "pages.read.scriptureSearchScopeNew" },
];

export function ReadScriptureSearchClient() {
  const { t } = useLocale();
  const { translation } = useReadBibleTranslationSettings();
  const primaryTranslationId = translation.primaryTranslationId;
  const [scope, setScope] = useState<ScriptureSearchScope>("all");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ScriptureSearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  const saveRecentSearches = useCallback((next: string[]) => {
    setRecentSearches(next);
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(RECENT_SEARCH_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage write failures in private mode / quota issues.
    }
  }, []);

  const pushRecentSearch = useCallback(
    (raw: string) => {
      const normalized = raw.trim().replace(/\s+/g, " ");
      if (normalized.length < SCRIPTURE_SEARCH_MIN_LEN) return;
      const next = [
        normalized,
        ...recentSearches.filter((item) => item.toLowerCase() !== normalized.toLowerCase()),
      ].slice(0, RECENT_SEARCH_MAX_ITEMS);
      saveRecentSearches(next);
    },
    [recentSearches, saveRecentSearches],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(RECENT_SEARCH_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return;
      const cleaned = parsed
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter((item) => item.length >= SCRIPTURE_SEARCH_MIN_LEN)
        .slice(0, RECENT_SEARCH_MAX_ITEMS);
      if (cleaned.length > 0) {
        setRecentSearches(cleaned);
      }
    } catch {
      // Ignore malformed or unavailable localStorage data.
    }
  }, []);

  const runSearch = useCallback(
    async (raw: string) => {
      const q = raw.trim();
      if (!q) {
        setResults([]);
        setSearched(false);
        setError(null);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          q,
          translationId: primaryTranslationId,
          scope,
        });
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
    [primaryTranslationId, pushRecentSearch, scope, t],
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
  }, [query, scope, runSearch]);

  const hint =
    query.trim().length > 0 && query.trim().length < SCRIPTURE_SEARCH_MIN_LEN
      ? t("pages.read.scriptureSearchMinHint")
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
              href={`/read/${encodeURIComponent(hit.bookId)}/${hit.chapter}?verse=${hit.verse}`}
              className="read-scripture-search-hit"
            >
              <span className="read-scripture-search-hit-ref">
                {hit.bookName} {hit.chapter}:{hit.verse}
              </span>
              <span className="read-scripture-search-hit-text">{hit.text}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
