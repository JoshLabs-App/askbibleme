import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { NATURE_HOME_PREFS_KEYS } from "./natureHomePrefsKeys";
import { syncWidgetRotationIntervalSec } from "../widget/syncWidgetRotationIntervalSec";

export const DEFAULT_HOME_VERSE_ROTATION_SEC = 10;
export const MIN_HOME_VERSE_ROTATION_SEC = 3;
export const MAX_HOME_VERSE_ROTATION_SEC = 60;

let currentSec = DEFAULT_HOME_VERSE_ROTATION_SEC;
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

export function clampHomeVerseRotationSec(raw: unknown): number {
  const n = typeof raw === "number" ? raw : Number.parseInt(String(raw ?? ""), 10);
  if (!Number.isFinite(n)) return DEFAULT_HOME_VERSE_ROTATION_SEC;
  return Math.min(MAX_HOME_VERSE_ROTATION_SEC, Math.max(MIN_HOME_VERSE_ROTATION_SEC, Math.round(n)));
}

export function getHomeVerseRotationSec(): number {
  return currentSec;
}

export function subscribeHomeVerseRotationSec(onStore: () => void): () => void {
  listeners.add(onStore);
  return () => listeners.delete(onStore);
}

export async function hydrateHomeVerseRotationSec(): Promise<number> {
  if (hydrated) return currentSec;
  try {
    const raw = await AsyncStorage.getItem(NATURE_HOME_PREFS_KEYS.verseRotationSec);
    currentSec = clampHomeVerseRotationSec(raw);
  } catch {
    currentSec = DEFAULT_HOME_VERSE_ROTATION_SEC;
  }
  hydrated = true;
  emit();
  return currentSec;
}

export async function readHomeVerseRotationSec(): Promise<number> {
  return hydrateHomeVerseRotationSec();
}

export async function writeHomeVerseRotationSec(next: number): Promise<number> {
  const clamped = clampHomeVerseRotationSec(next);
  if (currentSec === clamped && hydrated) {
    return clamped;
  }
  currentSec = clamped;
  hydrated = true;
  try {
    await AsyncStorage.setItem(NATURE_HOME_PREFS_KEYS.verseRotationSec, String(clamped));
  } catch {
    /* ignore */
  }
  emit();
  if (Platform.OS === "ios" || Platform.OS === "android") {
    await syncWidgetRotationIntervalSec(clamped);
  }
  return clamped;
}
