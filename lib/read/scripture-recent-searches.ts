import { SCRIPTURE_SEARCH_MIN_LEN } from "@/lib/bible/scripture-search";

export const SCRIPTURE_RECENT_SEARCHES_STORAGE_KEY = "askbible-read-scripture-recent-searches-v1";
export const SCRIPTURE_RECENT_SEARCH_MAX_ITEMS = 8;

export type ScriptureRecentSearchesRecord = {
  version: 1;
  terms: string[];
};

function normalizeTerms(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const term = item.trim().replace(/\s+/g, " ");
    if (term.length < SCRIPTURE_SEARCH_MIN_LEN) continue;
    const key = term.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(term);
    if (out.length >= SCRIPTURE_RECENT_SEARCH_MAX_ITEMS) break;
  }
  return out;
}

export function parseScriptureRecentSearchesRecord(raw: string | null): ScriptureRecentSearchesRecord {
  if (!raw?.trim()) return { version: 1, terms: [] };
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return { version: 1, terms: normalizeTerms(parsed) };
    }
    if (parsed && typeof parsed === "object" && (parsed as ScriptureRecentSearchesRecord).version === 1) {
      return { version: 1, terms: normalizeTerms((parsed as ScriptureRecentSearchesRecord).terms) };
    }
  } catch {
    /* ignore */
  }
  return { version: 1, terms: [] };
}

export function readScriptureRecentSearches(): ScriptureRecentSearchesRecord {
  if (typeof window === "undefined") return { version: 1, terms: [] };
  try {
    const raw = window.localStorage.getItem(SCRIPTURE_RECENT_SEARCHES_STORAGE_KEY);
    return parseScriptureRecentSearchesRecord(raw);
  } catch {
    return { version: 1, terms: [] };
  }
}

export function replaceScriptureRecentSearches(record: ScriptureRecentSearchesRecord): void {
  if (typeof window === "undefined") return;
  const normalized: ScriptureRecentSearchesRecord = {
    version: 1,
    terms: normalizeTerms(record.terms),
  };
  window.localStorage.setItem(SCRIPTURE_RECENT_SEARCHES_STORAGE_KEY, JSON.stringify(normalized));
}

export function pushScriptureRecentSearch(raw: string): ScriptureRecentSearchesRecord {
  const normalized = raw.trim().replace(/\s+/g, " ");
  const current = readScriptureRecentSearches();
  if (normalized.length < SCRIPTURE_SEARCH_MIN_LEN) return current;
  const next: ScriptureRecentSearchesRecord = {
    version: 1,
    terms: [
      normalized,
      ...current.terms.filter((item) => item.toLowerCase() !== normalized.toLowerCase()),
    ].slice(0, SCRIPTURE_RECENT_SEARCH_MAX_ITEMS),
  };
  replaceScriptureRecentSearches(next);
  return next;
}
