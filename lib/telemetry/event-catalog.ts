/** 允许上报的事件名（客户端与服务端白名单须一致） */
export const TELEMETRY_EVENT_NAMES = [
  "session_start",
  "session_end",
  "screen_view",
  "tab_select",
  "tap",
  "scene_view",
  "scene_session",
  "read_chapter_open",
  "music_play",
  "music_session",
] as const;

export type TelemetryEventName = (typeof TELEMETRY_EVENT_NAMES)[number];

export const TELEMETRY_PLATFORMS = ["web", "ios", "android"] as const;
export type TelemetryPlatform = (typeof TELEMETRY_PLATFORMS)[number];

export const TELEMETRY_TAB_VALUES = ["home", "music", "read", "explore"] as const;

/** 首期关心的 tap target（可逐步扩展） */
export const TELEMETRY_TAP_TARGETS = [
  "read.settings",
  "read.search",
  "read.favorites",
  "read.plans",
  "read.catalog",
  "read.chapter.audio",
  "read.chapter.bookmark",
  "read.chapter.copy",
  "read.chapter.info_edition",
  "home.settings",
  "home.scenes",
  "home.relax",
  "shell.menu",
  "music.play",
  "explore.prayer",
] as const;

export type TelemetryTapTarget = (typeof TELEMETRY_TAP_TARGETS)[number];

export const TELEMETRY_QUEUE_KEY = "selah-telemetry-queue-v1";
export const TELEMETRY_DEVICE_KEY = "selah-telemetry-device-v1";
export const TELEMETRY_QUEUE_MAX = 500;
export const TELEMETRY_FLUSH_BATCH_SIZE = 50;
export const TELEMETRY_FLUSH_MIN_QUEUE = 20;
export const TELEMETRY_FLUSH_INTERVAL_MS = 60_000;

const EVENT_NAME_SET = new Set<string>(TELEMETRY_EVENT_NAMES);
const PLATFORM_SET = new Set<string>(TELEMETRY_PLATFORMS);
const TAP_TARGET_SET = new Set<string>(TELEMETRY_TAP_TARGETS);

export function isTelemetryEventName(v: string): v is TelemetryEventName {
  return EVENT_NAME_SET.has(v);
}

export function isTelemetryPlatform(v: string): v is TelemetryPlatform {
  return PLATFORM_SET.has(v);
}

export function isTelemetryTapTarget(v: string): v is TelemetryTapTarget {
  return TAP_TARGET_SET.has(v);
}
