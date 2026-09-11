// TS 侧期望值：mergeReadingBlobs / ownerPolicy / sidecar / reading-plan-prefs-merge / year-day-timeline 直接调 RN 与 lib 的源码；
// 拖着 AsyncStorage 的（scripture-listen-totals / today-reading-done / reading-habit-stats）照抄纯函数。
import { readFileSync } from "node:fs";
import * as prefsMergeNs from "../lib/read/reading-plan-prefs-merge";
import * as tripleNs from "../lib/bible/reading-plans/triple-loop-reading";
import * as tripleReadNs from "../lib/bible/reading-plans/triple-loop-chapters-read";
import * as ntNs from "../lib/bible/reading-plans/nt-deep-repeat-reading";
import * as ntReadNs from "../lib/bible/reading-plans/nt-deep-repeat-chapters-read";
import * as currNs from "../lib/bible/reading-plans/nt-deep-repeat-curriculum";
import * as yearNs from "../lib/read/year-day-timeline";
import * as ownerNs from "../apps/askbible-mobile/src/member-sync/memberReadingSyncOwnerPolicy";
import * as sidecarNs from "../apps/askbible-mobile/src/member-sync/readingPlanSyncSidecar";
import * as schemaNs from "../apps/askbible-mobile/src/member-sync/schema";
const unwrap = (ns: any) => (ns && ns.default && typeof ns.default === "object" ? { ...ns.default, ...ns } : ns);
const prefsMerge: any = unwrap(prefsMergeNs), triple: any = unwrap(tripleNs), tripleRead: any = unwrap(tripleReadNs);
const nt: any = unwrap(ntNs), ntRead: any = unwrap(ntReadNs), curr: any = unwrap(currNs), year: any = unwrap(yearNs);
const owner: any = unwrap(ownerNs), sidecar: any = unwrap(sidecarNs), schema: any = unwrap(schemaNs);

// ---- 照抄 today-reading-done.ts ----
function planIdFromTodayReadingScopeKey(scopeKey: string | null | undefined): string | null {
  if (!scopeKey?.trim()) return null;
  return scopeKey.split(":")[0]?.trim() || null;
}
function isSameTodayReadingPlanScope(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  const pa = planIdFromTodayReadingScopeKey(a), pb = planIdFromTodayReadingScopeKey(b);
  return Boolean(pa && pb && pa === pb);
}
// ---- 照抄 scripture-listen-totals.ts ----
function parseScriptureListenTotalsRecord(raw: unknown): { version: 1; totalSec: number } | null {
  if (!raw || typeof raw !== "object") return null;
  const parsed = raw as { version?: unknown; totalSec?: unknown };
  if (parsed.version !== 1) return null;
  const n = Number(parsed.totalSec);
  if (!Number.isFinite(n) || n < 0) return null;
  return { version: 1, totalSec: Math.floor(n) };
}
function mergeScriptureListenTotalsRecords(a: { totalSec: number }, b: { totalSec: number }) {
  return { version: 1, totalSec: Math.max(a.totalSec, b.totalSec) };
}
// ---- 照抄 merge-triple-loop-reading-state.ts / merge-nt-deep-repeat-reading-state.ts ----
function trackOrder(track: string): string[] {
  if (track === "ot") return triple.TRIPLE_LOOP_OT_BOOK_IDS;
  if (track === "nt") return triple.TRIPLE_LOOP_NT_BOOK_IDS;
  return triple.TRIPLE_LOOP_WISDOM_BOOK_IDS;
}
function pointerProgress(pointer: any, order: string[]): number {
  const bookIdx = order.indexOf(pointer.bookId);
  return (bookIdx >= 0 ? bookIdx : 0) * 10_000 + pointer.chapter;
}
function mergePointer(a: any, b: any, order: string[]) { return pointerProgress(a, order) >= pointerProgress(b, order) ? a : b; }
function mergeTripleLoopReadingState(a: unknown, b: unknown) {
  const left = triple.normalizeTripleLoopReadingState(a && typeof a === "object" ? a : null);
  const right = triple.normalizeTripleLoopReadingState(b && typeof b === "object" ? b : null);
  const keysLeft = tripleRead.normalizeTripleLoopChaptersReadKeys(left.chaptersReadKeys);
  const keysRight = tripleRead.normalizeTripleLoopChaptersReadKeys(right.chaptersReadKeys);
  const mergedKeys = {
    ot: [...new Set([...keysLeft.ot, ...keysRight.ot])].sort(),
    nt: [...new Set([...keysLeft.nt, ...keysRight.nt])].sort(),
    wisdom: [...new Set([...keysLeft.wisdom, ...keysRight.wisdom])].sort(),
  };
  const tracks = ["ot", "nt", "wisdom"];
  const mergedPointers = Object.fromEntries(tracks.map((t) => [t, mergePointer(left[t], right[t], trackOrder(t))]));
  const startedAt = left.startedAt && right.startedAt ? (left.startedAt <= right.startedAt ? left.startedAt : right.startedAt) : left.startedAt ?? right.startedAt;
  return triple.normalizeTripleLoopReadingState({ ...mergedPointers, chaptersReadKeys: mergedKeys, startedAt });
}
function ntPointerProgress(pointer: any): number {
  const bookIdx = curr.NT_DEEP_REPEAT_OT_BOOK_IDS.indexOf(pointer.bookId);
  return (bookIdx >= 0 ? bookIdx : 0) * 10_000 + pointer.chapter;
}
function mergeNtDeepRepeatReadingState(a: unknown, b: unknown) {
  const left = nt.normalizeNtDeepRepeatReadingState(a && typeof a === "object" ? a : null);
  const right = nt.normalizeNtDeepRepeatReadingState(b && typeof b === "object" ? b : null);
  const keysLeft = ntRead.normalizeNtDeepRepeatChaptersReadKeys(left.chaptersReadKeys);
  const keysRight = ntRead.normalizeNtDeepRepeatChaptersReadKeys(right.chaptersReadKeys);
  const mergedKeys = { ot: [...new Set([...keysLeft.ot, ...keysRight.ot])].sort(), nt: [...new Set([...keysLeft.nt, ...keysRight.nt])].sort() };
  const progress = (s: any) => s.curriculumIndex * 1000 + s.dayInSegment;
  const lead = progress(left) >= progress(right) ? left : right;
  const curriculumIndex = lead.curriculumIndex;
  const dayInSegment = left.curriculumIndex === right.curriculumIndex ? Math.max(left.dayInSegment, right.dayInSegment) : lead.dayInSegment;
  const startedAt = left.startedAt && right.startedAt ? (left.startedAt <= right.startedAt ? left.startedAt : right.startedAt) : left.startedAt ?? right.startedAt;
  return nt.normalizeNtDeepRepeatReadingState({
    ot: ntPointerProgress(left.ot) >= ntPointerProgress(right.ot) ? left.ot : right.ot,
    curriculumIndex, dayInSegment, pace: lead.pace, chaptersReadKeys: mergedKeys, startedAt,
  });
}
// ---- 照抄 mergeReadingBlobs.ts ----
function mergeBookmarks(a: unknown, b: unknown): unknown {
  if (!a || typeof a !== "object") return b;
  if (!b || typeof b !== "object") return a;
  const out: Record<string, unknown> = { ...(a as Record<string, unknown>) };
  for (const [key, item] of Object.entries(b as Record<string, unknown>)) {
    const next = item as { savedAt?: number } | undefined;
    const prev = out[key] as { savedAt?: number } | undefined;
    if (!prev || (typeof next?.savedAt === "number" && next.savedAt >= (prev.savedAt ?? 0))) out[key] = item;
  }
  return out;
}
function mergeHighlightStore(a: unknown, b: unknown): unknown {
  if (!a || typeof a !== "object") return b;
  if (!b || typeof b !== "object") return a;
  const out: Record<string, { i: number; c: string }[]> = { ...(a as Record<string, { i: number; c: string }[]>) };
  for (const [key, entries] of Object.entries(b as Record<string, { i: number; c: string }[]>)) {
    if (!Array.isArray(entries)) continue;
    const byIndex = new Map<number, string>();
    for (const row of out[key] ?? []) { if (Number.isInteger(row?.i) && row.i >= 0) byIndex.set(row.i, row.c); }
    for (const row of entries) { if (!row || !Number.isInteger(row.i) || row.i < 0) continue; byIndex.set(row.i, row.c); }
    const merged = Array.from(byIndex.entries()).sort((x, y) => x[0] - y[0]).map(([i, c]) => ({ i, c }));
    if (merged.length) out[key] = merged; else delete out[key];
  }
  return out;
}
function mergeStringSetRecords(a: unknown, b: unknown, field: string): unknown {
  const read = (v: unknown): string[] => { if (!v || typeof v !== "object") return []; const arr = (v as any)[field]; return Array.isArray(arr) ? arr.filter((x: unknown): x is string => typeof x === "string") : []; };
  const version = (v: unknown): number => { if (!v || typeof v !== "object") return 1; return (v as any).version === 1 ? 1 : 1; };
  const scopeKey = (v: unknown): string | null => { if (!v || typeof v !== "object") return null; const s = (v as any).scopeKey; return typeof s === "string" ? s : null; };
  const merged = [...new Set([...read(a), ...read(b)])].sort();
  const base = (a && typeof a === "object" ? a : b) as Record<string, unknown>;
  const out: Record<string, unknown> = { ...(base ?? {}), version: version(base), [field]: merged };
  const scopeA = scopeKey(a), scopeB = scopeKey(b);
  if (scopeA && scopeB && scopeA === scopeB) out.scopeKey = scopeA; else if (scopeB) out.scopeKey = scopeB; else if (scopeA) out.scopeKey = scopeA;
  return out;
}
function mergeFractions(a: unknown, b: unknown): unknown {
  if (!a || typeof a !== "object") return b;
  if (!b || typeof b !== "object") return a;
  const scopeA = (a as any).scopeKey, scopeB = (b as any).scopeKey;
  if (scopeA && scopeB && scopeA !== scopeB && !isSameTodayReadingPlanScope(scopeA, scopeB)) {
    return schema.parseIsoMs((b as any).updatedAt) >= schema.parseIsoMs((a as any).updatedAt) ? b : a;
  }
  const fractionsA = (a as any).fractions ?? {}, fractionsB = (b as any).fractions ?? {};
  const merged: Record<string, number> = { ...fractionsA };
  for (const [k, v] of Object.entries(fractionsB)) { if (typeof v !== "number") continue; merged[k] = Math.max(merged[k] ?? 0, v); }
  return { version: 1, scopeKey: scopeB || scopeA, fractions: merged };
}
function mergeRecentSearches(a: unknown, b: unknown): unknown {
  const read = (v: unknown): string[] => { if (!v || typeof v !== "object") return []; const terms = (v as any).terms; return Array.isArray(terms) ? terms.filter((x: unknown): x is string => typeof x === "string") : []; };
  const seen = new Set<string>(); const merged: string[] = [];
  for (const term of [...read(b), ...read(a)]) {
    const trimmed = term.trim().replace(/\s+/g, " ");
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key); merged.push(trimmed);
    if (merged.length >= 8) break;
  }
  return { version: 1, terms: merged };
}
function scopeKeyFromRecord(v: unknown): string | null { if (!v || typeof v !== "object") return null; const s = (v as any).scopeKey; return typeof s === "string" ? s : null; }
function readDoneKeys(v: unknown): string[] { if (!v || typeof v !== "object") return []; const arr = (v as any).doneKeys; return Array.isArray(arr) ? arr.filter((x: unknown): x is string => typeof x === "string" && x.length > 0) : []; }
function mergeTodayReadingDone(a: unknown, b: unknown): unknown {
  const scopeA = scopeKeyFromRecord(a), scopeB = scopeKeyFromRecord(b);
  if (scopeA && scopeB && scopeA === scopeB) return mergeStringSetRecords(a, b, "doneKeys");
  const planA = planIdFromTodayReadingScopeKey(scopeA), planB = planIdFromTodayReadingScopeKey(scopeB);
  if (planA && planB && planA === planB) {
    return { version: 1, scopeKey: scopeB ?? scopeA ?? "", doneKeys: [...new Set([...readDoneKeys(a), ...readDoneKeys(b)])].sort() };
  }
  const keysA = readDoneKeys(a), keysB = readDoneKeys(b);
  if (keysB.length > keysA.length) return b;
  if (keysA.length > keysB.length) return a;
  return b;
}
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

function mergeBlobValue(key: string, a: unknown, b: unknown): unknown {
  switch (key) {
    case "bookmarks": return mergeBookmarks(a, b);
    case "highlights": return mergeHighlightStore(a, b);
    case "chapterCompletion": return mergeStringSetRecords(a, b, "completed");
    case "todayReadingDone": return mergeTodayReadingDone(a, b);
    case "habitStats": return mergeStringSetRecords(a, b, "completedDates");
    case "scriptureListenTotals": { const left = parseScriptureListenTotalsRecord(a), right = parseScriptureListenTotalsRecord(b); if (!left) return right ?? b; if (!right) return left; return mergeScriptureListenTotalsRecords(left, right); }
    case "todayReadingFraction": return mergeFractions(a, b);
    case "recentSearches": return mergeRecentSearches(a, b);
    // 使用时长 / 最近阅读上云（Josh 2026-09-11），真源在 lib/member-reading-sync/merge.ts
    case "appUsageTime": {
      const sec = (v: unknown) =>
        v && typeof v === "object" && typeof (v as { totalSec?: unknown }).totalSec === "number"
          ? Math.floor((v as { totalSec: number }).totalSec)
          : 0;
      return { version: 1, totalSec: Math.max(sec(a), sec(b)) };
    }
    case "recentChapters": return mergeRecentChapters(a, b);
    case "readingPlanPrefs": return prefsMerge.mergeReadingPlanPrefsValue(a, b);
    case "tripleLoopProgress": return mergeTripleLoopReadingState(a, b);
    case "ntDeepRepeatProgress": return mergeNtDeepRepeatReadingState(a, b);
    default: return b;
  }
}
function mergeBlobPair(key: string, left: any, right: any) {
  if (!left) return right;
  if (!right) return left;
  const leftMs = schema.parseIsoMs(left.updatedAt), rightMs = schema.parseIsoMs(right.updatedAt);
  const newer = rightMs >= leftMs ? right : left;
  const older = newer === right ? left : right;
  return { updatedAt: new Date(Math.max(leftMs, rightMs)).toISOString(), value: mergeBlobValue(key, older.value, newer.value) };
}
function mergeMemberReadingSyncPush(base: any, incoming: any) {
  const blobs: any = { ...(base ?? {}) };
  for (const [rawKey, blob] of Object.entries(incoming ?? {}) as [string, any][]) {
    if (!schema.isMemberReadingSyncBlobKey(rawKey) || !blob || typeof blob !== "object") continue;
    if (typeof blob.updatedAt !== "string" || !blob.updatedAt.trim()) continue;
    blobs[rawKey] = mergeBlobPair(rawKey, blobs[rawKey], blob);
  }
  return blobs;
}
// ---- 照抄 reading-habit-stats.ts ----
function toLocalDateString(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
function shiftLocalDate(iso: string, delta: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso); if (!m) return iso;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])); d.setDate(d.getDate() + delta); return toLocalDateString(d);
}
function computeReadingStreak(completedDates: string[], today: string): number {
  const set = new Set(completedDates); if (set.size === 0) return 0;
  let cursor = set.has(today) ? today : shiftLocalDate(today, -1); let streak = 0;
  while (set.has(cursor)) { streak += 1; cursor = shiftLocalDate(cursor, -1); }
  return streak;
}
function normalizeDates(raw: string[]) { return [...new Set(raw.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)))].sort(); }
function formatScriptureListenDuration(totalSec: number, locale: string): string {
  const sec = Math.max(0, Math.floor(totalSec)); const hours = Math.floor(sec / 3600); const minutes = Math.floor((sec % 3600) / 60);
  if (locale === "en") { if (hours <= 0) return `${minutes} min`; if (minutes <= 0) return `${hours} hr`; return `${hours} hr ${minutes} min`; }
  if (hours <= 0) return `${minutes} 分钟`; if (minutes <= 0) return `${hours} 小时`; return `${hours} 小时 ${minutes} 分钟`;
}
function formatAppUsageDuration(totalSec: number, locale: string): string {
  const sec = Math.max(0, Math.floor(totalSec)); const hours = Math.floor(sec / 3600); const minutes = Math.floor((sec % 3600) / 60); const seconds = sec % 60;
  if (locale === "en") {
    if (hours <= 0 && minutes <= 0) return `${seconds} sec`;
    if (hours <= 0) return minutes > 0 && seconds === 0 ? `${minutes} min` : `${minutes} min ${seconds} sec`;
    if (minutes <= 0) return `${hours} hr`; return `${hours} hr ${minutes} min`;
  }
  if (hours <= 0 && minutes <= 0) return `${seconds} 秒`;
  if (hours <= 0) return seconds === 0 ? `${minutes} 分钟` : `${minutes} 分 ${seconds} 秒`;
  if (minutes <= 0) return `${hours} 小时`; return `${hours} 小时 ${minutes} 分钟`;
}
// ---- 规范 JSON（键排序） ----
function canonical(v: unknown): string {
  if (v === undefined || v === null) return "null";
  if (Array.isArray(v)) return "[" + v.map(canonical).join(",") + "]";
  if (typeof v === "object") return "{" + Object.keys(v as object).filter((k) => (v as any)[k] !== undefined).sort().map((k) => JSON.stringify(k) + ":" + canonical((v as any)[k])).join(",") + "}";
  return JSON.stringify(v);
}
const parse = (s: string) => { const t = s.trim(); return t === "" || t === "-" ? undefined : JSON.parse(t); };
const localDate = (iso: string) => { const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d, 12); };
const dates = (s: string) => (s ? s.split(",") : []);
const lines = readFileSync(0, "utf8").split("\n"); if (lines[lines.length - 1] === "") lines.pop();
const out: string[] = [];
for (const line of lines) {
  const f = line.split("\t");
  switch (f[0]) {
    case "merge": out.push(canonical(mergeMemberReadingSyncPush(parse(f[1]), parse(f[2])))); break;
    case "mergeval": out.push(canonical(mergeBlobValue(f[1], parse(f[2]), parse(f[3])))); break;
    case "path": out.push(owner.decideMemberReadingSyncPath({ boundUserId: f[1] || null, requirePullOnly: f[2] === "1", userId: f[3], remoteHasProgress: f[4] === "1", localHasProgress: f[5] === "1", forcePush: f[6] === "1" })); break;
    case "force": out.push(owner.shouldForcePushMemberReadingSync(f[1] || undefined) ? "1" : "0"); break;
    case "progress": out.push(owner.blobsHaveMemberReadingProgress(parse(f[1])) ? "1" : "0"); break;
    case "shouldsync": out.push(prefsMerge.shouldSyncReadingPlanPrefs(parse(f[1])) ? "1" : "0"); break;
    case "sidecar": out.push(canonical(sidecar.localeValueWithReadingPlan(parse(f[1]), parse(f[2])))); break;
    case "planid": out.push(sidecar.planIdFromReadingSyncBlobs(parse(f[1])) ?? "null"); break;
    case "scope": out.push(`${isSameTodayReadingPlanScope(f[1] || null, f[2] || null) ? 1 : 0}|${planIdFromTodayReadingScopeKey(f[1]) ?? "null"}`); break;
    case "streak": out.push(String(computeReadingStreak(dates(f[1]), f[2]))); break;
    case "dates": out.push(normalizeDates(dates(f[1])).join(",")); break;
    case "yeartl": { const t = year.getYearDayTimeline(localDate(f[1])); out.push(`${t.dayOfYear}|${t.daysInYear}|${t.progress.toFixed(6)}`); break; }
    case "ranges": { const now = localDate(f[2]); const t = year.getYearDayTimeline(now);
      out.push(year.buildYearReadRangesBeforeToday(dates(f[1]), now).map((r: any) => { const fr = year.yearDayRangeToTrackFraction(r, t.daysInYear); return `${r.startDay}-${r.endDay}@${fr.left.toFixed(5)}+${fr.width.toFixed(5)}`; }).join(";")); break; }
    case "fmtlisten": out.push(formatScriptureListenDuration(Number(f[1]), f[2])); break;
    case "fmtusage": out.push(formatAppUsageDuration(Number(f[1]), f[2])); break;
    case "parsems": { const ms = Date.parse(f[1]); out.push(Number.isFinite(ms) ? String(ms) : "null"); break; }
    case "iso": out.push(new Date(Number(f[1])).toISOString()); break;
    default: out.push("skip");
  }
}
console.log(JSON.stringify(out));
