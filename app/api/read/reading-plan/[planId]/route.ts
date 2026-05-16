import { NextResponse } from "next/server";
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
