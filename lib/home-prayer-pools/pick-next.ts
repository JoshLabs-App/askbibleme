import type { HomePrayerManifestV1, PrayerMemoryRowV1 } from "@/lib/home-prayer-pools/types";

const P_REVIEW = 0.72;
const INITIAL_INTERVAL_MS = 6 * 60 * 60 * 1000;
const INTERVAL_FACTOR = 2;
const MAX_INTERVAL_MS = 21 * 24 * 60 * 60 * 1000;

function cloneMemory(m: Record<string, PrayerMemoryRowV1>): Record<string, PrayerMemoryRowV1> {
  const o: Record<string, PrayerMemoryRowV1> = {};
  for (const [k, v] of Object.entries(m)) {
    o[k] = { ...v };
  }
  return o;
}

function dueAt(row: PrayerMemoryRowV1 | undefined, now: number): number {
  if (!row) return 0;
  return row.lastShownAt + row.intervalMs;
}

function weightedPick(
  items: { verseKey: string; weight: number }[],
  rng: () => number,
): string {
  if (items.length === 0) return "";
  const sum = items.reduce((s, i) => s + Math.max(1, i.weight), 0);
  let r = rng() * sum;
  for (const it of items) {
    r -= Math.max(1, it.weight);
    if (r <= 0) return it.verseKey;
  }
  return items[items.length - 1]!.verseKey;
}

/**
 * 在「全 manifest」上选下一节 `verseKey`；`memory` 会被原地更新（用于模拟连续多选）。
 */
export function pickNextVerseKey(
  manifest: HomePrayerManifestV1,
  memory: Record<string, PrayerMemoryRowV1>,
  now: number,
  rng: () => number,
): string {
  const list = manifest.entries.map((e) => ({ verseKey: e.verseKey, weight: e.weight }));
  if (list.length === 0) return "";

  const due = list.filter((m) => {
    const row = memory[m.verseKey];
    return dueAt(row, now) <= now;
  });

  if (due.length === 0) {
    let bestKey = list[0]!.verseKey;
    let bestT = Infinity;
    for (const m of list) {
      const t = dueAt(memory[m.verseKey], now);
      if (t < bestT) {
        bestT = t;
        bestKey = m.verseKey;
      }
    }
    const tie = list.filter((m) => dueAt(memory[m.verseKey], now) === bestT);
    return weightedPick(tie, rng);
  }

  if (rng() < P_REVIEW) {
    const minLevel = Math.min(...due.map((m) => memory[m.verseKey]?.level ?? 0));
    const tier = due.filter((m) => (memory[m.verseKey]?.level ?? 0) === minLevel);
    const sorted = [...tier].sort((a, b) => {
      const da = dueAt(memory[a.verseKey], now);
      const db = dueAt(memory[b.verseKey], now);
      return da - db;
    });
    return weightedPick(sorted.length ? sorted : due, rng);
  }

  return weightedPick(list, rng);
}

export function advanceMemoryAfterShown(
  memory: Record<string, PrayerMemoryRowV1>,
  verseKey: string,
  now: number,
): void {
  const prev = memory[verseKey];
  const wasNew = !prev;
  const level = (prev?.level ?? 0) + 1;
  const nextInterval = wasNew ? INITIAL_INTERVAL_MS : Math.min(MAX_INTERVAL_MS, Math.max(INITIAL_INTERVAL_MS, prev!.intervalMs) * INTERVAL_FACTOR);
  memory[verseKey] = {
    lastShownAt: now,
    intervalMs: nextInterval,
    level,
  };
}

/**
 * 用内存副本连续选 `count` 条 key（用于组一批轮播，不把中间状态写入 localStorage）。
 */
export function pickVerseKeySequence(
  manifest: HomePrayerManifestV1,
  memorySnapshot: Record<string, PrayerMemoryRowV1>,
  count: number,
  now: number,
  rng: () => number,
): string[] {
  const mem = cloneMemory(memorySnapshot);
  const keys: string[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < count; i++) {
    let k = pickNextVerseKey(manifest, mem, now, rng);
    if (!k) break;
    let guard = 0;
    while (seen.has(k) && guard < manifest.entries.length) {
      advanceMemoryAfterShown(mem, k, now);
      k = pickNextVerseKey(manifest, mem, now, rng);
      guard++;
    }
    if (!k || seen.has(k)) break;
    seen.add(k);
    keys.push(k);
    advanceMemoryAfterShown(mem, k, now);
  }
  return keys;
}

/**
 * 首屏组批：若 manifest 带 `bootstrapVerseKeys`，先按该顺序（过滤无效）填满一部分，再按复习/随机逻辑补满。
 */
export function buildInitialVerseKeySequence(
  manifest: HomePrayerManifestV1,
  memorySnapshot: Record<string, PrayerMemoryRowV1>,
  count: number,
  now: number,
  rng: () => number,
): string[] {
  const valid = new Set(manifest.entries.map((e) => e.verseKey));
  const bootstrap = (manifest.bootstrapVerseKeys ?? []).filter((k) => valid.has(k));
  if (bootstrap.length === 0) {
    return pickVerseKeySequence(manifest, memorySnapshot, count, now, rng);
  }
  const mem = cloneMemory(memorySnapshot);
  const keys: string[] = [];
  const seen = new Set<string>();
  for (const k of bootstrap) {
    if (keys.length >= count) return keys;
    if (seen.has(k)) continue;
    seen.add(k);
    keys.push(k);
    advanceMemoryAfterShown(mem, k, now);
  }
  const rest = count - keys.length;
  if (rest <= 0) return keys;
  for (let i = 0; i < rest; i++) {
    let k = pickNextVerseKey(manifest, mem, now, rng);
    let guard = 0;
    while (seen.has(k) && guard < manifest.entries.length) {
      advanceMemoryAfterShown(mem, k, now);
      k = pickNextVerseKey(manifest, mem, now, rng);
      guard++;
    }
    if (!k || seen.has(k)) break;
    seen.add(k);
    keys.push(k);
    advanceMemoryAfterShown(mem, k, now);
  }
  return keys;
}
