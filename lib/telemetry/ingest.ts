import "server-only";
import { ingestTelemetryEventsDisk } from "@/lib/telemetry/disk-store";
import { isTelemetryWritableDiskAvailable } from "@/lib/telemetry/disk-path";
import { createSupabaseServiceClient, isSupabaseServiceConfigured } from "@/lib/supabase/service";
import { buildRollupIncrements, uniqueDeviceDays } from "@/lib/telemetry/rollup";
import type { TelemetryIngestBody } from "@/lib/telemetry/types";

export type TelemetryIngestResult =
  | { ok: true; accepted: number; skipped: number; storage: "disk" | "supabase" }
  | { ok: false; error: string; status: number };

async function ingestTelemetryEventsSupabase(
  body: TelemetryIngestBody,
): Promise<TelemetryIngestResult> {
  if (!isSupabaseServiceConfigured()) {
    return { ok: false, error: "Telemetry storage not configured", status: 503 };
  }

  const supabase = createSupabaseServiceClient();
  if (!supabase) {
    return { ok: false, error: "Telemetry storage unavailable", status: 503 };
  }

  const rows = body.events.map((e) => ({
    event_id: e.event_id,
    device_id: body.device_id,
    platform: body.platform,
    event_name: e.event_name,
    occurred_at: e.occurred_at,
    properties: e.properties ?? {},
    app_version: body.app_version,
    locale: body.locale,
  }));

  const { data: inserted, error: insertErr } = await supabase
    .from("telemetry_events")
    .upsert(rows, { onConflict: "event_id", ignoreDuplicates: true })
    .select("event_id");

  if (insertErr) {
    return { ok: false, error: insertErr.message, status: 500 };
  }

  const accepted = inserted?.length ?? 0;
  const skipped = body.events.length - accepted;

  if (accepted > 0) {
    const acceptedIds = new Set((inserted ?? []).map((r) => r.event_id as string));
    const newEvents = body.events.filter((e) => acceptedIds.has(e.event_id));

    const deviceRows = uniqueDeviceDays(
      body.platform,
      body.device_id,
      newEvents.map((e) => e.occurred_at),
    );
    if (deviceRows.length > 0) {
      await supabase.from("telemetry_daily_devices").upsert(deviceRows, {
        onConflict: "day,device_id",
        ignoreDuplicates: true,
      });
    }

    const rollups = buildRollupIncrements(
      body.platform,
      newEvents.map((e) => ({
        event_name: e.event_name,
        occurred_at: e.occurred_at,
        properties: e.properties ?? {},
      })),
    );

    for (const r of rollups) {
      const { data: existing } = await supabase
        .from("telemetry_daily_rollups")
        .select("event_count, sum_duration_ms")
        .eq("day", r.day)
        .eq("platform", r.platform)
        .eq("metric_key", r.metric_key)
        .eq("metric_value", r.metric_value)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("telemetry_daily_rollups")
          .update({
            event_count: Number(existing.event_count) + r.event_count,
            sum_duration_ms: Number(existing.sum_duration_ms) + r.sum_duration_ms,
          })
          .eq("day", r.day)
          .eq("platform", r.platform)
          .eq("metric_key", r.metric_key)
          .eq("metric_value", r.metric_value);
      } else {
        await supabase.from("telemetry_daily_rollups").insert({
          day: r.day,
          platform: r.platform,
          metric_key: r.metric_key,
          metric_value: r.metric_value,
          event_count: r.event_count,
          sum_duration_ms: r.sum_duration_ms,
        });
      }
    }
  }

  return { ok: true, accepted, skipped, storage: "supabase" };
}

export async function ingestTelemetryEvents(body: TelemetryIngestBody): Promise<TelemetryIngestResult> {
  if (isTelemetryWritableDiskAvailable()) {
    const disk = ingestTelemetryEventsDisk(body);
    if (disk.ok) {
      return { ...disk, storage: "disk" };
    }
    return { ok: false, error: disk.error, status: 500 };
  }

  return ingestTelemetryEventsSupabase(body);
}
