/**
 * While App golden-verse audio is active, pin the home-screen daily-verse widget
 * to the same verse key the App is showing (audio duration + gap), instead of
 * independent wall-clock rotation.
 */

import { NativeModules, Platform } from "react-native";

import {
  APP_GROUP_ID,
  WIDGET_SNAPSHOT_STORAGE_KEY,
} from "../notifications/notification-constants";

export type SyncWidgetDisplayedVerseFollowInput = {
  verseKey: string | null | undefined;
  frozen: boolean;
};

type SnapshotVerse = {
  verseKey?: string;
};

function resolveVerseIndexFromIosSnapshot(
  storage: { get: (key: string) => string | null },
  verseKey: string,
): number | null {
  const needle = verseKey.trim().toUpperCase();
  if (!needle) return null;
  try {
    const raw = storage.get(WIDGET_SNAPSHOT_STORAGE_KEY);
    if (!raw || typeof raw !== "string") return null;
    const parsed = JSON.parse(raw) as { verses?: SnapshotVerse[] } | null;
    const verses = Array.isArray(parsed?.verses) ? parsed.verses : null;
    if (!verses || verses.length === 0) return null;
    const index = verses.findIndex(
      (row) =>
        typeof row?.verseKey === "string" &&
        row.verseKey.trim().toUpperCase() === needle,
    );
    return index >= 0 ? index : null;
  } catch {
    return null;
  }
}

export async function syncWidgetDisplayedVerseFollow(
  input: SyncWidgetDisplayedVerseFollowInput,
): Promise<void> {
  const key = typeof input.verseKey === "string" ? input.verseKey.trim().toUpperCase() : "";
  try {
    if (Platform.OS === "android") {
      const prefs = NativeModules.AskBibleWidgetPrefs as
        | { setDisplayedVerseFollow?: (verseKey: string | null, freeze: boolean) => void }
        | undefined;
      prefs?.setDisplayedVerseFollow?.(key || null, Boolean(input.frozen));
      return;
    }

    if (Platform.OS === "ios") {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { ExtensionStorage } = require("@bacons/apple-targets") as {
        ExtensionStorage: (new (group: string) => {
          set: (k: string, v?: string | number | null) => void;
          get: (k: string) => string | null;
          remove: (k: string) => void;
        }) & {
          reloadWidget: (name?: string) => void;
        };
      };
      const storage = new ExtensionStorage(APP_GROUP_ID);
      const nowMs = Date.now();
      if (input.frozen && key) {
        storage.set("askbible-widget-follow-verse-key", key);
        storage.set("askbible-widget-follow-frozen", 1);
        storage.set("askbible-widget-rotation-anchor-ms", nowMs);
        const index = resolveVerseIndexFromIosSnapshot(storage, key);
        if (index != null) {
          storage.set("askbible-widget-rotation-anchor-index", index);
        }
      } else {
        // Resume wall-clock from the verse App last showed (do not keep follow key,
        // or the widget stays pinned forever after audio ends).
        if (key) {
          const index = resolveVerseIndexFromIosSnapshot(storage, key);
          if (index != null) {
            storage.set("askbible-widget-rotation-anchor-index", index);
          }
        }
        storage.set("askbible-widget-follow-frozen", 0);
        storage.remove("askbible-widget-follow-verse-key");
        storage.set("askbible-widget-rotation-anchor-ms", nowMs);
      }
      ExtensionStorage.reloadWidget();
    }
  } catch {
    // Widget sync is best-effort.
  }
}
