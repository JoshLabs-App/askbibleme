import AsyncStorage from "@react-native-async-storage/async-storage";

export const HOME_VERSE_GAP_SEC_OPTIONS = [3, 5, 7] as const;
/** 金句播完间隔：固定默认 5 秒（设置里不再展示）。 */
export const DEFAULT_HOME_VERSE_GAP_SEC = 5;
const KEY = "askbible-home-verse-gap-sec-v1";
let current = DEFAULT_HOME_VERSE_GAP_SEC;
let hydrated = false;
const listeners = new Set<() => void>();

function clamp(raw: unknown) {
  const n = Number.parseInt(String(raw ?? ""), 10);
  if (!Number.isFinite(n)) return DEFAULT_HOME_VERSE_GAP_SEC;
  return HOME_VERSE_GAP_SEC_OPTIONS.reduce((best, value) =>
    Math.abs(value - n) < Math.abs(best - n) ? value : best,
  );
}
export function getHomeVerseGapSec() { return current; }
export function subscribeHomeVerseGapSec(listener: () => void) { listeners.add(listener); return () => listeners.delete(listener); }
export async function hydrateHomeVerseGapSec() {
  if (hydrated) return current;
  // 设置里已隐藏；统一用默认 5 秒。
  current = DEFAULT_HOME_VERSE_GAP_SEC;
  hydrated = true;
  try {
    await AsyncStorage.setItem(KEY, String(current));
  } catch {
    /* ignore */
  }
  listeners.forEach((listener) => listener());
  return current;
}
export async function writeHomeVerseGapSec(next: number) {
  current = clamp(next);
  hydrated = true;
  await AsyncStorage.setItem(KEY, String(current));
  listeners.forEach((listener) => listener());
}
