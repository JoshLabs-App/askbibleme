import "server-only";
import fs from "node:fs";
import type { TelemetryPlatform } from "@/lib/telemetry/event-catalog";
import {
  ensureTelemetryStoreDir,
  isTelemetryWritableDiskAvailable,
  telemetryStoreFilePath,
} from "@/lib/telemetry/disk-path";
import { buildRollupIncrements, uniqueDeviceDays } from "@/lib/telemetry/rollup";
import type { TelemetrySummary } from "@/lib/telemetry/summary-types";
import type { TelemetryIngestBody } from "@/lib/telemetry/types";

const STORE_VERSION = 1 as const;
const MAX_SEEN_EVENT_IDS = 20_000;
const RETENTION_DAYS = 90;

type RollupCell = { event_count: number; sum_duration_ms: number };

type TelemetryDiskStore = {
  v: typeof STORE_VERSION;
  seen_event_ids: string[];
  /** day → device_id → platform */
  daily_devices: Record<string, Record<string, TelemetryPlatform>>;
  /** `${day}\t${platform}\t${metric_key}\t${metric_value}` */
  rollups: Record<string, RollupCell>;
};

function rollupKey(
  day: string,
  platform: TelemetryPlatform,
  metric_key: string,
  metric_value: string,
): string {
  return `${day}\t${platform}\t${metric_key}\t${metric_value}`;
}

function emptyStore(): TelemetryDiskStore {
  return { v: STORE_VERSION, seen_event_ids: [], daily_devices: {}, rollups: {} };
}

function loadStore(file: string): TelemetryDiskStore {
  try {
    if (!fs.existsSync(file)) return emptyStore();
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as TelemetryDiskStore;
    if (raw?.v !== STORE_VERSION || !Array.isArray(raw.seen_event_ids)) return emptyStore();
    return {
      v: STORE_VERSION,
      seen_event_ids: raw.seen_event_ids,
      daily_devices: raw.daily_devices ?? {},
      rollups: raw.rollups ?? {},
    };
  } catch {
    return emptyStore();
  }
}

function saveStore(file: string, store: TelemetryDiskStore): void {
  const tmp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, `${JSON.stringify(store, null, 2)}\n`, "utf8");
  fs.renameSync(tmp, file);
}

function pruneOldDays(store: TelemetryDiskStore): void {
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - RETENTION_DAYS);
  const minDay = cutoff.toISOString().slice(0, 10);

  for (const day of Object.keys(store.daily_devices)) {
    if (day < minDay) delete store.daily_devices[day];
  }
  for (const key of Object.keys(store.rollups)) {
    const day = key.split("\t")[0] ?? "";
    if (day < minDay) delete store.rollups[key];
  }
}

export function ingestTelemetryEventsDisk(
  body: TelemetryIngestBody,
  cwd = process.cwd(),
): { ok: true; accepted: number; skipped: number } | { ok: false; error: string } {
  if (!isTelemetryWritableDiskAvailable(cwd)) {
    return { ok: false, error: "Telemetry disk not writable" };
  }
  const file = ensureTelemetryStoreDir(cwd);
  if (!file) return { ok: false, error: "Telemetry store path unavailable" };

  const store = loadStore(file);
  const seen = new Set(store.seen_event_ids);
  const newEvents = body.events.filter((e) => !seen.has(e.event_id));
  const skipped = body.events.length - newEvents.length;

  if (newEvents.length === 0) {
    return { ok: true, accepted: 0, skipped };
  }

  for (const e of newEvents) {
    seen.add(e.event_id);
  }
  store.seen_event_ids = [...seen];
  if (store.seen_event_ids.length > MAX_SEEN_EVENT_IDS) {
    store.seen_event_ids = store.seen_event_ids.slice(-MAX_SEEN_EVENT_IDS);
  }

  for (const row of uniqueDeviceDays(
    body.platform,
    body.device_id,
    newEvents.map((e) => e.occurred_at),
  )) {
    if (!store.daily_devices[row.day]) store.daily_devices[row.day] = {};
    store.daily_devices[row.day]![row.device_id] = row.platform;
  }

  const increments = buildRollupIncrements(
    body.platform,
    newEvents.map((e) => ({
      event_name: e.event_name,
      occurred_at: e.occurred_at,
      properties: e.properties ?? {},
    })),
  );

  for (const inc of increments) {
    const key = rollupKey(inc.day, inc.platform, inc.metric_key, inc.metric_value);
    const prev = store.rollups[key] ?? { event_count: 0, sum_duration_ms: 0 };
    store.rollups[key] = {
      event_count: prev.event_count + inc.event_count,
      sum_duration_ms: prev.sum_duration_ms + inc.sum_duration_ms,
    };
  }

  pruneOldDays(store);
  saveStore(file, store);

  return { ok: true, accepted: newEvents.length, skipped };
}

function dayStrings(days: number): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i));
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

export function fetchTelemetrySummaryDisk(days = 30, cwd = process.cwd()): TelemetrySummary | null {
  if (!isTelemetryWritableDiskAvailable(cwd)) return null;
  const file = telemetryStoreFilePath(cwd);
  if (!file || !fs.existsSync(file)) {
    return {
      configured: true,
      days,
      storage: "disk",
      dau: dayStrings(days).map((date) => ({ date, count: 0 })),
      topScreens: [],
      topTaps: [],
      topScenes: [],
    };
  }

  const store = loadStore(file);
  const range = dayStrings(days);
  const fromDay = range[0]!;

  const dau = range.map((date) => ({
    date,
    count: Object.keys(store.daily_devices[date] ?? {}).length,
  }));

  const screenMap = new Map<string, number>();
  const tapMap = new Map<string, number>();
  const sceneViewMap = new Map<string, number>();
  const sceneSessionMap = new Map<string, { sessions: number; total_duration_ms: number }>();

  for (const [key, cell] of Object.entries(store.rollups)) {
    const [day, , metric_key, metric_value] = key.split("\t");
    if (!day || day < fromDay) continue;
    const count = cell.event_count;
    const sumDur = cell.sum_duration_ms;

    if (metric_key === "screen") {
      screenMap.set(metric_value!, (screenMap.get(metric_value!) ?? 0) + count);
    } else if (metric_key === "tap") {
      tapMap.set(metric_value!, (tapMap.get(metric_value!) ?? 0) + count);
    } else if (metric_key === "scene_view") {
      sceneViewMap.set(metric_value!, (sceneViewMap.get(metric_value!) ?? 0) + count);
    } else if (metric_key === "scene_session") {
      const prev = sceneSessionMap.get(metric_value!) ?? { sessions: 0, total_duration_ms: 0 };
      sceneSessionMap.set(metric_value!, {
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
    days,
    storage: "disk",
    dau,
    topScreens,
    topTaps,
    topScenes,
  };
}
