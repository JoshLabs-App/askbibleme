import {
  isTelemetryEventName,
  isTelemetryPlatform,
  isTelemetryTapTarget,
  TELEMETRY_FLUSH_BATCH_SIZE,
  type TelemetryEventName,
  type TelemetryPlatform,
} from "./event-catalog";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type TelemetryEventProperties = Record<string, string | number | boolean>;

export type TelemetryQueuedEvent = {
  event_id: string;
  event_name: TelemetryEventName;
  occurred_at: string;
  properties?: TelemetryEventProperties;
};

export type TelemetryIngestBody = {
  device_id: string;
  platform: TelemetryPlatform;
  app_version?: string | null;
  locale?: string | null;
  events: TelemetryQueuedEvent[];
};

function isUuid(v: unknown): v is string {
  return typeof v === "string" && UUID_RE.test(v);
}

function isIsoDate(v: unknown): boolean {
  if (typeof v !== "string" || !v.trim()) return false;
  const t = Date.parse(v);
  return Number.isFinite(t);
}

function sanitizeProperties(
  eventName: TelemetryEventName,
  raw: unknown,
): TelemetryEventProperties | null {
  if (raw == null) return {};
  if (typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const out: TelemetryEventProperties = {};

  const putStr = (key: string, maxLen: number, required = false): boolean => {
    const v = o[key];
    if (v == null) return !required;
    if (typeof v !== "string") return false;
    const s = v.trim().slice(0, maxLen);
    if (!s) return !required;
    out[key] = s;
    return true;
  };

  const putNum = (key: string, min: number, max: number, required = false): boolean => {
    const v = o[key];
    if (v == null) return !required;
    const n = typeof v === "number" ? v : Number(v);
    if (!Number.isFinite(n)) return false;
    out[key] = Math.min(max, Math.max(min, Math.round(n)));
    return true;
  };

  switch (eventName) {
    case "screen_view": {
      if (!putStr("screen", 64, true)) return null;
      putStr("book_id", 16);
      putNum("chapter", 1, 200);
      break;
    }
    case "tab_select": {
      const tab = o.tab;
      if (typeof tab !== "string" || !["home", "music", "read", "explore"].includes(tab)) return null;
      out.tab = tab;
      break;
    }
    case "tap": {
      const target = o.target;
      if (typeof target !== "string" || !isTelemetryTapTarget(target)) return null;
      out.target = target;
      break;
    }
    case "scene_view":
    case "scene_session": {
      if (!putStr("scene_id", 128, true)) return null;
      if (eventName === "scene_session") putNum("duration_ms", 0, 86_400_000);
      break;
    }
    case "read_chapter_open": {
      if (!putStr("book_id", 16, true)) return null;
      if (!putNum("chapter", 1, 200, true)) return null;
      break;
    }
    case "music_play":
    case "music_session": {
      if (!putStr("track_id", 128, true)) return null;
      if (eventName === "music_session") putNum("duration_ms", 0, 86_400_000);
      break;
    }
    case "session_end": {
      putNum("duration_ms", 0, 86_400_000);
      break;
    }
    case "session_start":
      break;
    default:
      return null;
  }

  return out;
}

export function parseTelemetryIngestBody(raw: unknown): TelemetryIngestBody | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (!isUuid(o.device_id)) return null;
  if (typeof o.platform !== "string" || !isTelemetryPlatform(o.platform)) return null;

  const eventsRaw = o.events;
  if (!Array.isArray(eventsRaw) || eventsRaw.length === 0) return null;
  if (eventsRaw.length > TELEMETRY_FLUSH_BATCH_SIZE) return null;

  const events: TelemetryQueuedEvent[] = [];
  for (const item of eventsRaw) {
    if (!item || typeof item !== "object") return null;
    const e = item as Record<string, unknown>;
    if (!isUuid(e.event_id)) return null;
    if (typeof e.event_name !== "string" || !isTelemetryEventName(e.event_name)) return null;
    if (!isIsoDate(e.occurred_at)) return null;
    const properties = sanitizeProperties(e.event_name, e.properties);
    if (properties === null) return null;
    events.push({
      event_id: e.event_id,
      event_name: e.event_name,
      occurred_at: new Date(e.occurred_at as string).toISOString(),
      properties,
    });
  }

  const app_version =
    typeof o.app_version === "string" ? o.app_version.trim().slice(0, 64) || null : null;
  const locale = typeof o.locale === "string" ? o.locale.trim().slice(0, 16) || null : null;

  return {
    device_id: o.device_id,
    platform: o.platform,
    app_version,
    locale,
    events,
  };
}
