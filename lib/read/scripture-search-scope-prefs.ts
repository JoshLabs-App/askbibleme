import {
  DEFAULT_SCRIPTURE_SEARCH_SCOPE,
  type ScriptureSearchScope,
} from "@/lib/bible/scripture-search";

const STORAGE_KEY = "askbible-read-scripture-search-scope-v1";

const VALID: ReadonlySet<ScriptureSearchScope> = new Set(["all", "old", "new", "chapter"]);

function parseScope(raw: string | null): ScriptureSearchScope {
  const value = String(raw ?? "").trim() as ScriptureSearchScope;
  return VALID.has(value) ? value : DEFAULT_SCRIPTURE_SEARCH_SCOPE;
}

export function getScriptureSearchScope(): ScriptureSearchScope {
  if (typeof window === "undefined") return DEFAULT_SCRIPTURE_SEARCH_SCOPE;
  try {
    return parseScope(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return DEFAULT_SCRIPTURE_SEARCH_SCOPE;
  }
}

export function writeScriptureSearchScope(next: ScriptureSearchScope): void {
  if (typeof window === "undefined") return;
  const scope = VALID.has(next) ? next : DEFAULT_SCRIPTURE_SEARCH_SCOPE;
  try {
    window.localStorage.setItem(STORAGE_KEY, scope);
  } catch {
    /* ignore */
  }
}
