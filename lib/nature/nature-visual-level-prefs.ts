import {
  NATURE_SOFT_FOCUS_DEFAULTS,
  readNatureSoftFocusPrefs,
  writeNatureSoftFocusPrefs,
  type NatureSoftFocusPrefs,
} from "@/lib/nature/nature-soft-focus-prefs";

const STORAGE_KEY = "askbible-nature-visual-levels-v1";
const STORAGE_KEY_LEGACY = "selah-nature-visual-levels-v1";

/** 压暗 / 模糊：关（不选）+ 四档 极淡 / 微微 / 轻 / 深 */
export type NatureVisualLevel = 0 | 1 | 2 | 3 | 4;

export const NATURE_VISUAL_LEVELS: readonly NatureVisualLevel[] = [0, 1, 2, 3, 4];

/** 设置面板四钮；关=不选中（再点已选档关闭） */
export const NATURE_VISUAL_EFFECT_LEVELS: readonly NatureVisualLevel[] = [1, 2, 3, 4];

/** 与 App `natureHomePrefs` `DIM_OPACITY` / `BLUR_PX` 一致 */
const DIM_OPACITY: Record<NatureVisualLevel, number> = {
  0: 0,
  1: 0.08,
  2: 0.16,
  3: 0.32,
  4: 0.82,
};

const BLUR_PX: Record<NatureVisualLevel, number> = {
  0: 0,
  1: 2,
  2: 4,
  3: 9,
  4: 15,
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
  if (r >= 4) return 4;
  return r as NatureVisualLevel;
}

/** 三档时代存 1–3；插入最弱档后整体 +1，原 3→4。 */
function migrateVisualLevelFromV3(level: number): NatureVisualLevel {
  const n = Math.round(level);
  if (n <= 0) return 0;
  if (n === 1) return 2;
  if (n === 2) return 3;
  if (n === 3) return 4;
  return clampVisualLevel(n);
}

function levelFromLegacyOpacity(opacity: number): NatureVisualLevel {
  if (opacity <= 0.04) return 0;
  if (opacity <= 0.12) return 1;
  if (opacity <= 0.24) return 2;
  if (opacity <= 0.44) return 3;
  return 4;
}

function levelFromLegacyBlur(blurPx: number): NatureVisualLevel {
  if (blurPx <= 0) return 0;
  if (blurPx <= 3) return 1;
  if (blurPx <= 6) return 2;
  if (blurPx <= 12) return 3;
  return 4;
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

type StoredVisualLevels = Partial<{
  v: number;
  dimLevel: number;
  blurLevel: number;
}>;

function parseStoredVisualLevels(p: StoredVisualLevels): NatureVisualLevels {
  if (p.v === 4) {
    return {
      dimLevel: clampVisualLevel(p.dimLevel ?? DEFAULT_DIM_LEVEL),
      blurLevel: clampVisualLevel(p.blurLevel ?? DEFAULT_BLUR_LEVEL),
    };
  }
  return {
    dimLevel: migrateVisualLevelFromV3(p.dimLevel ?? DEFAULT_DIM_LEVEL),
    blurLevel: migrateVisualLevelFromV3(p.blurLevel ?? DEFAULT_BLUR_LEVEL),
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
      const p = JSON.parse(raw) as StoredVisualLevels;
      const levels = parseStoredVisualLevels(p);
      if (p.v !== 4) {
        writeNatureVisualLevels(levels);
      }
      return levels;
    }
  } catch {
    /* fall through */
  }
  try {
    const legacyRaw = window.localStorage.getItem("selah-nature-soft-focus-v1");
    if (!legacyRaw?.trim()) return defaults;
    const legacy = readNatureSoftFocusPrefs();
    const levels = {
      dimLevel: levelFromLegacyOpacity(legacy.overlayOpacity),
      blurLevel: levelFromLegacyBlur(legacy.blurPx),
    };
    writeNatureVisualLevels(levels);
    return levels;
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
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ v: 4, ...normalized }),
    );
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
