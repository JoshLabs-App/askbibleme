import { NT_DEEP_REPEAT_CURRICULUM } from "@/lib/bible/reading-plans/nt-deep-repeat-curriculum";
import { toLocalDateString } from "@/lib/read/reading-plan-prefs";

export const NT_DEEP_REPEAT_PACE_OPTIONS = [7, 14, 28] as const;
export type NtDeepRepeatPace = (typeof NT_DEEP_REPEAT_PACE_OPTIONS)[number];

export const NT_DEEP_REPEAT_DEFAULT_PACE: NtDeepRepeatPace = 7;

export const NT_DEEP_REPEAT_STAGE_COUNT = NT_DEEP_REPEAT_CURRICULUM.length;

export function isNtDeepRepeatPace(value: unknown): value is NtDeepRepeatPace {
  return value === 7 || value === 14 || value === 28;
}

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addLocalDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}

/** Mon=0 … Sun=6 */
function mondayBasedDow(d: Date): number {
  return (d.getDay() + 6) % 7;
}

/**
 * 首段天数：从 start（含）到对齐周日的结束日（含）。
 * 周一开局 = 一个完整 pace 块；周中开局延伸到「下周日」，再叠加上额外的 (pace/7 - 1) 整周。
 */
export function firstSegmentDayCount(start: Date, pace: NtDeepRepeatPace): number {
  const s = startOfLocalDay(start);
  const weeks = pace / 7;
  const fromMonday = mondayBasedDow(s);
  const daysToSundayOfStartWeek = 6 - fromMonday;
  const extendToNextSunday = fromMonday > 0 ? 7 : 0;
  const endOffset = daysToSundayOfStartWeek + extendToNextSunday + (weeks - 1) * 7;
  return endOffset + 1;
}

export function firstSegmentEndDate(start: Date, pace: NtDeepRepeatPace): Date {
  return addLocalDays(startOfLocalDay(start), firstSegmentDayCount(start, pace) - 1);
}

/** 后续每段固定 pace 天（周对齐后的完整块）。 */
export function standardSegmentDayCount(pace: NtDeepRepeatPace): number {
  return pace;
}

export function segmentDayTargetForStage(
  stageIndex: number,
  pace: NtDeepRepeatPace,
  planStartedOn: string,
): number {
  if (stageIndex === 0) {
    const start = parseLocalDate(planStartedOn) ?? new Date();
    return firstSegmentDayCount(start, pace);
  }
  return standardSegmentDayCount(pace);
}

function parseLocalDate(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const da = Number(m[3]);
  if (!Number.isFinite(y) || mo < 1 || mo > 12 || da < 1 || da > 31) return null;
  return new Date(y, mo - 1, da);
}

/** 走完一轮新约（52 阶）的总天数。 */
export function ntDeepRepeatOneCycleDays(pace: NtDeepRepeatPace, start = new Date()): number {
  return firstSegmentDayCount(start, pace) + (NT_DEEP_REPEAT_STAGE_COUNT - 1) * pace;
}

/**
 * 同一节奏下连续走完 N 轮 52 阶（少见；一般「N 遍」指每阶连读 N 天的一轮）。
 * @see ntDeepRepeatOneCycleDays
 */
export function ntDeepRepeatDaysForLadderRepeats(
  ladderRepeats: number,
  pace: NtDeepRepeatPace,
  start = new Date(),
): number {
  const safeRepeats = Math.max(1, Math.floor(ladderRepeats));
  const oneCycle = ntDeepRepeatOneCycleDays(pace, start);
  if (safeRepeats === 1) return oneCycle;
  const standardFirst = pace;
  return oneCycle + (safeRepeats - 1) * (standardFirst + (NT_DEEP_REPEAT_STAGE_COUNT - 1) * pace);
}

export function formatApproxDurationZh(days: number): string {
  if (days < 60) return `${days} 天`;
  const months = days / 30.44;
  if (months < 18) return `约 ${Math.round(months)} 个月`;
  const years = days / 365.25;
  return `约 ${years.toFixed(1)} 年`;
}

export function formatApproxDurationEn(days: number): string {
  if (days < 60) return `${days} days`;
  const months = days / 30.44;
  if (months < 18) return `~${Math.round(months)} mo`;
  const years = days / 365.25;
  return `~${years.toFixed(1)} yr`;
}

export type NtDeepRepeatPaceTimelineRow = {
  /** 麦克阿瑟式「N 遍」= 每阶连读 N 天，走完 52 阶为一轮。 */
  depthDays: NtDeepRepeatPace;
  days: number;
};

/** 对比三种深度（7 / 14 / 28 天每阶）各走完一轮新约（52 阶）的天数。 */
export function buildNtDeepRepeatPaceTimeline(
  selectedPace: NtDeepRepeatPace,
  start = new Date(),
): {
  oneCycleDays: number;
  passRows: NtDeepRepeatPaceTimelineRow[];
  otPassApproxYears: number;
} {
  const oneCycleDays = ntDeepRepeatOneCycleDays(selectedPace, start);
  const passRows = NT_DEEP_REPEAT_PACE_OPTIONS.map((depthDays) => ({
    depthDays,
    days: ntDeepRepeatOneCycleDays(depthDays, start),
  }));
  const otPassApproxYears = oneCycleDays / 365.25;
  return { oneCycleDays, passRows, otPassApproxYears };
}

export function createNtDeepRepeatProgressSeed(
  pace: NtDeepRepeatPace,
  now = new Date(),
): {
  pace: NtDeepRepeatPace;
  segmentDayTarget: number;
  startedAt: string;
} {
  const startedAt = toLocalDateString(now);
  return {
    pace,
    segmentDayTarget: firstSegmentDayCount(now, pace),
    startedAt,
  };
}
