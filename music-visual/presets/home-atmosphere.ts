import type { MusicVisualAtmospherePresetId } from "./atmosphere";
import { getMusicVisualAtmospherePreset, type MusicVisualAtmospherePreset } from "./atmosphere";

/** 首页「静湖 / 经卷 / 晨光 …」氛围 ID（与壳层 localStorage 对齐） */
export type HomeAtmospherePresetId = "lagoon" | "parchment" | "dawn" | "dusk" | "mist" | "ember";

export const HOME_ATMOSPHERE_PRESETS: readonly { id: HomeAtmospherePresetId }[] = [
  { id: "lagoon" },
  { id: "parchment" },
  { id: "dawn" },
  { id: "dusk" },
  { id: "mist" },
  { id: "ember" },
];

export function isHomeAtmospherePresetId(v: string | null | undefined): v is HomeAtmospherePresetId {
  if (!v) return false;
  return (HOME_ATMOSPHERE_PRESETS as { id: string }[]).some((x) => x.id === v);
}

/** 与 `HomeDashboard` / `HomeAtmosphereVisualProvider` 共用 */
export const HOME_ATMOSPHERE_STORAGE_KEY = "selah-home-atmosphere-preset";

/** 音乐页独立默认（静湖）；未写入时与首页氛围存储解耦 */
export const MUSIC_HOME_ATMOSPHERE_STORAGE_KEY = "selah-music-home-atmosphere-v1";

/** 音乐页仅保留「静湖」；忽略历史 localStorage 与其它 ID。 */
export function readStoredMusicHomeAtmosphere(): HomeAtmospherePresetId {
  return "lagoon";
}

export function writeStoredMusicHomeAtmosphere(_id: HomeAtmospherePresetId): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MUSIC_HOME_ATMOSPHERE_STORAGE_KEY, "lagoon");
  } catch {
    /* ignore */
  }
}

/** 首页视觉氛围 → 音乐视觉引擎预设（雾速 / 顶光权重 / 微粒密度） */
export const HOME_ATMOSPHERE_TO_MUSIC_VISUAL: Record<HomeAtmospherePresetId, MusicVisualAtmospherePresetId> = {
  lagoon: "stillness",
  parchment: "stillness",
  dawn: "hope",
  dusk: "night",
  mist: "lament",
  ember: "worship",
};

/** 旧 `?ambient=calm|ember|aurora` → 当前首页氛围 ID（与后台同源） */
export function legacyAmbientQueryToHomeAtmosphere(
  raw: string | string[] | undefined,
): HomeAtmospherePresetId | null {
  const v = (Array.isArray(raw) ? raw[0] : raw)?.trim().toLowerCase();
  if (v === "calm") return "lagoon";
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
