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

function mergeBookmarks(a: unknown, b: unknown): unknown {
  if (!a || typeof a !== "object") return b;
  if (!b || typeof b !== "object") return a;
  const out: Record<string, unknown> = { ...(a as Record<string, unknown>) };
  for (const [key, item] of Object.entries(b as Record<string, unknown>)) {
    const next = item as { savedAt?: number } | undefined;
    const prev = out[key] as { savedAt?: number } | undefined;
    if (!prev || (typeof next?.savedAt === "number" && next.savedAt >= (prev.savedAt ?? 0))) {
      out[key] = item;
    }
  }
  return out;
}

function mergeHighlightStore(a: unknown, b: unknown): unknown {
  if (!a || typeof a !== "object") return b;
  if (!b || typeof b !== "object") return a;
  const out: Record<string, { i: number; c: string }[]> = {
    ...(a as Record<string, { i: number; c: string }[]>),
  };
  for (const [key, entries] of Object.entries(b as Record<string, { i: number; c: string }[]>)) {
    if (!Array.isArray(entries)) continue;
    const byIndex = new Map<number, string>();
    for (const row of out[key] ?? []) {
      if (Number.isInteger(row?.i) && row.i >= 0) byIndex.set(row.i, row.c);
    }
    for (const row of entries) {
      if (!row || !Number.isInteger(row.i) || row.i < 0) continue;
      byIndex.set(row.i, row.c);
    }
    const merged = Array.from(byIndex.entries())
      .sort((x, y) => x[0] - y[0])
      .map(([i, c]) => ({ i, c }));
    if (merged.length) out[key] = merged;
    else delete out[key];
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
    if (merged.length >= 8) break;
  }
  return { version: 1, terms: merged };
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

function mergeBlobValue(key: MemberReadingSyncBlobKey, a: unknown, b: unknown): unknown {
  switch (key) {
    case "bookmarks":
      return mergeBookmarks(a, b);
    case "highlights":
      return mergeHighlightStore(a, b);
    case "chapterCompletion":
      return mergeStringSetRecords(a, b, "completed");
    case "todayReadingDone":
      return mergeTodayReadingDone(a, b);
    case "habitStats":
      return mergeStringSetRecords(a, b, "completedDates");
    case "todayReadingFraction":
      return mergeFractions(a, b);
    case "recentSearches":
      return mergeRecentSearches(a, b);
    case "lastPosition":
    case "readingPlanPrefs":
    case "tripleLoopProgress":
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
    default:
      return b;
  }
}

function mergeBlobPair(
  key: MemberReadingSyncBlobKey,
  left: MemberReadingSyncBlob | undefined,
  right: MemberReadingSyncBlob | undefined,
): MemberReadingSyncBlob | undefined {
  if (!left) return right;
  if (!right) return left;
  const leftMs = parseIsoMs(left.updatedAt);
  const rightMs = parseIsoMs(right.updatedAt);
  const newer = rightMs >= leftMs ? right : left;
  const older = newer === right ? left : right;
  const value = mergeBlobValue(key, older.value, newer.value);
  return {
    updatedAt: new Date(Math.max(leftMs, rightMs)).toISOString(),
    value,
  };
}

export function mergeMemberReadingSyncPush(
  base: Partial<Record<MemberReadingSyncBlobKey, MemberReadingSyncBlob>> | undefined,
  incoming: MemberReadingSyncPushV1,
): Partial<Record<MemberReadingSyncBlobKey, MemberReadingSyncBlob>> {
  const blobs: Partial<Record<MemberReadingSyncBlobKey, MemberReadingSyncBlob>> = {
    ...(base ?? {}),
  };
  for (const [rawKey, blob] of Object.entries(incoming.blobs ?? {})) {
    if (!isMemberReadingSyncBlobKey(rawKey) || !blob || typeof blob !== "object") continue;
    if (typeof blob.updatedAt !== "string" || !blob.updatedAt.trim()) continue;
    blobs[rawKey] = mergeBlobPair(rawKey, blobs[rawKey], blob);
  }
  return blobs;
}

export function mergeMemberReadingSyncDocuments(
  userId: string,
  base: MemberReadingSyncDocumentV1 | null,
  incoming: MemberReadingSyncPushV1,
  now = new Date(),
): MemberReadingSyncDocumentV1 {
  const blobs: Partial<Record<MemberReadingSyncBlobKey, MemberReadingSyncBlob>> = {
    ...(base?.blobs ?? {}),
  };
  for (const [rawKey, blob] of Object.entries(incoming.blobs ?? {})) {
    if (!isMemberReadingSyncBlobKey(rawKey) || !blob || typeof blob !== "object") continue;
    if (typeof blob.updatedAt !== "string" || !blob.updatedAt.trim()) continue;
    blobs[rawKey] = mergeBlobPair(rawKey, blobs[rawKey], blob);
  }
  return {
    schemaVersion: 1,
    userId,
    revision: `${now.getTime()}-${Math.random().toString(36).slice(2, 10)}`,
    updatedAt: now.toISOString(),
    blobs,
  };
}
