import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  parseScriptureVerseBookmarkStore,
  scriptureVerseBookmarkKey,
  SCRIPTURE_VERSE_BOOKMARKS_STORAGE_KEY,
  SCRIPTURE_VERSE_BOOKMARKS_STORAGE_KEY_LEGACY,
  type ScriptureVerseBookmark,
  type ScriptureVerseBookmarkRef,
  type ScriptureVerseBookmarkStore,
} from "./scripture-verse-bookmark-store";

export type {
  ScriptureVerseBookmark,
  ScriptureVerseBookmarkRef,
  ScriptureVerseBookmarkStore,
} from "./scripture-verse-bookmark-store";

const listeners = new Set<() => void>();

let cacheRaw: string | null | undefined;
let cacheStore: ScriptureVerseBookmarkStore = {};

function emit() {
  listeners.forEach((l) => {
    try {
      l();
    } catch {
      /* ignore */
    }
  });
}

export function subscribeScriptureVerseBookmarks(onStore: () => void): () => void {
  listeners.add(onStore);
  return () => listeners.delete(onStore);
}

async function readStoreFromDisk(): Promise<ScriptureVerseBookmarkStore> {
  const raw =
    (await AsyncStorage.getItem(SCRIPTURE_VERSE_BOOKMARKS_STORAGE_KEY)) ??
    (await AsyncStorage.getItem(SCRIPTURE_VERSE_BOOKMARKS_STORAGE_KEY_LEGACY));
  if (raw === cacheRaw) return cacheStore;
  cacheRaw = raw;
  cacheStore = parseScriptureVerseBookmarkStore(raw);
  if (raw != null) {
    await AsyncStorage.setItem(SCRIPTURE_VERSE_BOOKMARKS_STORAGE_KEY, raw);
    await AsyncStorage.removeItem(SCRIPTURE_VERSE_BOOKMARKS_STORAGE_KEY_LEGACY);
  }
  return cacheStore;
}

export async function getScriptureVerseBookmarkStore(): Promise<ScriptureVerseBookmarkStore> {
  return readStoreFromDisk();
}

export function getScriptureVerseBookmarkStoreSync(): ScriptureVerseBookmarkStore {
  return cacheStore;
}

export function isScriptureVerseBookmarked(
  store: ScriptureVerseBookmarkStore,
  ref: Pick<ScriptureVerseBookmarkRef, "translationId" | "bookId" | "chapter" | "verse">,
): boolean {
  return Boolean(store[scriptureVerseBookmarkKey(ref)]);
}

export async function toggleScriptureVerseBookmark(
  ref: ScriptureVerseBookmarkRef,
): Promise<{ added: boolean; store: ScriptureVerseBookmarkStore }> {
  const store = { ...(await readStoreFromDisk()) };
  const key = scriptureVerseBookmarkKey(ref);
  let added = false;
  if (store[key]) {
    delete store[key];
  } else {
    store[key] = { ...ref, savedAt: Date.now() };
    added = true;
  }
  const json = JSON.stringify(store);
  await AsyncStorage.setItem(SCRIPTURE_VERSE_BOOKMARKS_STORAGE_KEY, json);
  await AsyncStorage.removeItem(SCRIPTURE_VERSE_BOOKMARKS_STORAGE_KEY_LEGACY);
  cacheRaw = json;
  cacheStore = store;
  emit();
  return { added, store };
}

export async function hydrateScriptureVerseBookmarkStore(): Promise<void> {
  await readStoreFromDisk();
}

export async function replaceScriptureVerseBookmarkStore(
  store: ScriptureVerseBookmarkStore,
): Promise<void> {
  const json = JSON.stringify(store);
  await AsyncStorage.setItem(SCRIPTURE_VERSE_BOOKMARKS_STORAGE_KEY, json);
  await AsyncStorage.removeItem(SCRIPTURE_VERSE_BOOKMARKS_STORAGE_KEY_LEGACY);
  cacheRaw = json;
  cacheStore = store;
  emit();
}

/** 按收藏时间倒序（新在前） */
export function listScriptureVerseBookmarks(
  store: ScriptureVerseBookmarkStore,
): ScriptureVerseBookmark[] {
  return Object.values(store).sort((a, b) => b.savedAt - a.savedAt);
}
