import { mergeReadingPlanPrefsValue } from "@/lib/read/reading-plan-prefs-merge";
import { mergeNtDeepRepeatReadingState } from "./merge-nt-deep-repeat-progress";
import { mergeTripleLoopReadingState } from "./merge-triple-loop-progress";
import {
  isSameTodayReadingPlanScope,
  planIdFromTodayReadingScopeKey,
  readTodayReadingDoneKeysFromValue,
} from "./today-reading-scope";
import {
  isMemberReadingSyncBlobKey,
  type MemberReadingSyncBlob,
  type MemberReadingSyncBlobKey,
  type MemberReadingSyncDocumentV1,
  type MemberReadingSyncPushV1,
  parseIsoMs,
} from "./schema";

const TOMBSTONE_TTL_MS = 60 * 24 * 60 * 60 * 1000;

function isPlainObj(v: unknown): v is Record<string, unknown> {
  return Boolean(v && typeof v === "object" && !Array.isArray(v));
}

function readFiniteTs(raw: unknown): number {
  const n = Number(raw || 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function bookmarkEntryTs(item: unknown): number {
  if (!isPlainObj(item)) return 0;
  if (item.deleted === true) return readFiniteTs(item.deletedAt);
  return readFiniteTs(item.savedAt);
}

function mergeBookmarks(a: unknown, b: unknown, nowMs = Date.now()): unknown {
  if (!isPlainObj(a) && !isPlainObj(b)) return isPlainObj(a) ? a : b;
  const out: Record<string, unknown> = {};
  for (const side of [a, b]) {
    if (!isPlainObj(side)) continue;
    for (const [key, rawItem] of Object.entries(side)) {
      if (rawItem === undefined) continue;
      const item = rawItem === null ? { deleted: true, deletedAt: nowMs } : rawItem;
      const isTombstone = isPlainObj(item) && item.deleted === true;
      const nextTs = bookmarkEntryTs(item);
      const prev = out[key];
      const prevTs = prev !== undefined ? bookmarkEntryTs(prev) : 0;
      if (prev === undefined || nextTs >= prevTs) {
        out[key] = isTombstone ? { deleted: true, deletedAt: nextTs } : item;
      }
    }
  }
  for (const [k, v] of Object.entries(out)) {
    if (isPlainObj(v) && v.deleted === true && nowMs - readFiniteTs(v.deletedAt) > TOMBSTONE_TTL_MS) {
      delete out[k];
    }
  }
  return out;
}

function normalizeHighlightEntries(entries: unknown): { i: number; c: string }[] {
  if (!Array.isArray(entries)) return [];
  const byIndex = new Map<number, string>();
  for (const row of entries) {
    if (typeof row === "number") {
      if (Number.isInteger(row) && row >= 0) byIndex.set(row, "#FFB103");
      continue;
    }
    if (!isPlainObj(row) || typeof row.i !== "number" || !Number.isInteger(row.i) || row.i < 0) continue;
    if (typeof row.c === "string" && row.c) byIndex.set(row.i, row.c);
  }
  return Array.from(byIndex.entries())
    .sort((x, y) => x[0] - y[0])
    .map(([i, c]) => ({ i, c }));
}

function mergeHighlightLegacyEntries(aEntries: unknown, bEntries: unknown): { i: number; c: string }[] {
  if (bEntries === null) return [];
  if (Array.isArray(bEntries) && bEntries.length === 0) return [];
  const byIndex = new Map<number, string>();
  for (const row of Array.isArray(aEntries) ? aEntries : []) {
    if (isPlainObj(row) && typeof row.i === "number" && Number.isInteger(row.i) && row.i >= 0 && typeof row.c === "string" && row.c) {
      byIndex.set(row.i, row.c);
    }
  }
  for (const row of Array.isArray(bEntries) ? bEntries : []) {
    if (!isPlainObj(row) || typeof row.i !== "number" || !Number.isInteger(row.i) || row.i < 0) continue;
    if (typeof row.c === "string" && row.c === "") byIndex.delete(row.i);
    else if (typeof row.c === "string" && row.c) byIndex.set(row.i, row.c);
  }
  return Array.from(byIndex.entries())
    .sort((x, y) => x[0] - y[0])
    .map(([i, c]) => ({ i, c }));
}

function mergeHighlightStore(a: unknown, b: unknown, nowMs = Date.now()): unknown {
  if (!isPlainObj(a) && !isPlainObj(b)) return isPlainObj(a) ? a : b;
  const la = isPlainObj(a) ? a : {};
  const lb = isPlainObj(b) ? b : {};
  const taMap = isPlainObj(la._t) ? la._t : {};
  const tbMap = isPlainObj(lb._t) ? lb._t : {};

  const keys = new Set<string>();
  for (const obj of [la, lb, taMap, tbMap]) {
    for (const k of Object.keys(obj)) {
      if (k !== "_t") keys.add(k);
    }
  }

  const out: Record<string, unknown> = {};
  const outT: Record<string, number> = {};
  for (const key of keys) {
    const ta = readFiniteTs(taMap[key]);
    const tb = readFiniteTs(tbMap[key]);
    if (ta > 0 || tb > 0) {
      const winnerSide = tb >= ta ? lb : la;
      const winTs = tb >= ta ? tb : ta;
      const normalized = normalizeHighlightEntries(winnerSide[key]);
      if (normalized.length > 0) {
        out[key] = normalized;
        outT[key] = winTs;
      } else if (nowMs - winTs <= TOMBSTONE_TTL_MS) {
        outT[key] = winTs;
      }
    } else {
      const merged = mergeHighlightLegacyEntries(la[key], lb[key]);
      if (merged.length > 0) {
        out[key] = merged;
      }
    }
  }
  if (Object.keys(outT).length > 0) {
    out._t = outT;
  }
  return out;
}

function mergeStringSetRecords(a: unknown, b: unknown, field: "completed" | "doneKeys" | "completedDates"): unknown {
  const read = (v: unknown): string[] => {
    if (!v || typeof v !== "object") return [];
    const arr = (v as Record<string, unknown>)[field];
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : [];
  };
  const version = (v: unknown): number => {
    if (!v || typeof v !== "object") return 1;
    const n = (v as { version?: unknown }).version;
    return n === 1 ? 1 : 1;
  };
  const scopeKey = (v: unknown): string | null => {
    if (!v || typeof v !== "object") return null;
    const s = (v as { scopeKey?: unknown }).scopeKey;
    return typeof s === "string" ? s : null;
  };
  const merged = [...new Set([...read(a), ...read(b)])].sort();
  const base = (a && typeof a === "object" ? a : b) as Record<string, unknown>;
  const out: Record<string, unknown> = { ...(base ?? {}), version: version(base), [field]: merged };
  const scopeA = scopeKey(a);
  const scopeB = scopeKey(b);
  if (scopeA && scopeB && scopeA === scopeB) out.scopeKey = scopeA;
  else if (scopeB) out.scopeKey = scopeB;
  else if (scopeA) out.scopeKey = scopeA;
  return out;
}

function mergeFractions(a: unknown, b: unknown): unknown {
  if (!a || typeof a !== "object") return b;
  if (!b || typeof b !== "object") return a;
  const scopeA = (a as { scopeKey?: string }).scopeKey;
  const scopeB = (b as { scopeKey?: string }).scopeKey;
  if (scopeA && scopeB && scopeA !== scopeB && !isSameTodayReadingPlanScope(scopeA, scopeB)) {
    return parseIsoMs((b as { updatedAt?: string }).updatedAt) >= parseIsoMs((a as { updatedAt?: string }).updatedAt)
      ? b
      : a;
  }
  const fractionsA = (a as { fractions?: Record<string, number> }).fractions ?? {};
  const fractionsB = (b as { fractions?: Record<string, number> }).fractions ?? {};
  const merged: Record<string, number> = { ...fractionsA };
  for (const [k, v] of Object.entries(fractionsB)) {
    if (typeof v !== "number") continue;
    merged[k] = Math.max(merged[k] ?? 0, v);
  }
  return {
    version: 1,
    scopeKey: scopeB || scopeA,
    fractions: merged,
  };
}

function mergeRecentSearches(a: unknown, b: unknown): unknown {
  const read = (v: unknown): string[] => {
    if (!v || typeof v !== "object") return [];
    const terms = (v as { terms?: unknown }).terms;
    if (Array.isArray(terms)) {
      return terms.filter((x): x is string => typeof x === "string");
    }
    return [];
  };
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const term of [...read(b), ...read(a)]) {
    const trimmed = term.trim().replace(/\s+/g, " ");
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(trimmed);
    if (merged.length >= 10) break;
  }
  return { version: 1, terms: merged };
}

/** 最近阅读：按「卷:章」并集，同一章取更晚的时间，按时间倒序，最多 12 条 */
function mergeRecentChapters(a: unknown, b: unknown): unknown {
  type Item = { bookId: string; chapter: number; bookName: string; at: number };
  const read = (v: unknown): Item[] => {
    const items = v && typeof v === "object" ? (v as { items?: unknown }).items : null;
    if (!Array.isArray(items)) return [];
    return items.flatMap((raw) => {
      if (!raw || typeof raw !== "object") return [];
      const o = raw as Record<string, unknown>;
      const bookId = typeof o.bookId === "string" ? o.bookId.trim().toUpperCase() : "";
      const chapter = typeof o.chapter === "number" ? Math.floor(o.chapter) : 0;
      if (!bookId || chapter <= 0) return [];
      return [{
        bookId,
        chapter,
        bookName: typeof o.bookName === "string" ? o.bookName : bookId,
        at: typeof o.at === "number" && Number.isFinite(o.at) ? Math.floor(o.at) : 0,
      }];
    });
  };
  const byKey = new Map<string, Item>();
  for (const item of [...read(a), ...read(b)]) {
    const key = `${item.bookId}:${item.chapter}`;
    const prev = byKey.get(key);
    if (!prev || item.at > prev.at) byKey.set(key, item);
  }
  const items = [...byKey.values()].sort((x, y) => y.at - x.at || (x.bookId < y.bookId ? -1 : 1)).slice(0, 12);
  return { version: 1, items };
}

function scopeKeyFromRecord(v: unknown): string | null {
  if (!v || typeof v !== "object") return null;
  const s = (v as { scopeKey?: unknown }).scopeKey;
  return typeof s === "string" ? s : null;
}

function mergeTodayReadingDone(a: unknown, b: unknown): unknown {
  const scopeA = scopeKeyFromRecord(a);
  const scopeB = scopeKeyFromRecord(b);
  if (scopeA && scopeB && scopeA === scopeB) {
    return mergeStringSetRecords(a, b, "doneKeys");
  }
  const planA = planIdFromTodayReadingScopeKey(scopeA);
  const planB = planIdFromTodayReadingScopeKey(scopeB);
  if (planA && planB && planA === planB) {
    const keysA = readTodayReadingDoneKeysFromValue(a);
    const keysB = readTodayReadingDoneKeysFromValue(b);
    return {
      version: 1,
      scopeKey: scopeB ?? scopeA ?? "",
      doneKeys: [...new Set([...keysA, ...keysB])].sort(),
    };
  }
  const keysA = readTodayReadingDoneKeysFromValue(a);
  const keysB = readTodayReadingDoneKeysFromValue(b);
  if (keysB.length > keysA.length) return b;
  if (keysA.length > keysB.length) return a;
  return b;
}

function mergeBlobValue(
  key: MemberReadingSyncBlobKey,
  a: unknown,
  b: unknown,
  nowMs = Date.now(),
): unknown {
  switch (key) {
    case "bookmarks":
      return mergeBookmarks(a, b, nowMs);
    case "highlights":
      return mergeHighlightStore(a, b, nowMs);
    case "chapterCompletion":
      return mergeStringSetRecords(a, b, "completed");
    case "todayReadingDone":
      return mergeTodayReadingDone(a, b);
    case "habitStats":
      return mergeStringSetRecords(a, b, "completedDates");
    case "scriptureListenTotals": {
      const leftSec =
        a && typeof a === "object" && typeof (a as { totalSec?: unknown }).totalSec === "number"
          ? Math.floor((a as { totalSec: number }).totalSec)
          : 0;
      const rightSec =
        b && typeof b === "object" && typeof (b as { totalSec?: unknown }).totalSec === "number"
          ? Math.floor((b as { totalSec: number }).totalSec)
          : 0;
      return { version: 1, totalSec: Math.max(leftSec, rightSec) };
    }
    case "appUsageTime": {
      // 使用时长：两端取大（和累计听一样，都是单调增的计数）
      const sec = (v: unknown) =>
        v && typeof v === "object" && typeof (v as { totalSec?: unknown }).totalSec === "number"
          ? Math.floor((v as { totalSec: number }).totalSec)
          : 0;
      return { version: 1, totalSec: Math.max(sec(a), sec(b)) };
    }
    case "recentChapters":
      return mergeRecentChapters(a, b);
    case "todayReadingFraction":
      return mergeFractions(a, b);
    case "recentSearches":
      return mergeRecentSearches(a, b);
    case "readingPlanPrefs":
      return mergeReadingPlanPrefsValue(a, b);
    case "lastPosition":
    case "readTypography":
    case "readTranslation":
    case "homeNatureUi":
    case "homePrayerVerse":
    case "homeVersePoolScope":
    case "natureSceneUi":
    case "musicVisualTheme":
    case "scripturePlaybackRate":
    case "cuvAudioVoice":
    case "exploreYearDayProfile":
    case "appLocale":
      return b;
    case "tripleLoopProgress":
      return mergeTripleLoopReadingState(a, b);
    case "ntDeepRepeatProgress":
      return mergeNtDeepRepeatReadingState(a, b);
    case "achievements":
      return mergeAchievements(a, b);
    default:
      return b;
  }
}

/** 成就账本：计数取大、日期取并集、勋章取更高档、首次点亮时间取更早（与两端 AchievementStore.mergeRemote 同规则） */
function mergeAchievements(a: unknown, b: unknown): unknown {
  const rec = (v: unknown): Record<string, unknown> | null =>
    v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  const left = rec(a);
  const right = rec(b);
  if (!left) return b;
  if (!right) return a;
  const sides = [left, right];
  const int = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.floor(v) : 0);
  const maxInt = (k: string) => Math.max(int(left[k]), int(right[k]));
  const dates = (k: string) => {
    const read = (o: Record<string, unknown>) =>
      Array.isArray(o[k]) ? (o[k] as unknown[]).filter((x): x is string => typeof x === "string") : [];
    return Array.from(new Set([...read(left), ...read(right)])).sort();
  };
  // 首读 / 首次点亮时间：两端都有就取更早的那次
  const earliestMap = (k: string) => {
    const out: Record<string, number> = {};
    for (const side of sides) {
      const m = rec(side[k]);
      if (!m) continue;
      for (const [key, v] of Object.entries(m)) {
        const at = int(v);
        const cur = out[key];
        out[key] = cur === undefined ? at : at > 0 ? Math.min(cur, at) : cur;
      }
    }
    return out;
  };
  const earned: Record<string, { tier: number; at: number }> = {};
  for (const side of sides) {
    const m = rec(side.earned);
    if (!m) continue;
    for (const [key, v] of Object.entries(m)) {
      const o = rec(v);
      if (!o) continue;
      const tier = int(o.tier);
      if (tier < 1) continue;
      const at = int(o.at);
      const cur = earned[key];
      if (!cur || tier > cur.tier) earned[key] = { tier, at };
      else if (tier === cur.tier && at > 0) earned[key] = { tier, at: cur.at > 0 ? Math.min(cur.at, at) : at };
    }
  }
  return {
    version: 1,
    chaptersRead: earliestMap("chaptersRead"),
    versesRead: maxInt("versesRead"),
    listenTicks: maxInt("listenTicks"),
    chaptersOpened: maxInt("chaptersOpened"),
    morningDates: dates("morningDates"),
    nightDates: dates("nightDates"),
    bonusXP: maxInt("bonusXP"),
    bestStreakDays: maxInt("bestStreakDays"),
    earned,
    seals: earliestMap("seals"),
  };
}

function mergeBlobPair(
  key: MemberReadingSyncBlobKey,
  left: MemberReadingSyncBlob | undefined,
  right: MemberReadingSyncBlob | undefined,
  nowMs = Date.now(),
): MemberReadingSyncBlob | undefined {
  if (!left) {
    if (!right) return right;
    if (key === "bookmarks") return { updatedAt: right.updatedAt, value: mergeBookmarks({}, right.value, nowMs) };
    if (key === "highlights") return { updatedAt: right.updatedAt, value: mergeHighlightStore({}, right.value, nowMs) };
    return right;
  }
  if (!right) return left;
  const leftMs = parseIsoMs(left.updatedAt);
  const rightMs = parseIsoMs(right.updatedAt);
  const newer = rightMs >= leftMs ? right : left;
  const older = newer === right ? left : right;
  const value = mergeBlobValue(key, older.value, newer.value, nowMs);
  return {
    updatedAt: new Date(Math.max(leftMs, rightMs)).toISOString(),
    value,
  };
}

export function mergeMemberReadingSyncPush(
  base: Partial<Record<MemberReadingSyncBlobKey, MemberReadingSyncBlob>> | undefined,
  incoming: MemberReadingSyncPushV1,
  nowMs = Date.now(),
): Partial<Record<MemberReadingSyncBlobKey, MemberReadingSyncBlob>> {
  const blobs: Partial<Record<MemberReadingSyncBlobKey, MemberReadingSyncBlob>> = {
    ...(base ?? {}),
  };
  for (const [rawKey, blob] of Object.entries(incoming.blobs ?? {})) {
    if (!isMemberReadingSyncBlobKey(rawKey) || !blob || typeof blob !== "object") continue;
    if (typeof blob.updatedAt !== "string" || !blob.updatedAt.trim()) continue;
    blobs[rawKey] = mergeBlobPair(rawKey, blobs[rawKey], blob, nowMs);
  }
  return blobs;
}

export function mergeMemberReadingSyncDocuments(
  userId: string,
  base: MemberReadingSyncDocumentV1 | null,
  incoming: MemberReadingSyncPushV1,
  now = new Date(),
): MemberReadingSyncDocumentV1 {
  const nowMs = now.getTime();
  const blobs: Partial<Record<MemberReadingSyncBlobKey, MemberReadingSyncBlob>> = {
    ...(base?.blobs ?? {}),
  };
  for (const [rawKey, blob] of Object.entries(incoming.blobs ?? {})) {
    if (!isMemberReadingSyncBlobKey(rawKey) || !blob || typeof blob !== "object") continue;
    if (typeof blob.updatedAt !== "string" || !blob.updatedAt.trim()) continue;
    blobs[rawKey] = mergeBlobPair(rawKey, blobs[rawKey], blob, nowMs);
  }
  return {
    schemaVersion: 1,
    userId,
    revision: `${nowMs}-${Math.random().toString(36).slice(2, 10)}`,
    updatedAt: now.toISOString(),
    blobs,
  };
}
