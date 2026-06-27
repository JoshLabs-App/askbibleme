import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  DEFAULT_HOME_VERSE_POOL_MENU_SCOPE,
  type HomeVersePoolMenuScopeId,
  isHomeVersePoolMenuScopeId,
  parseHomeVersePoolMenuScopeId,
} from "@/lib/home-prayer-pools/home-verse-pool-menu-scopes";

export const HOME_VERSE_POOL_SCOPE_KEY = "askbible-home-verse-pool-scope-v2";

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

export async function hydrateHomeVersePoolScope(): Promise<HomeVersePoolMenuScopeId> {
  if (hydrated) return currentScope;
  try {
    const raw = (await AsyncStorage.getItem(HOME_VERSE_POOL_SCOPE_KEY))?.trim() ?? "";
    currentScope = parseHomeVersePoolMenuScopeId(raw);
    await AsyncStorage.setItem(HOME_VERSE_POOL_SCOPE_KEY, currentScope);
  } catch {
    currentScope = DEFAULT_HOME_VERSE_POOL_MENU_SCOPE;
  }
  hydrated = true;
  emit();
  return currentScope;
}

export async function setHomeVersePoolScope(next: HomeVersePoolMenuScopeId): Promise<void> {
  if (currentScope === next && hydrated) return;
  currentScope = next;
  hydrated = true;
  try {
    await AsyncStorage.setItem(HOME_VERSE_POOL_SCOPE_KEY, next);
  } catch {
    /* ignore */
  }
  emit();
}

export async function replaceHomeVersePoolScopeForSync(next: HomeVersePoolMenuScopeId): Promise<void> {
  currentScope = isHomeVersePoolMenuScopeId(next) ? next : DEFAULT_HOME_VERSE_POOL_MENU_SCOPE;
  hydrated = true;
  try {
    await AsyncStorage.setItem(HOME_VERSE_POOL_SCOPE_KEY, currentScope);
  } catch {
    /* ignore */
  }
  emit();
}
