import type { MusicVisualAtmospherePresetId } from "./atmosphere";
import { getMusicVisualAtmospherePreset, type MusicVisualAtmospherePreset } from "./atmosphere";

/** 与 `HomeDashboard` / `HomeAtmosphereVisualProvider` 共用 */
export const HOME_ATMOSPHERE_STORAGE_KEY = "selah-home-atmosphere-preset";

/** 首页「经卷 / 晨光 …」氛围 ID（与壳层 localStorage 对齐） */
export type HomeAtmospherePresetId = "parchment" | "dawn" | "dusk" | "mist" | "ember";

export const HOME_ATMOSPHERE_PRESETS: readonly { id: HomeAtmospherePresetId }[] = [
  { id: "parchment" },
  { id: "dawn" },
  { id: "dusk" },
  { id: "mist" },
  { id: "ember" },
];

/** 首页视觉氛围 → 音乐视觉引擎预设（雾速 / 顶光权重 / 微粒密度） */
export const HOME_ATMOSPHERE_TO_MUSIC_VISUAL: Record<HomeAtmospherePresetId, MusicVisualAtmospherePresetId> = {
  parchment: "stillness",
  dawn: "hope",
  dusk: "night",
  mist: "lament",
  ember: "worship",
};

export function isHomeAtmospherePresetId(v: string | null | undefined): v is HomeAtmospherePresetId {
  if (!v) return false;
  return (HOME_ATMOSPHERE_PRESETS as { id: string }[]).some((x) => x.id === v);
}

/** 旧 `?ambient=calm|ember|aurora` → 当前首页氛围 ID（与后台 / WebGL 同源） */
export function legacyAmbientQueryToHomeAtmosphere(
  raw: string | string[] | undefined,
): HomeAtmospherePresetId | null {
  const v = (Array.isArray(raw) ? raw[0] : raw)?.trim().toLowerCase();
  if (v === "calm") return "parchment";
  if (v === "ember") return "ember";
  if (v === "aurora") return "dawn";
  return null;
}

/**
 * 若 URL 含有效 `atmosphere=` 或旧 `ambient=` 则返回对应 ID；否则 null（沿用 localStorage，不强行默认经卷）。
 */
export function parseHomeAtmosphereUrlOverride(params: {
  atmosphere?: string | string[];
  ambient?: string | string[];
}): HomeAtmospherePresetId | null {
  const atm = Array.isArray(params.atmosphere) ? params.atmosphere[0] : params.atmosphere;
  const t = atm?.trim();
  if (t && isHomeAtmospherePresetId(t)) return t;
  return legacyAmbientQueryToHomeAtmosphere(params.ambient);
}

export function getMusicVisualAtmospherePresetForHome(
  homeId: HomeAtmospherePresetId,
): MusicVisualAtmospherePreset {
  const mvId = HOME_ATMOSPHERE_TO_MUSIC_VISUAL[homeId];
  return getMusicVisualAtmospherePreset(mvId);
}
