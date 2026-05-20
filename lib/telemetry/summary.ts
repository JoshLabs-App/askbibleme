import "server-only";
import { fetchTelemetrySummaryDisk } from "@/lib/telemetry/disk-store";
import { isTelemetryWritableDiskAvailable, telemetryStorageLabel } from "@/lib/telemetry/disk-path";
import { createSupabaseServiceClient, isSupabaseServiceConfigured } from "@/lib/supabase/service";
import type { TelemetrySummary } from "@/lib/telemetry/summary-types";

export type { TelemetrySummary } from "@/lib/telemetry/summary-types";

function dayStrings(days: number): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i));
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

async function fetchTelemetrySummarySupabase(days: number): Promise<TelemetrySummary | null> {
  if (!isSupabaseServiceConfigured()) return null;

  const supabase = createSupabaseServiceClient();
  if (!supabase) return null;

  const range = dayStrings(days);
  const fromDay = range[0]!;

  const { data: dauRows, error: dauErr } = await supabase
    .from("telemetry_daily_devices")
    .select("day")
    .gte("day", fromDay);

  if (dauErr) {
    return {
      configured: true,
      storage: "supabase",
      days,
      dau: [],
      topScreens: [],
      topTaps: [],
      topScenes: [],
    };
  }

  const dauMap = new Map<string, number>();
  for (const d of range) dauMap.set(d, 0);
  for (const row of dauRows ?? []) {
    const day = String(row.day).slice(0, 10);
    dauMap.set(day, (dauMap.get(day) ?? 0) + 1);
  }

  const dau = range.map((date) => ({ date, count: dauMap.get(date) ?? 0 }));

  const { data: rollupRows } = await supabase
    .from("telemetry_daily_rollups")
    .select("day, metric_key, metric_value, event_count, sum_duration_ms")
    .gte("day", fromDay);

  const screenMap = new Map<string, number>();
  const tapMap = new Map<string, number>();
  const sceneViewMap = new Map<string, number>();
  const sceneSessionMap = new Map<string, { sessions: number; total_duration_ms: number }>();

  for (const row of rollupRows ?? []) {
    const key = row.metric_key as string;
    const value = row.metric_value as string;
    const count = Number(row.event_count) || 0;
    const sumDur = Number(row.sum_duration_ms) || 0;

    if (key === "screen") {
      screenMap.set(value, (screenMap.get(value) ?? 0) + count);
    } else if (key === "tap") {
      tapMap.set(value, (tapMap.get(value) ?? 0) + count);
    } else if (key === "scene_view") {
      sceneViewMap.set(value, (sceneViewMap.get(value) ?? 0) + count);
    } else if (key === "scene_session") {
      const prev = sceneSessionMap.get(value) ?? { sessions: 0, total_duration_ms: 0 };
      sceneSessionMap.set(value, {
        sessions: prev.sessions + count,
        total_duration_ms: prev.total_duration_ms + sumDur,
      });
    }
  }

  const topScreens = [...screenMap.entries()]
    .map(([screen, views]) => ({ screen, views }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 20);

  const topTaps = [...tapMap.entries()]
    .map(([target, count]) => ({ target, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  const sceneIds = new Set([...sceneViewMap.keys(), ...sceneSessionMap.keys()]);
  const topScenes = [...sceneIds]
    .map((scene_id) => {
      const sess = sceneSessionMap.get(scene_id);
      return {
        scene_id,
        views: sceneViewMap.get(scene_id) ?? 0,
        sessions: sess?.sessions ?? 0,
        total_duration_ms: sess?.total_duration_ms ?? 0,
      };
    })
    .sort((a, b) => b.views + b.sessions - (a.views + a.sessions))
    .slice(0, 20);

  return {
    configured: true,
    storage: "supabase",
    days,
    dau,
    topScreens,
    topTaps,
    topScenes,
  };
}

export async function fetchTelemetrySummary(days = 30, cwd = process.cwd()): Promise<TelemetrySummary> {
  const empty: TelemetrySummary = {
    configured: false,
    days,
    dau: [],
    topScreens: [],
    topTaps: [],
    topScenes: [],
  };

  if (isTelemetryWritableDiskAvailable(cwd)) {
    const disk = fetchTelemetrySummaryDisk(days, cwd);
    if (disk) {
      return { ...disk, storageHint: telemetryStorageLabel(cwd) };
    }
  }

  const supa = await fetchTelemetrySummarySupabase(days);
  if (supa) return supa;

  return empty;
}
