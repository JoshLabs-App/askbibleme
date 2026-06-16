import { useCallback, useEffect, useSyncExternalStore } from "react";
import { InteractionManager } from "react-native";
import {
  getScriptureVerseBookmarkStoreSync,
  hydrateScriptureVerseBookmarkStore,
  isScriptureVerseBookmarked,
  subscribeScriptureVerseBookmarks,
  toggleScriptureVerseBookmark,
  type ScriptureVerseBookmarkRef,
} from "../bible/scripture-verse-bookmarks";

export function useScriptureVerseBookmarks() {
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      void hydrateScriptureVerseBookmarkStore();
    });
    return () => task.cancel();
  }, []);

  const store = useSyncExternalStore(
    subscribeScriptureVerseBookmarks,
    getScriptureVerseBookmarkStoreSync,
    () => ({}),
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
