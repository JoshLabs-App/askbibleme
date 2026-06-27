import {
  DEFAULT_HOME_VERSE_POOL_MENU_SCOPE,
  type HomeVersePoolMenuScopeId,
  isHomeVersePoolMenuScopeId,
  memoryNamespaceFromMenuScope,
  parseHomeVersePoolMenuScopeId,
} from "@/lib/home-prayer-pools/home-verse-pool-menu-scopes";

export const HOME_VERSE_POOL_SCOPE_STORAGE_KEY = "askbible-home-verse-pool-scope-v2";

export const HOME_VERSE_POOL_SCOPE_UPDATED_EVENT = "selah:home-verse-pool-scope-updated";

/** @deprecated explore filter IDs — use HomeVersePoolMenuScopeId */
export type HomeVersePoolScopeId = HomeVersePoolMenuScopeId;

export const DEFAULT_HOME_VERSE_POOL_SCOPE = DEFAULT_HOME_VERSE_POOL_MENU_SCOPE;

let currentScope: HomeVersePoolMenuScopeId = DEFAULT_HOME_VERSE_POOL_MENU_SCOPE;
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

export function getHomeVersePoolScope(): HomeVersePoolMenuScopeId {
  return currentScope;
}

export function subscribeHomeVersePoolScope(onStore: () => void): () => void {
  listeners.add(onStore);
  return () => listeners.delete(onStore);
}

export function hydrateHomeVersePoolScope(): HomeVersePoolMenuScopeId {
  if (hydrated) return currentScope;
  if (typeof window === "undefined") return currentScope;
  try {
    const raw = window.localStorage.getItem(HOME_VERSE_POOL_SCOPE_STORAGE_KEY)?.trim() ?? "";
    currentScope = parseHomeVersePoolMenuScopeId(raw);
    window.localStorage.setItem(HOME_VERSE_POOL_SCOPE_STORAGE_KEY, currentScope);
  } catch {
    currentScope = DEFAULT_HOME_VERSE_POOL_MENU_SCOPE;
  }
  hydrated = true;
  emit();
  return currentScope;
}

export function setHomeVersePoolScope(next: HomeVersePoolMenuScopeId): void {
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

export function memoryNamespaceFromExploreScope(scopeId: HomeVersePoolMenuScopeId): string {
  return memoryNamespaceFromMenuScope(scopeId);
}

export { isHomeVersePoolMenuScopeId as isHomeVersePoolScopeId };
