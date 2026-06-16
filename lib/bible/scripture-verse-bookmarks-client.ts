"use client";

import {
  parseScriptureVerseBookmarkStore,
  scriptureVerseBookmarkKey,
  SCRIPTURE_VERSE_BOOKMARKS_STORAGE_KEY,
  type ScriptureVerseBookmarkRef,
  type ScriptureVerseBookmarkStore,
} from "@/lib/bible/scripture-verse-bookmarks";

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
  if (typeof window === "undefined") return () => {};
  listeners.add(onStore);
  const onStorage = (e: StorageEvent) => {
    if (e.key === SCRIPTURE_VERSE_BOOKMARKS_STORAGE_KEY || e.key === null) onStore();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onStore);
    window.removeEventListener("storage", onStorage);
  };
}

export function getScriptureVerseBookmarkStoreSnapshot(): ScriptureVerseBookmarkStore {
  if (typeof window === "undefined") return cacheStore;
  const raw = window.localStorage.getItem(SCRIPTURE_VERSE_BOOKMARKS_STORAGE_KEY);
  if (raw === cacheRaw) return cacheStore;
  cacheRaw = raw;
  cacheStore = parseScriptureVerseBookmarkStore(raw);
  return cacheStore;
}

export function getScriptureVerseBookmarkStoreServerSnapshot(): ScriptureVerseBookmarkStore {
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
  const store = { ...getScriptureVerseBookmarkStoreSnapshot() };
  const key = scriptureVerseBookmarkKey(ref);
  if (store[key]) {
    delete store[key];
    const json = JSON.stringify(store);
    window.localStorage.setItem(SCRIPTURE_VERSE_BOOKMARKS_STORAGE_KEY, json);
    cacheRaw = json;
    cacheStore = store;
    emit();
    return { added: false, store };
  }
  store[key] = { ...ref, savedAt: Date.now() };
  const json = JSON.stringify(store);
  window.localStorage.setItem(SCRIPTURE_VERSE_BOOKMARKS_STORAGE_KEY, json);
  cacheRaw = json;
  cacheStore = store;
  emit();
  return { added: true, store };
}

export function replaceScriptureVerseBookmarkStore(store: ScriptureVerseBookmarkStore): void {
  if (typeof window === "undefined") return;
  const json = JSON.stringify(store);
  window.localStorage.setItem(SCRIPTURE_VERSE_BOOKMARKS_STORAGE_KEY, json);
  cacheRaw = json;
  cacheStore = store;
  emit();
}
