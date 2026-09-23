"use client";

/**
 * 成就 / XP 的网页端账本（对应 iOS `Model/AchievementStore.swift`、安卓 `data/AchievementStore.kt`）。
 *
 * 三端同一套口径：只落一份 ledger（读过哪些章、多少节、晨 / 夜日期、已获得的勋章档），
 * 勋章 / 印章 / 等级全部**现算**——云端同步进来新数据，下次评估把漏发的补上。
 *
 * XP 分两半：基础 XP 由 ledger 现算（只增不减）；加成 XP 是连续天数乘区与连读 combo
 * 在动作发生的当下算出来的，必须落盘累加，否则历史 XP 会随倍率变化缩水。
 * 倍率只升不降（Josh 2026-09-18 A 方案）。
 */
import {
  MEDAL_CATALOG,
  MEDAL_XP,
  MedalLevels,
  sealKeyForBookNumber,
  type MedalMetric,
} from "@/lib/achievements/medal-catalog";
import {
  OLD_TESTAMENT_MAX_BOOK_NUMBER,
  scriptureBooks,
} from "@/lib/bible/scripture-books";
import { getScriptureVerseBookmarkStoreSnapshot } from "@/lib/bible/scripture-verse-bookmarks-client";
import { getPlanPlayListenedDates } from "@/lib/read/plan-play-listened-dates-web";
import { computeReadingStreak, readReadingHabitStats } from "@/lib/read/reading-habit-stats";
import { readVerseTextHighlightStore } from "@/lib/read/read-verse-text-highlights";
import { getScriptureListenTotalSec } from "@/lib/read/scripture-listen-totals-web";
import { toLocalDateString } from "@/lib/read/local-date-string";

export const ACHIEVEMENTS_LEDGER_KEY = "askbible-achievements-ledger-v1";
const MONTH_TAG_KEY = "askbible-achievements-month-tag";
const MONTH_ANCHOR_KEY = "askbible-achievements-month-anchor";

export type MedalEarned = { tier: number; at: number };

export type AchievementEvent =
  | { kind: "xp"; amount: number; reason: string }
  | { kind: "chapterRead"; bookId: string; chapter: number }
  | { kind: "seal"; bookId: string }
  | { kind: "medal"; key: string; tier: number }
  | { kind: "levelUp"; level: number }
  /** 连续天数又续上了一天（days ≥ 2 才发，一天只发一次；中断时什么都不发） */
  | { kind: "streak"; days: number };

type Ledger = {
  /** "GEN:1" → 首次读完的时间戳（秒） */
  chaptersRead: Record<string, number>;
  chaptersOpened: number;
  versesRead: number;
  listenTicks: number;
  morningDates: string[];
  nightDates: string[];
  earned: Record<string, MedalEarned>;
  seals: Record<string, number>;
  bonusXP: number;
  comboBookId: string;
  comboCount: number;
  lastOpenDay: string;
  bestStreakDays: number;
  /** 连续天数提示一天只发一次；纯本地 UI 状态，不进会员同步 blob */
  streakNotedDay: string;
  listenChapterKey: string;
  listenChapterTicks: number;
};

function emptyLedger(): Ledger {
  return {
    chaptersRead: {},
    chaptersOpened: 0,
    versesRead: 0,
    listenTicks: 0,
    morningDates: [],
    nightDates: [],
    earned: {},
    seals: {},
    bonusXP: 0,
    comboBookId: "",
    comboCount: 0,
    lastOpenDay: "",
    bestStreakDays: 0,
    streakNotedDay: "",
    listenChapterKey: "",
    listenChapterTicks: 0,
  };
}

export type AchievementSnapshot = {
  totalXP: number;
  level: number;
  levelProgress: number;
  xpInLevel: number;
  xpForLevel: number;
  streakMultiplier: number;
  chaptersReadCount: number;
  earned: Record<string, MedalEarned>;
  seals: Record<string, number>;
};

let ledger: Ledger | null = null;
let snapshot: AchievementSnapshot = {
  totalXP: 0,
  level: 1,
  levelProgress: 0,
  xpInLevel: 0,
  xpForLevel: 1,
  streakMultiplier: 1,
  chaptersReadCount: 0,
  earned: {},
  seals: {},
};
let pending: AchievementEvent[] = [];
let suppressChangeNotify = false;

const listeners = new Set<() => void>();
let onLocalChange: ((key: string) => void) | null = null;

export function setAchievementsLocalChangeHandler(fn: ((key: string) => void) | null): void {
  onLocalChange = fn;
}

export function subscribeAchievements(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emitChange(): void {
  listeners.forEach((l) => {
    try {
      l();
    } catch {
      /* ignore */
    }
  });
}

function num(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function stringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

function parseLedger(raw: string | null): Ledger {
  if (!raw) return emptyLedger();
  try {
    const o = JSON.parse(raw) as Partial<Ledger>;
    return { ...emptyLedger(), ...o };
  } catch {
    return emptyLedger();
  }
}

const BACKFILL_FLAG_KEY = "askbible-achievements-backfilled-v1";
const COMPLETION_KEY = "askbible-read-chapter-completion-v1";
const COMPLETION_KEY_LEGACY = "selah-read-chapter-completion-v1";

/**
 * 一次性回填：网页端在成就系统之前就有「读完章」的记录
 * （`lib/read/read-chapter-completion.ts`），不回填的话老用户一进来成就全空、印章一个不亮。
 * 直接读 localStorage 而不是 import 那个模块——它反过来要调本模块的 noteChapterRead，会成环。
 */
function backfillFromChapterCompletion(next: Ledger): void {
  if (typeof window === "undefined") return;
  try {
    if (localStorage.getItem(BACKFILL_FLAG_KEY)) return;
    localStorage.setItem(BACKFILL_FLAG_KEY, "1");
    const raw = localStorage.getItem(COMPLETION_KEY) ?? localStorage.getItem(COMPLETION_KEY_LEGACY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as { completed?: unknown };
    const completed = Array.isArray(parsed.completed) ? parsed.completed : [];
    const at = Math.floor(Date.now() / 1000);
    for (const entry of completed) {
      if (typeof entry !== "string") continue;
      const parts = entry.split(":");
      if (parts.length !== 2 || !Number.isFinite(Number(parts[1]))) continue;
      const key = `${parts[0].toUpperCase()}:${Number(parts[1])}`;
      if (next.chaptersRead[key] == null) next.chaptersRead[key] = at;
    }
  } catch {
    /* ignore */
  }
}

function state(): Ledger {
  if (!ledger) {
    if (typeof window === "undefined") {
      ledger = emptyLedger();
    } else {
      const next = parseLedger(localStorage.getItem(ACHIEVEMENTS_LEDGER_KEY));
      backfillFromChapterCompletion(next);
      ledger = next;
    }
  }
  return ledger;
}

function persist(): void {
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(ACHIEVEMENTS_LEDGER_KEY, JSON.stringify(state()));
    } catch {
      /* 配额满 / 隐私模式：内存里的账本仍然有效 */
    }
  }
  if (!suppressChangeNotify) onLocalChange?.("achievements");
}

// MARK: 统计口径（勋章判定都走这里）

function readingDays(): number {
  return readReadingHabitStats().completedDates.length;
}

function streakDays(): number {
  const stats = readReadingHabitStats();
  return computeReadingStreak(stats.completedDates, toLocalDateString(new Date()));
}

function listenSeconds(): number {
  return getScriptureListenTotalSec();
}

function favoritesCount(): number {
  return Object.keys(getScriptureVerseBookmarkStoreSnapshot()).length;
}

function highlightsCount(): number {
  return Object.values(readVerseTextHighlightStore()).reduce(
    (sum, list) => sum + (Array.isArray(list) ? list.length : 0),
    0,
  );
}

/** 计划日：网页端以「跟着计划读 / 听完的日期」计数 */
function planDays(): number {
  return getPlanPlayListenedDates().size;
}

function readByBook(): Record<string, Set<number>> {
  const out: Record<string, Set<number>> = {};
  for (const key of Object.keys(state().chaptersRead)) {
    const parts = key.split(":");
    if (parts.length !== 2) continue;
    const ch = Number(parts[1]);
    if (!Number.isFinite(ch)) continue;
    (out[parts[0]] ??= new Set()).add(ch);
  }
  return out;
}

function completedBookIds(): Set<string> {
  const byBook = readByBook();
  const out = new Set<string>();
  for (const book of scriptureBooks) {
    if ((byBook[book.bookId]?.size ?? 0) >= book.chapters) out.add(book.bookId);
  }
  return out;
}

function bookNumbersCompleted(): number[] {
  const ids = completedBookIds();
  return scriptureBooks.filter((b) => ids.has(b.bookId)).map((b) => b.bookNumber);
}

function otBooksCompleted(): number {
  return bookNumbersCompleted().filter((n) => n <= OLD_TESTAMENT_MAX_BOOK_NUMBER).length;
}

function ntBooksCompleted(): number {
  return bookNumbersCompleted().filter((n) => n > OLD_TESTAMENT_MAX_BOOK_NUMBER).length;
}

function shiftDate(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  dt.setDate(dt.getDate() + days);
  return toLocalDateString(dt);
}

/** 完整的一周（周一起算）每天都读经的周数 */
function fullWeeks(): number {
  const dates = new Set(readReadingHabitStats().completedDates);
  if (dates.size === 0) return 0;
  const mondays = new Set<string>();
  for (const date of dates) {
    const [y, m, d] = date.split("-").map(Number);
    const dt = new Date(y, (m || 1) - 1, d || 1);
    // JS 的 getDay()：0 = 周日。周一起算，所以周日要回退 6 天
    const back = (dt.getDay() + 6) % 7;
    mondays.add(shiftDate(date, -back));
  }
  let weeks = 0;
  for (const monday of mondays) {
    let all = true;
    for (let i = 0; i < 7; i += 1) {
      if (!dates.has(shiftDate(monday, i))) {
        all = false;
        break;
      }
    }
    if (all) weeks += 1;
  }
  return weeks;
}

function monthTag(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function rollMonthAnchorIfNeeded(): void {
  if (typeof window === "undefined") return;
  const tag = monthTag(new Date());
  try {
    if (localStorage.getItem(MONTH_TAG_KEY) !== tag) {
      localStorage.setItem(MONTH_TAG_KEY, tag);
      localStorage.setItem(MONTH_ANCHOR_KEY, String(listenSeconds()));
    }
  } catch {
    /* ignore */
  }
}

function listenHoursThisMonth(): number {
  if (typeof window === "undefined") return 0;
  let anchor = 0;
  try {
    anchor = num(localStorage.getItem(MONTH_ANCHOR_KEY));
  } catch {
    anchor = 0;
  }
  return Math.floor(Math.max(0, listenSeconds() - anchor) / 3600);
}

export function metricValue(metric: MedalMetric): number {
  const s = state();
  switch (metric) {
    case "chaptersOpened":
      return s.chaptersOpened;
    case "chaptersRead":
      return Object.keys(s.chaptersRead).length;
    case "readingDays":
      return readingDays();
    case "streakDays":
      return streakDays();
    case "favorites":
      return favoritesCount();
    case "sameBookStreak":
      return s.comboCount;
    case "listenHours":
      return Math.floor(listenSeconds() / 3600);
    case "listenHoursThisMonth":
      return listenHoursThisMonth();
    case "morningDays":
      return s.morningDates.length;
    case "nightDays":
      return s.nightDates.length;
    case "booksCompleted":
      return completedBookIds().size;
    case "otBooksCompleted":
      return otBooksCompleted();
    case "ntBooksCompleted":
      return ntBooksCompleted();
    case "bothTestaments":
      return Math.min(otBooksCompleted(), ntBooksCompleted());
    case "fullWeeks":
      return fullWeeks();
    case "planDays":
      return planDays();
    default:
      return 0;
  }
}

// MARK: XP

/** 连续天数带来的倍率，取「当前」与「历史最长」的较大者——断签后倍率不掉回去 */
function streakMultiplier(): number {
  const days = Math.max(streakDays(), state().bestStreakDays);
  return Math.min(1 + days * MEDAL_XP.streakPerDay, MEDAL_XP.streakCap);
}

/** 基础 XP：完全由 ledger 推出来，只增不减 */
function baseXP(): number {
  const s = state();
  let xp = 0;
  xp += s.versesRead * MEDAL_XP.perVerseRead;
  xp += s.listenTicks * MEDAL_XP.perListenTick;
  xp += Object.keys(s.chaptersRead).length * MEDAL_XP.perChapterRead;
  xp += completedBookIds().size * MEDAL_XP.perBookCompleted;
  xp += readingDays() * MEDAL_XP.perReadingDay;
  xp += favoritesCount() * MEDAL_XP.perFavorite;
  xp += highlightsCount() * MEDAL_XP.perHighlight;
  xp += planDays() * MEDAL_XP.perPlanDay;
  xp += Object.values(s.earned).reduce((sum, e) => sum + e.tier, 0) * MEDAL_XP.perMedalTier;
  xp += Object.keys(s.seals).length * MEDAL_XP.perSeal;
  return xp;
}

/** 把「当下」的加成记进去（倍率高于 1 的那部分才算加成，基础部分已在 baseXP 里） */
function addBonus(base: number): number {
  const bonus = Math.round(base * (streakMultiplier() - 1));
  if (bonus > 0) state().bonusXP += bonus;
  return bonus;
}

function emitEvent(e: AchievementEvent): void {
  const last = pending[pending.length - 1];
  if (e.kind === "xp" && last?.kind === "xp" && last.reason === e.reason) {
    pending[pending.length - 1] = { kind: "xp", amount: last.amount + e.amount, reason: e.reason };
    return;
  }
  pending.push(e);
  if (pending.length > 24) pending = pending.slice(pending.length - 24);
}

// MARK: 上报

/** 打开了某一章 */
export function noteChapterOpened(bookId: string, chapter: number): void {
  void chapter;
  void bookId;
  rollMonthAnchorIfNeeded();
  const s = state();
  s.chaptersOpened += 1;
  const today = toLocalDateString(new Date());
  if (s.lastOpenDay !== today) {
    s.lastOpenDay = today;
    emitEvent({
      kind: "xp",
      amount: MEDAL_XP.firstOpenOfDay + addBonus(MEDAL_XP.firstOpenOfDay),
      reason: "firstOpenOfDay",
    });
  }
  refreshAchievements();
}

/** 读过 n 节经文（滚动经过即算，微反馈） */
export function noteVersesRead(n: number): void {
  if (!Number.isFinite(n) || n <= 0) return;
  const s = state();
  s.versesRead += n;
  const base = n * MEDAL_XP.perVerseRead;
  emitEvent({ kind: "xp", amount: base + addBonus(base), reason: "verses" });
  refreshAchievements();
}

/**
 * 听读又过了一片（播放器每 listenTickSeconds 调一次）。
 * 三重约束（A 方案）：页面在前台、确实在播、同一章最多给 listenTicksPerChapterCap 片。
 * 前台与在播由调用方保证，这里只管每章上限。
 */
export function noteListenTick(bookId: string, chapter: number): void {
  const s = state();
  const key = `${bookId.toUpperCase()}:${chapter}`;
  if (s.listenChapterKey !== key) {
    s.listenChapterKey = key;
    s.listenChapterTicks = 0;
  }
  if (s.listenChapterTicks >= MEDAL_XP.listenTicksPerChapterCap) return;
  s.listenChapterTicks += 1;
  s.listenTicks += 1;
  const base = MEDAL_XP.perListenTick;
  emitEvent({ kind: "xp", amount: base + addBonus(base), reason: "listen" });
  refreshAchievements();
}

/** 读完一章：唯一会点亮书卷印章的入口 */
export function noteChapterRead(bookId: string, chapter: number): void {
  const s = state();
  const id = bookId.toUpperCase();
  const key = `${id}:${chapter}`;
  if (s.chaptersRead[key] != null) return; // 重读不重复给
  s.chaptersRead[key] = Math.floor(Date.now() / 1000);

  // combo：连着读同一卷
  if (s.comboBookId === id) s.comboCount += 1;
  else {
    s.comboBookId = id;
    s.comboCount = 1;
  }
  const combo = s.comboCount >= 2 ? Math.min((s.comboCount - 1) * MEDAL_XP.comboStep, MEDAL_XP.comboCap) : 0;
  if (combo > 0) s.bonusXP += combo;

  const base = MEDAL_XP.perChapterRead;
  emitEvent({ kind: "xp", amount: base + addBonus(base) + combo, reason: "chapter" });
  emitEvent({ kind: "chapterRead", bookId: id, chapter });

  // 晨 / 夜标记
  const now = new Date();
  const hour = now.getHours();
  const today = toLocalDateString(now);
  if (hour >= 5 && hour <= 8 && !s.morningDates.includes(today)) s.morningDates.push(today);
  if ((hour >= 21 || hour < 2) && !s.nightDates.includes(today)) s.nightDates.push(today);

  // 整卷读完 → 点亮印章
  const book = scriptureBooks.find((b) => b.bookId === id);
  if (book && (readByBook()[id]?.size ?? 0) >= book.chapters && s.seals[id] == null) {
    s.seals[id] = Math.floor(Date.now() / 1000);
    emitEvent({ kind: "seal", bookId: id });
    emitEvent({ kind: "xp", amount: MEDAL_XP.perSeal + MEDAL_XP.perBookCompleted, reason: "book" });
  }
  refreshAchievements();
}

// MARK: 评估 + 刷新

/** 重算勋章 / XP / 等级；新达成的档位入队。云端同步进来也调一次，漏发的在这里补上。 */
export function refreshAchievements(): AchievementEvent[] {
  const s = state();
  const beforeLevel = snapshot.level;
  const events: AchievementEvent[] = [];
  for (const def of MEDAL_CATALOG) {
    const v = metricValue(def.metric);
    let top = 0;
    def.tiers.forEach((t, i) => {
      if (v >= t) top = i + 1;
    });
    if (top <= 0) continue;
    const had = s.earned[def.key]?.tier ?? 0;
    if (top > had) {
      s.earned[def.key] = { tier: top, at: Math.floor(Date.now() / 1000) };
      events.push({ kind: "medal", key: def.key, tier: top });
    }
  }
  // 整卷读完但印章还没亮的补上：回填进来的历史、以及云端合并进来的章都走这里
  // （原生只在 noteChapterRead 里点亮，网页端多这一道兜底，口径不变：印章 = 整卷读完）
  for (const bookId of completedBookIds()) {
    if (s.seals[bookId] == null) {
      s.seals[bookId] = Math.floor(Date.now() / 1000);
      events.push({ kind: "seal", bookId });
    }
  }
  const streak = streakDays();
  if (streak > s.bestStreakDays) s.bestStreakDays = streak;
  // 连续天数续上了：一天只提示一次。1 天不算「连续」，所以从 2 起。
  // 中断时故意什么都不发 —— 不用声音惩罚用户（Josh 2026-09-20 定）。
  const streakToday = toLocalDateString(new Date());
  if (streak >= 2 && s.streakNotedDay !== streakToday) {
    s.streakNotedDay = streakToday;
    events.push({ kind: "streak", days: streak });
  }

  const totalXP = baseXP() + s.bonusXP;
  const level = MedalLevels.level(totalXP);
  const xpInLevel = totalXP - MedalLevels.floor(level);
  const xpForLevel = Math.max(1, MedalLevels.ceiling(level) - MedalLevels.floor(level));
  snapshot = {
    totalXP,
    level,
    levelProgress: Math.min(1, Math.max(0, xpInLevel / xpForLevel)),
    xpInLevel,
    xpForLevel,
    streakMultiplier: streakMultiplier(),
    chaptersReadCount: Object.keys(s.chaptersRead).length,
    earned: { ...s.earned },
    seals: { ...s.seals },
  };
  if (level > beforeLevel) events.push({ kind: "levelUp", level });
  events.forEach(emitEvent);
  persist();
  emitChange();
  return events;
}

export function getAchievementSnapshot(): AchievementSnapshot {
  return snapshot;
}

export function getPendingAchievementEvents(): AchievementEvent[] {
  return pending;
}

export function consumeAchievementEvent(): void {
  if (pending.length) {
    pending = pending.slice(1);
    emitChange();
  }
}

/** 印章图的 key（读完整卷才点亮） */
export function sealKeyForBookId(bookId: string): string | null {
  const book = scriptureBooks.find((b) => b.bookId === bookId.toUpperCase());
  return book ? sealKeyForBookNumber(book.bookNumber) : null;
}

// MARK: 会员同步

/** 账本里有没有值得上云的东西（空账本不推，免得覆盖别的设备） */
export function localHasAchievementsProgressWeb(): boolean {
  if (typeof window === "undefined") return false;
  const s = state();
  return (
    Object.keys(s.chaptersRead).length > 0 ||
    Object.keys(s.earned).length > 0 ||
    Object.keys(s.seals).length > 0 ||
    s.versesRead > 0 ||
    s.listenTicks > 0 ||
    s.chaptersOpened > 0 ||
    s.bonusXP > 0 ||
    s.morningDates.length > 0 ||
    s.nightDates.length > 0
  );
}

export function readAchievementsSyncValue(): Record<string, unknown> {
  const s = state();
  return {
    version: 1,
    chaptersRead: s.chaptersRead,
    versesRead: s.versesRead,
    listenTicks: s.listenTicks,
    chaptersOpened: s.chaptersOpened,
    morningDates: s.morningDates,
    nightDates: s.nightDates,
    bonusXP: s.bonusXP,
    bestStreakDays: s.bestStreakDays,
    earned: s.earned,
    seals: s.seals,
  };
}

function normalizeDates(dates: string[]): string[] {
  return Array.from(new Set(dates.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)))).sort();
}

/** 云端并入本机：计数取较大值、集合取并集、勋章取更高档——合并后绝不回退 */
export function mergeRemoteAchievements(value: unknown): void {
  if (!value || typeof value !== "object" || Array.isArray(value)) return;
  const json = value as Record<string, unknown>;
  const s = state();
  suppressChangeNotify = true;

  const remoteChapters = json.chaptersRead;
  if (remoteChapters && typeof remoteChapters === "object" && !Array.isArray(remoteChapters)) {
    for (const [k, v] of Object.entries(remoteChapters as Record<string, unknown>)) {
      const at = num(v);
      const cur = s.chaptersRead[k];
      // 首次点亮时间取更早的那个
      s.chaptersRead[k] = cur != null ? Math.min(cur, at > 0 ? at : cur) : at;
    }
  }
  s.versesRead = Math.max(s.versesRead, num(json.versesRead));
  s.listenTicks = Math.max(s.listenTicks, num(json.listenTicks));
  s.chaptersOpened = Math.max(s.chaptersOpened, num(json.chaptersOpened));
  s.bonusXP = Math.max(s.bonusXP, num(json.bonusXP));
  s.bestStreakDays = Math.max(s.bestStreakDays, num(json.bestStreakDays));
  s.morningDates = normalizeDates([...s.morningDates, ...stringArray(json.morningDates)]);
  s.nightDates = normalizeDates([...s.nightDates, ...stringArray(json.nightDates)]);

  const remoteEarned = json.earned;
  if (remoteEarned && typeof remoteEarned === "object" && !Array.isArray(remoteEarned)) {
    for (const [k, v] of Object.entries(remoteEarned as Record<string, unknown>)) {
      if (!v || typeof v !== "object") continue;
      const tier = num((v as Record<string, unknown>).tier);
      if (tier < 1) continue;
      const cur = s.earned[k];
      if (cur && cur.tier >= tier) continue;
      s.earned[k] = { tier, at: num((v as Record<string, unknown>).at) };
    }
  }
  const remoteSeals = json.seals;
  if (remoteSeals && typeof remoteSeals === "object" && !Array.isArray(remoteSeals)) {
    for (const [k, v] of Object.entries(remoteSeals as Record<string, unknown>)) {
      if (s.seals[k] == null) s.seals[k] = num(v);
    }
  }

  // 与 Swift 版一致：refresh 也在抑制区间内，免得把刚拉下来的云端数据又当本机改动推回去
  try {
    refreshAchievements();
  } finally {
    suppressChangeNotify = false;
  }
}

/** 换帐号 / 退出：成就跟着帐号走，清空本机 */
export function clearAchievementsForAccountSwitch(): void {
  suppressChangeNotify = true;
  ledger = emptyLedger();
  pending = [];
  suppressChangeNotify = false;
  refreshAchievements();
}
