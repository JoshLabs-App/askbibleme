import { NextResponse } from "next/server";
import { isStudioDiskSaveAllowed } from "@/lib/studio-disk-save";
import { fetchTelemetrySummary } from "@/lib/telemetry/summary";

function disk403() {
  return NextResponse.json(
    {
      error:
        "未允许访问：开发环境默认可用；生产请设置 STUDIO_ALLOW_DISK_SAVE=1、STUDIO_WRITE_SECRET，并携带 Authorization: Bearer …",
    },
    { status: 403 },
  );
}

export async function GET(req: Request) {
  if (!isStudioDiskSaveAllowed(req)) return disk403();

  const url = new URL(req.url);
  const daysRaw = Number(url.searchParams.get("days") ?? "30");
  const days = Number.isFinite(daysRaw) ? Math.min(90, Math.max(7, Math.round(daysRaw))) : 30;

  const summary = await fetchTelemetrySummary(days);
  return NextResponse.json(summary, {
    headers: { "Cache-Control": "no-store, must-revalidate" },
  });
}
