import { loadBundledReadingPlanDay } from "./bundled-reading-plans";
import type { ReadingPlanDay } from "./types";

export type ReadingPlanDayPayload = {
  planId: string;
  name: string;
  dayCount: number;
  dayIndex: number;
  day: ReadingPlanDay | null;
};

/** 某日章节仅读打包数据；三轨循环由 {@link buildTripleLoopDayPayload} 按本机进度生成。 */
export async function fetchReadingPlanDay(
  planId: string,
  dayIndex: number,
): Promise<ReadingPlanDayPayload | null> {
  return loadBundledReadingPlanDay(planId, dayIndex);
}
