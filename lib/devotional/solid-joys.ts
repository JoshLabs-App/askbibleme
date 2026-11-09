import { endpointBase } from "@/lib/endpoints";
import { toLocalDateString } from "@/lib/read/reading-plan-prefs";

export type DevotionalDay = {
  md: string;
  title: string;
  verse: string;
  ref: string;
  paragraphs: string[];
  audio?: string;
  audioSec?: number;
};
export const DEVOTIONAL_PREF = "askbible.devotional.after-reading";
const LISTENING_DAY = "askbible.devotional.plan-day";
const cache = new Map<string, Promise<DevotionalDay[]>>();
export function devotionalAvailable(locale: string, isAdmin: boolean) {
  return isAdmin && locale !== "en";
}
export function readDevotionalAuto() {
  try {
    return localStorage.getItem(DEVOTIONAL_PREF) === "1";
  } catch {
    return false;
  }
}
export function writeDevotionalAuto(on: boolean) {
  try {
    localStorage.setItem(DEVOTIONAL_PREF, on ? "1" : "0");
  } catch {
    /* device storage unavailable */
  }
}
export function captureDevotionalPlanDay(date: Date) {
  try {
    sessionStorage.setItem(LISTENING_DAY, toLocalDateString(date));
  } catch {
    /* unavailable */
  }
}
export function devotionalPlanIsToday() {
  try {
    return (
      sessionStorage.getItem(LISTENING_DAY) === toLocalDateString(new Date())
    );
  } catch {
    return false;
  }
}
export function devotionalKey(date: Date) {
  const m = date.getMonth() + 1,
    d = date.getDate();
  return `${String(m).padStart(2, "0")}-${String(m === 2 && d === 29 ? 28 : d).padStart(2, "0")}`;
}
export async function loadDevotionalDays(
  locale: string,
): Promise<DevotionalDay[]> {
  const file =
    locale === "zh-TW" ? "solid-joys-zh-tw.json" : "solid-joys-zh.json";
  let pending = cache.get(file);
  if (!pending) {
    pending = fetch(`${endpointBase("media")}/devotionals/${file}`)
      .then(async (r) => {
        if (!r.ok) throw new Error("devotional unavailable");
        const data = (await r.json()) as { days?: DevotionalDay[] };
        if (!Array.isArray(data.days) || data.days.length < 360)
          throw new Error("incomplete devotional data");
        return data.days;
      })
      .catch((error) => {
        cache.delete(file);
        throw error;
      });
    cache.set(file, pending);
  }
  return pending;
}
export async function loadDevotional(locale: string, date = new Date()) {
  return (await loadDevotionalDays(locale)).find(
    (d) => d.md === devotionalKey(date),
  );
}
export function devotionalAudioUrl(day: DevotionalDay) {
  if (!day.audio) return null;
  try {
    const url = new URL(day.audio);
    if (url.protocol !== "https:") return null;
    url.searchParams.set("askbibleDevotional", day.md);
    return url.href;
  } catch {
    return null;
  }
}
export function isDevotionalAudio(src: string) {
  try {
    return new URL(src).searchParams.has("askbibleDevotional");
  } catch {
    return false;
  }
}
export function shouldHandoffDevotional(
  queue: { bookId: string; chapter: number }[],
  current: { bookId: string; chapter: number },
) {
  const last = queue.at(-1);
  return (
    !!last && last.bookId === current.bookId && last.chapter === current.chapter
  );
}
