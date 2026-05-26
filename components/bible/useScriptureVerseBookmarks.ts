"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { ScriptureVerseBookmarkRef } from "@/lib/bible/scripture-verse-bookmarks";
import {
  getScriptureVerseBookmarkStoreSnapshot,
  getScriptureVerseBookmarkStoreServerSnapshot,
  isScriptureVerseBookmarked,
  subscribeScriptureVerseBookmarks,
  toggleScriptureVerseBookmark,
} from "@/lib/bible/scripture-verse-bookmarks-client";

export function useScriptureVerseBookmarks() {
  const store = useSyncExternalStore(
    subscribeScriptureVerseBookmarks,
    getScriptureVerseBookmarkStoreSnapshot,
    getScriptureVerseBookmarkStoreServerSnapshot,
  );

  const isBookmarked = useCallback(
    (ref: Pick<ScriptureVerseBookmarkRef, "translationId" | "bookId" | "chapter" | "verse">) =>
      isScriptureVerseBookmarked(store, ref),
    [store],
  );

  const toggle = useCallback(async (ref: ScriptureVerseBookmarkRef) => {
    const result = await toggleScriptureVerseBookmark(ref);
    return result.added;
  }, []);

  return { store, isBookmarked, toggle };
}
