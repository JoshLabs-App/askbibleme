import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  DEFAULT_HOME_VERSE_POOL_SCOPE,
  type HomeVersePoolScopeId,
} from "../explore/explore-home-verse-pool-scopes";

const HOME_VERSE_POOL_SCOPE_KEY = "askbible-home-verse-pool-scope-v1";

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

function isScopeId(v: string): v is HomeVersePoolScopeId {
  return (
    v === "encouragement" ||
    v === "comprehensive" ||
    v === "praise_worship" ||
    v === "word_of_god" ||
    v === "years_days_eternity" ||
    v === "narrow_gate" ||
    v === "prayer_scripture" ||
    v === "all"
  );
}

export function getHomeVersePoolScope(): HomeVersePoolScopeId {
  return currentScope;
}

export function subscribeHomeVersePoolScope(onStore: () => void): () => void {
  listeners.add(onStore);
  return () => listeners.delete(onStore);
}

export async function hydrateHomeVersePoolScope(): Promise<HomeVersePoolScopeId> {
  if (hydrated) return currentScope;
  try {
    const raw = (await AsyncStorage.getItem(HOME_VERSE_POOL_SCOPE_KEY))?.trim() ?? "";
    currentScope = raw && isScopeId(raw) ? raw : DEFAULT_HOME_VERSE_POOL_SCOPE;
  } catch {
    currentScope = DEFAULT_HOME_VERSE_POOL_SCOPE;
  }
  hydrated = true;
  emit();
  return currentScope;
}

export async function setHomeVersePoolScope(next: HomeVersePoolScopeId): Promise<void> {
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
