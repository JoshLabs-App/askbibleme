import type { ReadingPlanDay } from "@/lib/bible/reading-plans/types";

export type ReadingPlanDayPayload = {
  planId: string;
  name: string;
  dayCount: number;
  dayIndex: number;
  day: ReadingPlanDay | null;
};

export async function fetchReadingPlanDayClient(
  planId: string,
  dayIndex: number,
): Promise<ReadingPlanDayPayload | null> {
  try {
    const res = await fetch(
      `/api/read/reading-plan/${encodeURIComponent(planId)}?dayIndex=${dayIndex}`,
      { cache: "no-store" },
    );
    if (!res.ok) return null;
    return (await res.json()) as ReadingPlanDayPayload;
  } catch {
    return null;
  }
}
