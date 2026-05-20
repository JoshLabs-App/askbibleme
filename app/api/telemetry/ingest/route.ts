import { NextResponse } from "next/server";
import { ingestTelemetryEvents } from "@/lib/telemetry/ingest";
import { checkTelemetryRateLimit } from "@/lib/telemetry/rate-limit";
import { parseTelemetryIngestBody } from "@/lib/telemetry/types";

export async function POST(req: Request) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const body = parseTelemetryIngestBody(raw);
  if (!body) {
    return NextResponse.json({ error: "Invalid telemetry payload" }, { status: 400 });
  }

  if (!checkTelemetryRateLimit(body.device_id, body.events.length)) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const result = await ingestTelemetryEvents(body);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    ok: true,
    accepted: result.accepted,
    skipped: result.skipped,
  });
}
