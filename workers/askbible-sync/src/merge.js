// Single Authoritative Server-Side Member Reading Sync Merger (D-44).
// Clients no longer duplicate 700-line merge engines across Swift, Kotlin, and TypeScript.

const BOOKS = [
  ["GEN", 50], ["EXO", 40], ["LEV", 27], ["NUM", 36], ["DEU", 34], ["JOS", 24],
  ["JDG", 21], ["RUT", 4],  ["1SA", 31], ["2SA", 24], ["1KI", 22], ["2KI", 25],
  ["1CH", 29], ["2CH", 36], ["EZR", 10], ["NEH", 13], ["EST", 10], ["JOB", 42],
  ["PSA", 150],["PRO", 31], ["ECC", 12], ["SNG", 8],  ["ISA", 66], ["JER", 52],
  ["LAM", 5],  ["EZK", 48], ["DAN", 12], ["HOS", 14], ["JOL", 3],  ["AMO", 9],
  ["OBA", 1],  ["JON", 4],  ["MIC", 7],  ["NAM", 3],  ["HAB", 3],  ["ZEP", 3],
  ["HAG", 2],  ["ZEC", 14], ["MAL", 4],  ["MAT", 28], ["MRK", 16], ["LUK", 24],
  ["JHN", 21], ["ACT", 28], ["ROM", 16], ["1CO", 16], ["2CO", 13], ["GAL", 6],
  ["EPH", 6],  ["PHP", 4],  ["COL", 4],  ["1TH", 5],  ["2TH", 3],  ["1TI", 6],
  ["2TI", 4],  ["TIT", 3],  ["PHM", 1],  ["HEB", 13], ["JAS", 5],  ["1PE", 5],
  ["2PE", 3],  ["1JN", 5],  ["2JN", 1],  ["3JN", 1],  ["JUD", 1],  ["REV", 22],
];

const BOOK_CHAPTERS = new Map(BOOKS);
const WISDOM_SET = new Set(["JOB", "PSA", "PRO", "ECC", "SNG"]);
const OT_BOOKS = BOOKS.slice(0, 39).map(([id]) => id);
const NT_BOOKS = BOOKS.slice(39).map(([id]) => id);
const TRIPLE_OT_BOOKS = OT_BOOKS.filter((id) => !WISDOM_SET.has(id));
const TRIPLE_WISDOM_BOOKS = ["JOB", "PSA", "PRO", "ECC", "SNG"];
const NT_DEEP_CURRICULUM_BOOKS = new Set(NT_BOOKS.filter((id) => id !== "LUK"));

export const VALID_BLOB_KEYS = new Set([
  "bookmarks", "highlights", "lastPosition", "chapterCompletion",
  "tripleLoopProgress", "ntDeepRepeatProgress", "readingPlanPrefs",
  "todayReadingDone", "todayReadingFraction", "habitStats",
  "scriptureListenTotals", "readTypography", "readTranslation",
  "recentSearches", "homeNatureUi", "homePrayerVerse", "homeVersePoolScope",
  "natureSceneUi", "musicVisualTheme", "scripturePlaybackRate",
  "cuvAudioVoice", "exploreYearDayProfile", "appLocale",
  "appUsageTime", "recentChapters", "achievements",
]);

function isPlainObj(v) {
  return Boolean(v && typeof v === "object" && !Array.isArray(v));
}

function parseIsoMs(raw) {
  if (typeof raw !== "string" || !raw.trim()) return 0;
  const ms = Date.parse(raw.trim());
  return Number.isFinite(ms) ? ms : 0;
}

function normalizeChapterKeys(raw, allowedSet) {
  if (!Array.isArray(raw)) return [];
  const out = new Set();
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const [b, c] = item.trim().split(":");
    if (!b || !c) continue;
    const bid = b.trim().toUpperCase();
    if (!allowedSet.has(bid)) continue;
    const ch = Number(c.trim());
    const maxCh = BOOK_CHAPTERS.get(bid) || 0;
    if (Number.isInteger(ch) && ch >= 1 && ch <= maxCh) {
      out.add(`${bid}:${ch}`);
    }
  }
  return [...out].sort();
}

function normalizePointer(ptr, order) {
  const def = order[0] || "GEN";
  const rawId = isPlainObj(ptr) && typeof ptr.bookId === "string" ? ptr.bookId.trim().toUpperCase() : def;
  const bookId = order.includes(rawId) ? rawId : def;
  const maxCh = BOOK_CHAPTERS.get(bookId) || 1;
  const rawCh = isPlainObj(ptr) && typeof ptr.chapter === "number" && Number.isFinite(ptr.chapter)
    ? Math.floor(ptr.chapter)
    : 1;
  return { bookId, chapter: Math.min(Math.max(1, rawCh), maxCh) };
}

function pointerProgress(ptr, order) {
  const idx = order.indexOf(ptr.bookId);
  return (idx >= 0 ? idx : 0) * 10000 + ptr.chapter;
}

const TOMBSTONE_TTL_MS = 60 * 24 * 60 * 60 * 1000;

function readFiniteTs(raw) {
  const n = Number(raw || 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function bookmarkEntryTs(item) {
  if (!isPlainObj(item)) return 0;
  if (item.deleted === true) return readFiniteTs(item.deletedAt);
  return readFiniteTs(item.savedAt);
}

function mergeBookmarks(a, b, nowMs = Date.now()) {
  if (!isPlainObj(a) && !isPlainObj(b)) return isPlainObj(a) ? a : b;
  const out = {};
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

function normalizeHighlightEntries(entries) {
  if (!Array.isArray(entries)) return [];
  const byIndex = new Map();
  for (const row of entries) {
    if (typeof row === "number") {
      if (Number.isInteger(row) && row >= 0) byIndex.set(row, "#FFB103");
      continue;
    }
    if (!isPlainObj(row) || !Number.isInteger(row.i) || row.i < 0) continue;
    if (typeof row.c === "string" && row.c) byIndex.set(row.i, row.c);
  }
  return [...byIndex.entries()].sort((x, y) => x[0] - y[0]).map(([i, c]) => ({ i, c }));
}

function mergeHighlightLegacyEntries(aEntries, bEntries) {
  if (bEntries === null) return [];
  if (Array.isArray(bEntries) && bEntries.length === 0) return [];
  const byIndex = new Map();
  for (const row of Array.isArray(aEntries) ? aEntries : []) {
    if (isPlainObj(row) && Number.isInteger(row.i) && row.i >= 0 && typeof row.c === "string" && row.c) {
      byIndex.set(row.i, row.c);
    }
  }
  for (const row of Array.isArray(bEntries) ? bEntries : []) {
    if (!isPlainObj(row) || !Number.isInteger(row.i) || row.i < 0) continue;
    if (typeof row.c === "string" && row.c === "") byIndex.delete(row.i);
    else if (typeof row.c === "string" && row.c) byIndex.set(row.i, row.c);
  }
  return [...byIndex.entries()].sort((x, y) => x[0] - y[0]).map(([i, c]) => ({ i, c }));
}

function mergeHighlights(a, b, nowMs = Date.now()) {
  if (!isPlainObj(a) && !isPlainObj(b)) return isPlainObj(a) ? a : b;
  const la = isPlainObj(a) ? a : {};
  const lb = isPlainObj(b) ? b : {};
  const taMap = isPlainObj(la._t) ? la._t : {};
  const tbMap = isPlainObj(lb._t) ? lb._t : {};

  const keys = new Set();
  for (const obj of [la, lb, taMap, tbMap]) {
    for (const k of Object.keys(obj)) {
      if (k !== "_t") keys.add(k);
    }
  }

  const out = {};
  const outT = {};
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

function mergeStringSet(a, b, field) {
  const read = (v) => (isPlainObj(v) && Array.isArray(v[field]) ? v[field].filter((x) => typeof x === "string") : []);
  const merged = [...new Set([...read(a), ...read(b)])].sort();
  const base = isPlainObj(a) ? a : isPlainObj(b) ? b : {};
  const out = { ...base, version: 1, [field]: merged };
  const sa = isPlainObj(a) && typeof a.scopeKey === "string" ? a.scopeKey : null;
  const sb = isPlainObj(b) && typeof b.scopeKey === "string" ? b.scopeKey : null;
  if (sa && sb && sa === sb) out.scopeKey = sa;
  else if (sb) out.scopeKey = sb;
  else if (sa) out.scopeKey = sa;
  return out;
}

function planIdFromScope(s) {
  if (typeof s !== "string" || !s.trim()) return null;
  return s.trim().split(":")[0]?.trim() || null;
}

function mergeTodayReadingDone(a, b) {
  const sa = isPlainObj(a) && typeof a.scopeKey === "string" ? a.scopeKey : null;
  const sb = isPlainObj(b) && typeof b.scopeKey === "string" ? b.scopeKey : null;
  if (sa && sb && sa === sb) return mergeStringSet(a, b, "doneKeys");
  const pa = planIdFromScope(sa), pb = planIdFromScope(sb);
  const readKeys = (v) =>
    isPlainObj(v) && Array.isArray(v.doneKeys) ? v.doneKeys.filter((x) => typeof x === "string" && x) : [];
  if (pa && pb && pa === pb) {
    return {
      version: 1,
      scopeKey: sb ?? sa ?? "",
      doneKeys: [...new Set([...readKeys(a), ...readKeys(b)])].sort(),
    };
  }
  const ka = readKeys(a), kb = readKeys(b);
  return kb.length >= ka.length ? b : a;
}

function mergeFractions(a, b) {
  if (!isPlainObj(a)) return b;
  if (!isPlainObj(b)) return a;
  const sa = typeof a.scopeKey === "string" ? a.scopeKey : null;
  const sb = typeof b.scopeKey === "string" ? b.scopeKey : null;
  const samePlan = sa && sb && (sa === sb || (planIdFromScope(sa) && planIdFromScope(sa) === planIdFromScope(sb)));
  if (sa && sb && sa !== sb && !samePlan) {
    return parseIsoMs(b.updatedAt) >= parseIsoMs(a.updatedAt) ? b : a;
  }
  const fa = isPlainObj(a.fractions) ? a.fractions : {};
  const fb = isPlainObj(b.fractions) ? b.fractions : {};
  const merged = { ...fa };
  for (const [k, v] of Object.entries(fb)) {
    if (typeof v === "number" && Number.isFinite(v)) {
      merged[k] = Math.max(typeof merged[k] === "number" ? merged[k] : 0, v);
    }
  }
  const out = { version: 1, fractions: merged };
  const scope = (sb && sb.trim()) || (sa && sa.trim()) || null;
  if (scope) out.scopeKey = scope;
  return out;
}

function mergeRecentSearches(a, b) {
  const read = (v) => (isPlainObj(v) && Array.isArray(v.terms) ? v.terms.filter((x) => typeof x === "string") : []);
  const seen = new Set();
  const terms = [];
  for (const raw of [...read(b), ...read(a)]) {
    const trimmed = raw.trim().replace(/\s+/g, " ");
    if (!trimmed) continue;
    const lower = trimmed.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);
    terms.push(trimmed);
    if (terms.length >= 10) break;
  }
  return { version: 1, terms };
}

function mergeRecentChapters(a, b) {
  const read = (v) => {
    if (!isPlainObj(v) || !Array.isArray(v.items)) return [];
    const out = [];
    for (const r of v.items) {
      if (!isPlainObj(r) || typeof r.bookId !== "string") continue;
      const bookId = r.bookId.trim().toUpperCase();
      const chapter = typeof r.chapter === "number" ? Math.floor(r.chapter) : 0;
      if (!bookId || chapter <= 0) continue;
      out.push({
        bookId,
        chapter,
        bookName: typeof r.bookName === "string" ? r.bookName : bookId,
        at: typeof r.at === "number" && Number.isFinite(r.at) ? Math.floor(r.at) : 0,
      });
    }
    return out;
  };
  const byKey = new Map();
  for (const item of [...read(a), ...read(b)]) {
    const k = `${item.bookId}:${item.chapter}`;
    const prev = byKey.get(k);
    if (!prev || item.at > prev.at) byKey.set(k, item);
  }
  const items = [...byKey.values()]
    .sort((x, y) => y.at - x.at || (x.bookId < y.bookId ? -1 : 1))
    .slice(0, 12);
  return { version: 1, items };
}

function isUnchosenDefaultPlanPrefs(p) {
  if (p.chosen === true) return false;
  const ahead = typeof p.aheadDays === "number" && Number.isFinite(p.aheadDays) ? Math.max(0, Math.floor(p.aheadDays)) : 0;
  if (ahead > 0) return false;
  if (p.planId === "nt-deep-repeat" && p.anchor === "from-today") {
    return p.ntDeepRepeatPace == null || p.ntDeepRepeatPace === 7;
  }
  if (p.planId !== "triple-loop" || p.anchor !== "calendar-easter") return false;
  if (p.ntDeepRepeatPace != null) return false;
  const started = typeof p.startedOn === "string" ? p.startedOn.trim() : "";
  if (started && started !== "2026-04-05") return false;
  return true;
}

function mergeReadingPlanPrefs(a, b) {
  if (!isPlainObj(a)) return b;
  if (!isPlainObj(b)) return a;
  const readAhead = (p) => (typeof p.aheadDays === "number" && Number.isFinite(p.aheadDays) ? Math.max(0, Math.floor(p.aheadDays)) : 0);
  const withAhead = (p, other) => {
    const same = Boolean(other && other.version === 1 && other.planId === p.planId);
    const ahead = same ? Math.max(readAhead(p), readAhead(other)) : readAhead(p);
    const copy = { ...p };
    if (ahead > 0) copy.aheadDays = ahead;
    else delete copy.aheadDays;
    return copy;
  };
  if (isUnchosenDefaultPlanPrefs(b) && a.planId !== b.planId && a.version === 1) {
    return withAhead(a, b);
  }
  const lc = a.chosen === true, rc = b.chosen === true;
  if (lc !== rc) return withAhead(lc ? a : b, lc ? b : a);
  const ls = parseIsoMs(a.selectedAt), rs = parseIsoMs(b.selectedAt);
  if (a.planId !== b.planId) {
    return ls !== rs ? withAhead(ls > rs ? a : b) : withAhead(a, b);
  }
  const newer = b.version === 1 ? b : a.version === 1 ? a : b;
  const older = newer === b ? a : b;
  const merged = withAhead(newer, older);
  if (merged.anchor === "from-today" && a.planId === b.planId) {
    const cands = [a, b]
      .filter((p) => p.anchor === "from-today" && typeof p.startedOn === "string" && parseIsoMs(p.startedOn) > 0)
      .sort((x, y) => parseIsoMs(x.startedOn) - parseIsoMs(y.startedOn));
    if (cands.length) merged.startedOn = cands[0].startedOn.trim();
  }
  return merged;
}

function mergeTripleLoop(a, b) {
  const la = isPlainObj(a) ? a : {};
  const rb = isPlainObj(b) ? b : {};
  const otSet = new Set(TRIPLE_OT_BOOKS);
  const ntSet = new Set(NT_BOOKS);
  const wisSet = new Set(TRIPLE_WISDOM_BOOKS);
  const keysOt = normalizeChapterKeys([...(la.chaptersReadKeys?.ot || []), ...(rb.chaptersReadKeys?.ot || [])], otSet);
  const keysNt = normalizeChapterKeys([...(la.chaptersReadKeys?.nt || []), ...(rb.chaptersReadKeys?.nt || [])], ntSet);
  const keysWis = normalizeChapterKeys([...(la.chaptersReadKeys?.wisdom || []), ...(rb.chaptersReadKeys?.wisdom || [])], wisSet);
  const pickPtr = (pa, pb, order) => {
    const na = normalizePointer(pa, order), nb = normalizePointer(pb, order);
    return pointerProgress(na, order) >= pointerProgress(nb, order) ? na : nb;
  };
  const sa = typeof la.startedAt === "string" && la.startedAt.trim() ? la.startedAt.trim() : null;
  const sb = typeof rb.startedAt === "string" && rb.startedAt.trim() ? rb.startedAt.trim() : null;
  const startedAt = sa && sb ? (sa <= sb ? sa : sb) : sa || sb;
  return {
    ot: pickPtr(la.ot, rb.ot, TRIPLE_OT_BOOKS),
    nt: pickPtr(la.nt, rb.nt, NT_BOOKS),
    wisdom: pickPtr(la.wisdom, rb.wisdom, TRIPLE_WISDOM_BOOKS),
    chaptersReadKeys: { ot: keysOt, nt: keysNt, wisdom: keysWis },
    chaptersRead: { ot: keysOt.length, nt: keysNt.length, wisdom: keysWis.length },
    ...(startedAt ? { startedAt } : {}),
  };
}

function mergeNtDeepRepeat(a, b) {
  const otSet = new Set(OT_BOOKS);
  const norm = (v) => {
    const o = isPlainObj(v) ? v : {};
    const pace = o.pace === 7 || o.pace === 14 || o.pace === 28 ? o.pace : 7;
    const ci = typeof o.curriculumIndex === "number" && Number.isFinite(o.curriculumIndex) ? Math.max(0, Math.floor(o.curriculumIndex)) : 0;
    const target = typeof o.segmentDayTarget === "number" && o.segmentDayTarget > 0 ? Math.floor(o.segmentDayTarget) : pace;
    const dis = typeof o.dayInSegment === "number" && Number.isFinite(o.dayInSegment)
      ? Math.min(Math.max(1, Math.floor(o.dayInSegment)), target)
      : 1;
    return {
      ot: normalizePointer(o.ot, OT_BOOKS),
      curriculumIndex: ci,
      dayInSegment: dis,
      pace,
      keysOt: normalizeChapterKeys(o.chaptersReadKeys?.ot, otSet),
      keysNt: normalizeChapterKeys(o.chaptersReadKeys?.nt, NT_DEEP_CURRICULUM_BOOKS),
      startedAt: typeof o.startedAt === "string" && o.startedAt.trim() ? o.startedAt.trim() : null,
    };
  };
  const left = norm(a), right = norm(b);
  const prog = (s) => s.curriculumIndex * 1000 + s.dayInSegment;
  const lead = prog(left) >= prog(right) ? left : right;
  const dayInSegment = left.curriculumIndex === right.curriculumIndex
    ? Math.max(left.dayInSegment, right.dayInSegment)
    : lead.dayInSegment;
  const ot = pointerProgress(left.ot, OT_BOOKS) >= pointerProgress(right.ot, OT_BOOKS) ? left.ot : right.ot;
  const mergedOt = normalizeChapterKeys([...left.keysOt, ...right.keysOt], otSet);
  const mergedNt = normalizeChapterKeys([...left.keysNt, ...right.keysNt], NT_DEEP_CURRICULUM_BOOKS);
  const startedAt = left.startedAt && right.startedAt
    ? (left.startedAt <= right.startedAt ? left.startedAt : right.startedAt)
    : left.startedAt || right.startedAt;
  return {
    ot,
    curriculumIndex: lead.curriculumIndex,
    dayInSegment: Math.min(Math.max(1, dayInSegment), lead.pace),
    pace: lead.pace,
    segmentDayTarget: lead.pace,
    chaptersReadKeys: { ot: mergedOt, nt: mergedNt },
    chaptersRead: { ot: mergedOt.length, nt: mergedNt.length },
    ...(startedAt ? { startedAt } : {}),
  };
}

function mergeAchievements(a, b) {
  if (!isPlainObj(a)) return b;
  if (!isPlainObj(b)) return a;
  const int = (v) => (typeof v === "number" && Number.isFinite(v) ? Math.floor(v) : 0);
  const maxInt = (k) => Math.max(int(a[k]), int(b[k]));
  const dates = (k) => {
    const ra = Array.isArray(a[k]) ? a[k].filter((x) => typeof x === "string") : [];
    const rb = Array.isArray(b[k]) ? b[k].filter((x) => typeof x === "string") : [];
    return [...new Set([...ra, ...rb])].sort();
  };
  const earliestMap = (k) => {
    const out = {};
    for (const side of [a, b]) {
      if (!isPlainObj(side[k])) continue;
      for (const [key, v] of Object.entries(side[k])) {
        const at = int(v);
        const cur = out[key];
        out[key] = cur === undefined ? at : at > 0 ? (cur > 0 ? Math.min(cur, at) : at) : cur;
      }
    }
    return out;
  };
  const earned = {};
  for (const side of [a, b]) {
    if (!isPlainObj(side.earned)) continue;
    for (const [key, v] of Object.entries(side.earned)) {
      if (!isPlainObj(v)) continue;
      const tier = int(v.tier);
      if (tier < 1) continue;
      const at = int(v.at);
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

function mergeBlobValue(key, older, newer, nowMs = Date.now()) {
  switch (key) {
    case "bookmarks": return mergeBookmarks(older, newer, nowMs);
    case "highlights": return mergeHighlights(older, newer, nowMs);
    case "chapterCompletion": return mergeStringSet(older, newer, "completed");
    case "todayReadingDone": return mergeTodayReadingDone(older, newer);
    case "habitStats": return mergeStringSet(older, newer, "completedDates");
    case "scriptureListenTotals":
    case "appUsageTime": {
      const sa = isPlainObj(older) && typeof older.totalSec === "number" ? Math.max(0, Math.floor(older.totalSec)) : 0;
      const sb = isPlainObj(newer) && typeof newer.totalSec === "number" ? Math.max(0, Math.floor(newer.totalSec)) : 0;
      return { version: 1, totalSec: Math.max(sa, sb) };
    }
    case "recentChapters": return mergeRecentChapters(older, newer);
    case "todayReadingFraction": return mergeFractions(older, newer);
    case "recentSearches": return mergeRecentSearches(older, newer);
    case "readingPlanPrefs": return mergeReadingPlanPrefs(older, newer);
    case "tripleLoopProgress": return mergeTripleLoop(older, newer);
    case "ntDeepRepeatProgress": return mergeNtDeepRepeat(older, newer);
    case "achievements": return mergeAchievements(older, newer);
    default: return newer;
  }
}

export function mergeSyncBlobs(baseBlobs, incomingBlobs, nowMs = Date.now()) {
  const out = isPlainObj(baseBlobs) ? { ...baseBlobs } : {};
  if (!isPlainObj(incomingBlobs)) return out;
  for (const [key, blob] of Object.entries(incomingBlobs)) {
    if (!VALID_BLOB_KEYS.has(key) || !isPlainObj(blob)) continue;
    if (typeof blob.updatedAt !== "string" || !blob.updatedAt.trim()) continue;
    const prev = out[key];
    if (!isPlainObj(prev)) {
      if (key === "bookmarks") {
        out[key] = { updatedAt: blob.updatedAt, value: mergeBookmarks({}, blob.value, nowMs) };
      } else if (key === "highlights") {
        out[key] = { updatedAt: blob.updatedAt, value: mergeHighlights({}, blob.value, nowMs) };
      } else {
        out[key] = blob;
      }
      continue;
    }
    const leftMs = parseIsoMs(prev.updatedAt);
    const rightMs = parseIsoMs(blob.updatedAt);
    const newer = rightMs >= leftMs ? blob : prev;
    const older = newer === blob ? prev : blob;
    out[key] = {
      updatedAt: new Date(Math.max(leftMs, rightMs) || nowMs).toISOString(),
      value: mergeBlobValue(key, older.value, newer.value, nowMs),
    };
  }
  return out;
}
