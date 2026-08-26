import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  DEFAULT_HOME_VERSE_POOL_MENU_SCOPE,
  isHomeVersePoolMenuScopeId,
  type HomeVersePoolMenuScopeId,
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

/** 旧「精选 700」存档一律升到全量池。 */
function migrateScope(raw: HomeVersePoolMenuScopeId): HomeVersePoolMenuScopeId {
  if (raw === "curated700") return "repeatGe5All";
  return raw;
}

export function getHomeVersePoolScope(): HomeVersePoolMenuScopeId {
  return currentScope;
}

export function subscribeHomeVersePoolScope(onStore: () => void): () => void {
  listeners.add(onStore);
  return () => {
    listeners.delete(onStore);
  };
}

export async function hydrateHomeVersePoolScope(): Promise<HomeVersePoolMenuScopeId> {
  if (hydrated) return currentScope;
  let stored: HomeVersePoolMenuScopeId = DEFAULT_HOME_VERSE_POOL_MENU_SCOPE;
  let raw: string | null = null;
  try {
    raw = await AsyncStorage.getItem(HOME_VERSE_POOL_SCOPE_KEY);
    if (raw && isHomeVersePoolMenuScopeId(raw)) stored = migrateScope(raw);
  } catch {
    /* ignore */
  }
  currentScope = stored;
  if (raw && isHomeVersePoolMenuScopeId(raw) && stored !== raw) {
    try {
      await AsyncStorage.setItem(HOME_VERSE_POOL_SCOPE_KEY, currentScope);
    } catch {
      /* ignore */
    }
  }
  hydrated = true;
  emit();
  return currentScope;
}

export async function setHomeVersePoolScope(next: HomeVersePoolMenuScopeId): Promise<void> {
  const resolved = migrateScope(isHomeVersePoolMenuScopeId(next) ? next : DEFAULT_HOME_VERSE_POOL_MENU_SCOPE);
  if (currentScope === resolved && hydrated) return;
  currentScope = resolved;
  hydrated = true;
  try {
    await AsyncStorage.setItem(HOME_VERSE_POOL_SCOPE_KEY, currentScope);
  } catch {
    /* ignore */
  }
  emit();
}

export async function replaceHomeVersePoolScopeForSync(next: HomeVersePoolMenuScopeId): Promise<void> {
  currentScope = migrateScope(isHomeVersePoolMenuScopeId(next) ? next : DEFAULT_HOME_VERSE_POOL_MENU_SCOPE);
  hydrated = true;
  try {
    await AsyncStorage.setItem(HOME_VERSE_POOL_SCOPE_KEY, currentScope);
  } catch {
    /* ignore */
  }
  emit();
}
