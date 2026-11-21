import { endpointBase } from "@/lib/endpoints";
import { toLocalDateString } from "@/lib/read/reading-plan-prefs";

export type DevotionalDay = {
  md: string;
  title: string;
  verse: string;
  ref: string;
  refBook?: string | null;
  refChapter?: number | null;
  paragraphs: string[];
  audio?: string;
  audioSec?: number;
};

export const SOLID_JOYS_TITLE_ZH = "约翰·派博每日灵修";
export const SOLID_JOYS_TITLE_TW = "約翰·派博每日靈修";
export const SOLID_JOYS_CREDIT_AUTHOR = "John Piper / Desiring God";
export const SOLID_JOYS_CREDIT_TRANSLATION_ZH = "忠信福音事工";
export const SOLID_JOYS_CREDIT_TRANSLATION_TW = "忠信福音事工";
export const SOLID_JOYS_CREDIT_LINK = "https://www.befaithful.net";

export const DEVOTIONAL_PREF = "askbible.devotional.after-reading";
const LISTENING_DAY = "askbible.devotional.plan-day";
const cache = new Map<string, Promise<DevotionalDay[]>>();

export function devotionalAvailable(locale: string, _isAdmin = true) {
  return locale !== "en";
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
  const m = date.getMonth() + 1;
  const d = date.getDate();
  return `${String(m).padStart(2, "0")}-${String(m === 2 && d === 29 ? 28 : d).padStart(2, "0")}`;
}

export function devotionalMonth(md: string): number {
  const m = Number(md.slice(0, 2));
  return Number.isFinite(m) && m >= 1 && m <= 12 ? m : 1;
}

export function devotionalDateLabel(md: string): string {
  const m = Number(md.slice(0, 2));
  const d = Number(md.slice(3, 5));
  if (!Number.isFinite(m) || !Number.isFinite(d)) return md;
  return `${m}月${d}日`;
}

export function dateFromDevotionalKey(md: string, baseYear = new Date().getFullYear()): Date {
  const m = Number(md.slice(0, 2));
  const d = Number(md.slice(3, 5));
  if (!Number.isFinite(m) || !Number.isFinite(d) || m < 1 || m > 12 || d < 1 || d > 31) {
    return new Date();
  }
  return new Date(baseYear, m - 1, d);
}

export function devotionalMinutesLabel(audioSec: number | undefined, tw = false): string | null {
  if (!audioSec || !Number.isFinite(audioSec) || audioSec <= 0) return null;
  const mins = Math.max(1, Math.round(audioSec / 60));
  return tw ? `約 ${mins} 分鐘` : `约 ${mins} 分钟`;
}

export function devotionalBrief(day: DevotionalDay, query = ""): string {
  const q = query.trim().toLowerCase();
  const fallback =
    day.paragraphs.find((p) => p.trim().length > 0)?.trim() || day.verse.trim();
  if (!q) return fallback;
  const hitPara = day.paragraphs.find((p) => p.toLowerCase().includes(q));
  if (hitPara) return hitPara.trim();
  if (day.verse && day.verse.toLowerCase().includes(q)) return day.verse.trim();
  return fallback;
}

export function devotionalMatchesQuery(day: DevotionalDay, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const dateLabel = devotionalDateLabel(day.md).toLowerCase();
  if (
    day.title.toLowerCase().includes(q) ||
    day.ref.toLowerCase().includes(q) ||
    day.verse.toLowerCase().includes(q) ||
    day.md.toLowerCase().includes(q) ||
    dateLabel.includes(q)
  ) {
    return true;
  }
  return day.paragraphs.some((p) => p.toLowerCase().includes(q));
}

export function groupDevotionalDaysByMonth(
  days: readonly DevotionalDay[],
  opts: { month?: number; query?: string } = {},
): Array<{ month: number; items: DevotionalDay[] }> {
  const monthFilter = opts.month ?? 0;
  const query = opts.query ?? "";
  const sorted = [...days].sort((a, b) => a.md.localeCompare(b.md));
  const byMonth = new Map<number, DevotionalDay[]>();
  for (const item of sorted) {
    const m = devotionalMonth(item.md);
    if (monthFilter >= 1 && monthFilter <= 12 && m !== monthFilter) continue;
    if (!devotionalMatchesQuery(item, query)) continue;
    let bucket = byMonth.get(m);
    if (!bucket) {
      bucket = [];
      byMonth.set(m, bucket);
    }
    bucket.push(item);
  }
  const out: Array<{ month: number; items: DevotionalDay[] }> = [];
  for (let m = 1; m <= 12; m += 1) {
    const items = byMonth.get(m);
    if (items && items.length > 0) {
      out.push({ month: m, items });
    }
  }
  return out;
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
        return [...data.days].sort((a, b) => a.md.localeCompare(b.md));
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

export function devotionalKeyFromAudioSrc(src: string): string | null {
  if (!src) return null;
  try {
    const val = new URL(src).searchParams.get("askbibleDevotional");
    return val && /^\d{2}-\d{2}$/.test(val) ? val : null;
  } catch {
    return null;
  }
}

export function isDevotionalAudio(src: string) {
  return devotionalKeyFromAudioSrc(src) !== null;
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
