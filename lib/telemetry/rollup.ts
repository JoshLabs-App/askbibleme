import "server-only";
import type { TelemetryEventName, TelemetryPlatform } from "@/lib/telemetry/event-catalog";
import type { TelemetryEventProperties } from "@/lib/telemetry/types";

export type RollupIncrement = {
  day: string;
  platform: TelemetryPlatform;
  metric_key: string;
  metric_value: string;
  event_count: number;
  sum_duration_ms: number;
};

function dayKeyFromIso(iso: string): string {
  return iso.slice(0, 10);
}

function rollupMetricForEvent(
  eventName: TelemetryEventName,
  properties: TelemetryEventProperties,
): { metric_key: string; metric_value: string; sum_duration_ms: number } | null {
  switch (eventName) {
    case "screen_view": {
      const screen = properties.screen;
      if (typeof screen !== "string" || !screen) return null;
      return { metric_key: "screen", metric_value: screen, sum_duration_ms: 0 };
    }
    case "tab_select": {
      const tab = properties.tab;
      if (typeof tab !== "string") return null;
      return { metric_key: "tab", metric_value: tab, sum_duration_ms: 0 };
    }
    case "tap": {
      const target = properties.target;
      if (typeof target !== "string") return null;
      return { metric_key: "tap", metric_value: target, sum_duration_ms: 0 };
    }
    case "scene_view": {
      const scene_id = properties.scene_id;
      if (typeof scene_id !== "string") return null;
      return { metric_key: "scene_view", metric_value: scene_id, sum_duration_ms: 0 };
    }
    case "scene_session": {
      const scene_id = properties.scene_id;
      if (typeof scene_id !== "string") return null;
      const duration =
        typeof properties.duration_ms === "number" ? Math.max(0, properties.duration_ms) : 0;
      return { metric_key: "scene_session", metric_value: scene_id, sum_duration_ms: duration };
    }
    case "music_play": {
      const track_id = properties.track_id;
      if (typeof track_id !== "string") return null;
      return { metric_key: "music_play", metric_value: track_id, sum_duration_ms: 0 };
    }
    case "music_session": {
      const track_id = properties.track_id;
      if (typeof track_id !== "string") return null;
      const duration =
        typeof properties.duration_ms === "number" ? Math.max(0, properties.duration_ms) : 0;
      return { metric_key: "music_session", metric_value: track_id, sum_duration_ms: duration };
    }
    default:
      return null;
  }
}

export function buildRollupIncrements(
  platform: TelemetryPlatform,
  events: {
    event_name: TelemetryEventName;
    occurred_at: string;
    properties: TelemetryEventProperties;
  }[],
): RollupIncrement[] {
  const map = new Map<string, RollupIncrement>();

  const bump = (inc: RollupIncrement) => {
    const pk = `${inc.day}|${inc.platform}|${inc.metric_key}|${inc.metric_value}`;
    const prev = map.get(pk);
    if (prev) {
      prev.event_count += inc.event_count;
      prev.sum_duration_ms += inc.sum_duration_ms;
    } else {
      map.set(pk, { ...inc });
    }
  };

  for (const e of events) {
    const day = dayKeyFromIso(e.occurred_at);
    const metric = rollupMetricForEvent(e.event_name, e.properties);
    if (metric) {
      bump({
        day,
        platform,
        metric_key: metric.metric_key,
        metric_value: metric.metric_value,
        event_count: 1,
        sum_duration_ms: metric.sum_duration_ms,
      });
    }
  }

  return [...map.values()];
}

export function uniqueDeviceDays(
  platform: TelemetryPlatform,
  deviceId: string,
  occurredAts: string[],
): { day: string; device_id: string; platform: TelemetryPlatform }[] {
  const days = new Set<string>();
  for (const iso of occurredAts) {
    days.add(dayKeyFromIso(iso));
  }
  return [...days].map((day) => ({ day, device_id: deviceId, platform }));
}
