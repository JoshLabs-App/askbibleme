import {
  DEFAULT_HOME_VERSE_POOL_SCOPE,
  type HomeVersePoolScopeId,
  isHomeVersePoolScopeId,
} from "@/lib/explore/explore-home-verse-pool-scopes";

export const HOME_VERSE_POOL_SCOPE_STORAGE_KEY = "askbible-home-verse-pool-scope-v1";

export const HOME_VERSE_POOL_SCOPE_UPDATED_EVENT = "selah:home-verse-pool-scope-updated";

let currentScope: HomeVersePoolScopeId = DEFAULT_HOME_VERSE_POOL_SCOPE;
let hydrated = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {
      /* ignore */
    }
  });
}

export function getHomeVersePoolScope(): HomeVersePoolScopeId {
  return currentScope;
}

export function subscribeHomeVersePoolScope(onStore: () => void): () => void {
  listeners.add(onStore);
  return () => listeners.delete(onStore);
}

export function hydrateHomeVersePoolScope(): HomeVersePoolScopeId {
  if (hydrated) return currentScope;
  if (typeof window === "undefined") return currentScope;
  try {
    const raw = window.localStorage.getItem(HOME_VERSE_POOL_SCOPE_STORAGE_KEY)?.trim() ?? "";
    currentScope = raw && isHomeVersePoolScopeId(raw) ? raw : DEFAULT_HOME_VERSE_POOL_SCOPE;
  } catch {
    currentScope = DEFAULT_HOME_VERSE_POOL_SCOPE;
  }
  hydrated = true;
  emit();
  return currentScope;
}

export function setHomeVersePoolScope(next: HomeVersePoolScopeId): void {
  if (currentScope === next && hydrated) return;
  currentScope = next;
  hydrated = true;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(HOME_VERSE_POOL_SCOPE_STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new Event(HOME_VERSE_POOL_SCOPE_UPDATED_EVENT));
  }
  emit();
}

/** Memory namespace suffix for explore scope filtering (distinct from theme-repeat minCount). */
export function memoryNamespaceFromExploreScope(scopeId: HomeVersePoolScopeId): string {
  return `explore-scope:${scopeId}`;
}
