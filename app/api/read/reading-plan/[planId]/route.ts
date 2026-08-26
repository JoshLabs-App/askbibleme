import { NextResponse } from "next/server";
import { buildTripleLoopReadingPlanDay, isTripleLoopPlanId, TRIPLE_LOOP_PLAN_DAY_COUNT } from "@/lib/bible/reading-plans/triple-loop-plan";
import { tripleLoopStateForPlanDay } from "@/lib/bible/reading-plans/triple-loop-reading";
import { getReadingPlanDaySinceEpoch } from "@/lib/read/reading-plan-epoch";
import { readReadingPlanBundleSync } from "@/lib/bible/reading-plans/reading-plans-store";

type Params = { params: Promise<{ planId: string }> };

export async function GET(req: Request, { params }: Params) {
  const { planId: raw } = await params;
  const planId = decodeURIComponent(raw).trim();
  if (!/^[a-zA-Z0-9_-]+$/.test(planId)) {
    return NextResponse.json({ error: "invalid planId" }, { status: 400 });
  }

  const url = new URL(req.url);
  const dayParam = url.searchParams.get("dayIndex");
  const dayIndex = dayParam != null ? Number(dayParam) : NaN;
  if (!Number.isInteger(dayIndex) || dayIndex < 0) {
    return NextResponse.json({ error: "dayIndex required" }, { status: 400 });
  }

  if (isTripleLoopPlanId(planId)) {
    const planDay = getReadingPlanDaySinceEpoch();
    const state = tripleLoopStateForPlanDay(planDay);
    return NextResponse.json({
      planId,
      name: "轻松循环读经计划",
      dayCount: TRIPLE_LOOP_PLAN_DAY_COUNT,
      dayIndex: 0,
      planDay,
      day: buildTripleLoopReadingPlanDay(state),
    });
  }

  const bundle = readReadingPlanBundleSync(process.cwd(), planId);
  if (!bundle) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const day = bundle.days[dayIndex] ?? null;
  return NextResponse.json({
    planId: bundle.planId,
    name: bundle.name,
    dayCount: bundle.days.length,
    dayIndex,
    day,
  });
}
