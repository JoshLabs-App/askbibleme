"use client";

import {
  parseScriptureVerseBookmarkStore,
  parseScriptureVerseBookmarkTombstones,
  pruneScriptureVerseBookmarkTombstones,
  scriptureVerseBookmarkKey,
  SCRIPTURE_VERSE_BOOKMARK_TOMBSTONES_STORAGE_KEY,
  SCRIPTURE_VERSE_BOOKMARKS_STORAGE_KEY,
  type ScriptureVerseBookmarkRef,
  type ScriptureVerseBookmarkStore,
  type ScriptureVerseBookmarkTombstoneStore,
} from "@/lib/bible/scripture-verse-bookmarks";

const listeners = new Set<() => void>();

let cacheRaw: string | null | undefined;
let cacheStore: ScriptureVerseBookmarkStore = {};
let cacheTombstonesRaw: string | null | undefined;
let cacheTombstones: ScriptureVerseBookmarkTombstoneStore = {};

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
    if (
      e.key === SCRIPTURE_VERSE_BOOKMARKS_STORAGE_KEY ||
      e.key === SCRIPTURE_VERSE_BOOKMARK_TOMBSTONES_STORAGE_KEY ||
      e.key === null
    ) {
      onStore();
    }
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

export function getScriptureVerseBookmarkTombstonesSnapshot(
  nowMs = Date.now(),
): ScriptureVerseBookmarkTombstoneStore {
  if (typeof window === "undefined") return cacheTombstones;
  const raw = window.localStorage.getItem(SCRIPTURE_VERSE_BOOKMARK_TOMBSTONES_STORAGE_KEY);
  if (raw !== cacheTombstonesRaw) {
    cacheTombstonesRaw = raw;
    cacheTombstones = parseScriptureVerseBookmarkTombstones(raw, nowMs);
  } else {
    cacheTombstones = pruneScriptureVerseBookmarkTombstones(cacheTombstones, nowMs);
  }
  return cacheTombstones;
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

function writeTombstones(tombstones: ScriptureVerseBookmarkTombstoneStore, nowMs = Date.now()): void {
  if (typeof window === "undefined") return;
  const pruned = pruneScriptureVerseBookmarkTombstones(tombstones, nowMs);
  const json = JSON.stringify(pruned);
  window.localStorage.setItem(SCRIPTURE_VERSE_BOOKMARK_TOMBSTONES_STORAGE_KEY, json);
  cacheTombstonesRaw = json;
  cacheTombstones = pruned;
}

export async function toggleScriptureVerseBookmark(
  ref: ScriptureVerseBookmarkRef,
): Promise<{ added: boolean; store: ScriptureVerseBookmarkStore }> {
  const nowMs = Date.now();
  const store = { ...getScriptureVerseBookmarkStoreSnapshot() };
  const tombstones = { ...getScriptureVerseBookmarkTombstonesSnapshot(nowMs) };
  const key = scriptureVerseBookmarkKey(ref);
  if (store[key]) {
    delete store[key];
    tombstones[key] = nowMs;
    const json = JSON.stringify(store);
    window.localStorage.setItem(SCRIPTURE_VERSE_BOOKMARKS_STORAGE_KEY, json);
    cacheRaw = json;
    cacheStore = store;
    writeTombstones(tombstones, nowMs);
    emit();
    return { added: false, store };
  }
  store[key] = { ...ref, savedAt: nowMs };
  delete tombstones[key];
  const json = JSON.stringify(store);
  window.localStorage.setItem(SCRIPTURE_VERSE_BOOKMARKS_STORAGE_KEY, json);
  cacheRaw = json;
  cacheStore = store;
  writeTombstones(tombstones, nowMs);
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

export function replaceScriptureVerseBookmarkTombstones(
  tombstones: ScriptureVerseBookmarkTombstoneStore,
  nowMs = Date.now(),
): void {
  writeTombstones(tombstones, nowMs);
}

export function clearScriptureVerseBookmarksForAccountSwitch(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(SCRIPTURE_VERSE_BOOKMARK_TOMBSTONES_STORAGE_KEY);
  cacheTombstonesRaw = null;
  cacheTombstones = {};
  replaceScriptureVerseBookmarkStore({});
}
