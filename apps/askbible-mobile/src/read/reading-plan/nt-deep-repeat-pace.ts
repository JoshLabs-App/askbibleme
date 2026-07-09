import { NT_DEEP_REPEAT_CURRICULUM } from "./nt-deep-repeat-curriculum";
import { toLocalDateString } from "./reading-plan-prefs";

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

/** 首段天数固定为 `pace` 天。 */
export function firstSegmentDayCount(start: Date, pace: NtDeepRepeatPace): number {
  void start;
  return pace;
}

export function firstSegmentEndDate(start: Date, pace: NtDeepRepeatPace): Date {
  return addLocalDays(startOfLocalDay(start), firstSegmentDayCount(start, pace) - 1);
}

/** 后续每段固定 pace 天。 */
export function standardSegmentDayCount(pace: NtDeepRepeatPace): number {
  return pace;
}

export function segmentDayTargetForStage(
  stageIndex: number,
  pace: NtDeepRepeatPace,
  planStartedOn: string,
): number {
  if (stageIndex === 0) {
    void planStartedOn;
    return pace;
  }
  return standardSegmentDayCount(pace);
}

/** 走完一轮新约（52 阶）的总天数。 */
export function ntDeepRepeatOneCycleDays(pace: NtDeepRepeatPace, start = new Date()): number {
  void start;
  return NT_DEEP_REPEAT_STAGE_COUNT * pace;
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
  void start;
  const safeRepeats = Math.max(1, Math.floor(ladderRepeats));
  return safeRepeats * ntDeepRepeatOneCycleDays(pace);
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
export function buildNtDeepRepeatPaceTimeline(selectedPace: NtDeepRepeatPace, start = new Date()) {
  void start;
  const oneCycleDays = ntDeepRepeatOneCycleDays(selectedPace);
  const passRows = NT_DEEP_REPEAT_PACE_OPTIONS.map((depthDays) => ({
    depthDays,
    days: ntDeepRepeatOneCycleDays(depthDays),
  }));
  const otPassApproxYears = oneCycleDays / 365.25;
  return { oneCycleDays, passRows, otPassApproxYears };
}

export function createNtDeepRepeatProgressSeed(pace: NtDeepRepeatPace, now = new Date()) {
  const startedAt = toLocalDateString(now);
  return {
    pace,
    segmentDayTarget: firstSegmentDayCount(now, pace),
    startedAt,
  };
}
