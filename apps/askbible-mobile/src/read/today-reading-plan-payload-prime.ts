import type { TodayReadingPlanPayload } from "./reading-plan/today-reading-plan-payload";

/** 启动 planFlow 前预载今日计划，避免章页异步拉取未完成时无法续章。 */
let primedPayload: TodayReadingPlanPayload | null = null;

export function primeTodayReadingPlanPayload(payload: TodayReadingPlanPayload | null): void {
  primedPayload = payload;
}

export function peekPrimedTodayReadingPlanPayload(): TodayReadingPlanPayload | null {
  return primedPayload;
}

export function clearPrimedTodayReadingPlanPayload(): void {
  primedPayload = null;
}
