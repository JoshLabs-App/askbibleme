import {
  NATURE_SOFT_FOCUS_DEFAULTS,
  readNatureSoftFocusPrefs,
  writeNatureSoftFocusPrefs,
  type NatureSoftFocusPrefs,
} from "@/lib/nature/nature-soft-focus-prefs";

const STORAGE_KEY = "askbible-nature-visual-levels-v1";
const STORAGE_KEY_LEGACY = "selah-nature-visual-levels-v1";

export type NatureVisualLevel = 0 | 1 | 2 | 3;

export const NATURE_VISUAL_LEVELS: readonly NatureVisualLevel[] = [0, 1, 2, 3];

/** 与 App `natureHomePrefs` `DIM_OPACITY` / `BLUR_PX` 一致 */
const DIM_OPACITY: Record<NatureVisualLevel, number> = {
  0: 0,
  1: 0.16,
  2: 0.32,
  3: 0.82,
};

const BLUR_PX: Record<NatureVisualLevel, number> = {
  0: 0,
  1: 4,
  2: 9,
  3: 15,
};

export const DEFAULT_DIM_LEVEL: NatureVisualLevel = 0;
export const DEFAULT_BLUR_LEVEL: NatureVisualLevel = 0;

export type NatureVisualLevels = {
  dimLevel: NatureVisualLevel;
  blurLevel: NatureVisualLevel;
};

function clampVisualLevel(n: number): NatureVisualLevel {
  const r = Math.round(n);
  if (r <= 0) return 0;
  if (r >= 3) return 3;
  return r as NatureVisualLevel;
}

function levelFromLegacyOpacity(opacity: number): NatureVisualLevel {
  if (opacity <= 0.04) return 0;
  if (opacity <= 0.22) return 1;
  if (opacity <= 0.5) return 2;
  return 3;
}

function levelFromLegacyBlur(blurPx: number): NatureVisualLevel {
  if (blurPx <= 0) return 0;
  if (blurPx <= 5) return 1;
  if (blurPx <= 11) return 2;
  return 3;
}

export function mergeNatureVisualPrefs(
  dimLevel: NatureVisualLevel,
  blurLevel: NatureVisualLevel,
): NatureSoftFocusPrefs {
  return {
    overlayOpacity: DIM_OPACITY[dimLevel],
    blurPx: BLUR_PX[blurLevel],
  };
}

export function readNatureVisualLevels(): NatureVisualLevels {
  const defaults: NatureVisualLevels = {
    dimLevel: DEFAULT_DIM_LEVEL,
    blurLevel: DEFAULT_BLUR_LEVEL,
  };
  if (typeof window === "undefined") {
    return defaults;
  }
  try {
    const raw =
      window.localStorage.getItem(STORAGE_KEY) ??
      window.localStorage.getItem(STORAGE_KEY_LEGACY);
    if (raw?.trim()) {
      const p = JSON.parse(raw) as Partial<{ dimLevel?: number; blurLevel?: number }>;
      return {
        dimLevel: clampVisualLevel(p.dimLevel ?? DEFAULT_DIM_LEVEL),
        blurLevel: clampVisualLevel(p.blurLevel ?? DEFAULT_BLUR_LEVEL),
      };
    }
  } catch {
    /* fall through */
  }
  try {
    const legacyRaw = window.localStorage.getItem("selah-nature-soft-focus-v1");
    if (!legacyRaw?.trim()) return defaults;
    const legacy = readNatureSoftFocusPrefs();
    return {
      dimLevel: levelFromLegacyOpacity(legacy.overlayOpacity),
      blurLevel: levelFromLegacyBlur(legacy.blurPx),
    };
  } catch {
    return defaults;
  }
}

export function writeNatureVisualLevels(levels: NatureVisualLevels): void {
  if (typeof window === "undefined") return;
  const normalized: NatureVisualLevels = {
    dimLevel: clampVisualLevel(levels.dimLevel),
    blurLevel: clampVisualLevel(levels.blurLevel),
  };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    window.localStorage.removeItem(STORAGE_KEY_LEGACY);
    writeNatureSoftFocusPrefs(mergeNatureVisualPrefs(normalized.dimLevel, normalized.blurLevel));
  } catch {
    /* ignore */
  }
}

export function readNatureSoftFocusFromLevels(): NatureSoftFocusPrefs {
  const { dimLevel, blurLevel } = readNatureVisualLevels();
  return mergeNatureVisualPrefs(dimLevel, blurLevel);
}

export function isNatureSoftFocusActive(levels: NatureVisualLevels = readNatureVisualLevels()): boolean {
  return levels.dimLevel > 0 || levels.blurLevel > 0;
}

export { NATURE_SOFT_FOCUS_DEFAULTS };
