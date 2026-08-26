import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  DEFAULT_SCRIPTURE_SEARCH_SCOPE,
  type ScriptureSearchScope,
} from "../bible/scripture-search";

const STORAGE_KEY = "askbible-mobile-scripture-search-scope-v1";

const VALID: ReadonlySet<ScriptureSearchScope> = new Set(["all", "old", "new", "chapter"]);

let cached: ScriptureSearchScope = DEFAULT_SCRIPTURE_SEARCH_SCOPE;
let hydrated = false;
let hydratePromise: Promise<ScriptureSearchScope> | null = null;

function parseScope(raw: string | null): ScriptureSearchScope {
  const value = String(raw ?? "").trim() as ScriptureSearchScope;
  return VALID.has(value) ? value : DEFAULT_SCRIPTURE_SEARCH_SCOPE;
}

export function getScriptureSearchScope(): ScriptureSearchScope {
  return cached;
}

export async function hydrateScriptureSearchScope(): Promise<ScriptureSearchScope> {
  if (hydrated) return cached;
  if (hydratePromise) return hydratePromise;
  hydratePromise = (async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      cached = parseScope(raw);
    } catch {
      cached = DEFAULT_SCRIPTURE_SEARCH_SCOPE;
    } finally {
      hydrated = true;
    }
    return cached;
  })();
  return hydratePromise;
}

export async function writeScriptureSearchScope(next: ScriptureSearchScope): Promise<void> {
  const scope = VALID.has(next) ? next : DEFAULT_SCRIPTURE_SEARCH_SCOPE;
  cached = scope;
  hydrated = true;
  try {
    await AsyncStorage.setItem(STORAGE_KEY, scope);
  } catch {
    /* ignore */
  }
}

void hydrateScriptureSearchScope();
