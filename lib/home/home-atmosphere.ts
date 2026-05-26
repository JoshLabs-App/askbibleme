/** 首页「静湖 / 经卷 / 晨光 …」氛围 ID（与历史 localStorage 键一致） */
export type HomeAtmospherePresetId = "lagoon" | "parchment" | "dawn" | "dusk" | "mist" | "ember";

export const HOME_ATMOSPHERE_PRESETS: readonly { id: HomeAtmospherePresetId }[] = [
  { id: "lagoon" },
  { id: "parchment" },
  { id: "dawn" },
  { id: "dusk" },
  { id: "mist" },
  { id: "ember" },
];

export const HOME_ATMOSPHERE_STORAGE_KEY = "askbible-home-atmosphere-preset";
const HOME_ATMOSPHERE_STORAGE_KEY_LEGACY = "selah-home-atmosphere-preset";

export const MUSIC_HOME_ATMOSPHERE_STORAGE_KEY = "askbible-music-home-atmosphere-v1";
const MUSIC_HOME_ATMOSPHERE_STORAGE_KEY_LEGACY = "selah-music-home-atmosphere-v1";

export function isHomeAtmospherePresetId(v: string | null | undefined): v is HomeAtmospherePresetId {
  if (!v) return false;
  return (HOME_ATMOSPHERE_PRESETS as { id: string }[]).some((x) => x.id === v);
}

/** 音乐页：固定静湖（与历史行为一致） */
export function readStoredMusicHomeAtmosphere(): HomeAtmospherePresetId {
  return "lagoon";
}

export function writeStoredMusicHomeAtmosphere(_id: HomeAtmospherePresetId): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MUSIC_HOME_ATMOSPHERE_STORAGE_KEY, "lagoon");
    window.localStorage.removeItem(MUSIC_HOME_ATMOSPHERE_STORAGE_KEY_LEGACY);
  } catch {
    /* ignore */
  }
}

/** 旧 `?ambient=calm|ember|aurora` → 当前首页氛围 ID */
export function legacyAmbientQueryToHomeAtmosphere(
  raw: string | string[] | undefined,
): HomeAtmospherePresetId | null {
  const v = (Array.isArray(raw) ? raw[0] : raw)?.trim().toLowerCase();
  if (v === "calm") return "lagoon";
  if (v === "ember") return "ember";
  if (v === "aurora") return "dawn";
  return null;
}

export function parseHomeAtmosphereUrlOverride(params: {
  atmosphere?: string | string[];
  ambient?: string | string[];
}): HomeAtmospherePresetId | null {
  const atm = Array.isArray(params.atmosphere) ? params.atmosphere[0] : params.atmosphere;
  const t = atm?.trim();
  if (t && isHomeAtmospherePresetId(t)) return t;
  return legacyAmbientQueryToHomeAtmosphere(params.ambient);
}

export function readStoredHomeAtmospherePreset(): HomeAtmospherePresetId {
  if (typeof window === "undefined") return "lagoon";
  try {
    const raw = window.localStorage.getItem(HOME_ATMOSPHERE_STORAGE_KEY);
    if (raw && isHomeAtmospherePresetId(raw)) return raw;
    const legacy = window.localStorage.getItem(HOME_ATMOSPHERE_STORAGE_KEY_LEGACY);
    if (legacy && isHomeAtmospherePresetId(legacy)) {
      window.localStorage.setItem(HOME_ATMOSPHERE_STORAGE_KEY, legacy);
      return legacy;
    }
  } catch {
    /* ignore */
  }
  return "lagoon";
}

export function writeStoredHomeAtmospherePreset(id: HomeAtmospherePresetId): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(HOME_ATMOSPHERE_STORAGE_KEY, id);
    window.localStorage.removeItem(HOME_ATMOSPHERE_STORAGE_KEY_LEGACY);
  } catch {
    /* ignore */
  }
}
