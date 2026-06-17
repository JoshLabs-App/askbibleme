import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { NATURE_HOME_PREFS_KEYS, NATURE_HOME_PREFS_LEGACY_KEYS } from "./natureHomePrefsKeys";

/** 压暗 / 模糊：关（不选）+ 四档 极淡 / 微微 / 轻 / 深 */
export type NatureVisualLevel = 0 | 1 | 2 | 3 | 4;

export const NATURE_VISUAL_LEVELS: readonly NatureVisualLevel[] = [0, 1, 2, 3, 4];

/** 设置面板四钮；关=不选中（再点已选档关闭） */
export const NATURE_VISUAL_EFFECT_LEVELS: readonly NatureVisualLevel[] = [1, 2, 3, 4];

/** @deprecated 与 `NatureVisualLevel` 相同，保留旧名 */
export type NatureSoftFocusLevel = NatureVisualLevel;

export const NATURE_SOFT_FOCUS_LEVELS = NATURE_VISUAL_LEVELS;

export type NatureSoftFocusPrefs = {
  overlayOpacity: number;
  blurPx: number;
};

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

export const DEFAULT_SOFT_FOCUS_LEVEL = DEFAULT_DIM_LEVEL;

export const DEFAULT_SOFT_FOCUS: NatureSoftFocusPrefs = mergeNatureVisualPrefs(
  DEFAULT_DIM_LEVEL,
  DEFAULT_BLUR_LEVEL,
);

export function mergeNatureVisualPrefs(
  dimLevel: NatureVisualLevel,
  blurLevel: NatureVisualLevel,
): NatureSoftFocusPrefs {
  return {
    overlayOpacity: DIM_OPACITY[dimLevel],
    blurPx: BLUR_PX[blurLevel],
  };
}

/** 柔焦模糊档位已开：首页背景用场景静帧，不再解码循环视频。 */
export function isNatureSoftFocusBlurEnabled(prefs: NatureSoftFocusPrefs): boolean {
  return prefs.blurPx > 0.02;
}

/**
 * `expo-blur` intensity（0–100）。
 * Android 与设置菜单背板同款（`dimezisBlurView`），比旧映射更重、更接近 CSS `backdrop-filter`。
 */
export function blurIntensityFromPx(blurPx: number): number {
  if (blurPx <= 0) return 0;
  if (Platform.OS === "android") {
    if (blurPx <= 2) return 36;
    if (blurPx <= 4) return 48;
    if (blurPx <= 9) return 68;
    return 96;
  }
  if (blurPx <= 2) return 18;
  if (blurPx <= 4) return 26;
  if (blurPx <= 9) return 40;
  return 76;
}

function clampVisualLevel(n: number): NatureVisualLevel {
  if (n <= 0) return 0;
  if (n >= 4) return 4;
  if (n >= 3) return 3;
  if (n >= 2) return 2;
  return 1;
}

/** 三档时代（v3）存 1–3；插入最弱档后整体 +1，原 3→4。 */
function migrateVisualLevelFromV3(level: number): NatureVisualLevel {
  const n = Math.round(level);
  if (n <= 0) return 0;
  if (n === 1) return 2;
  if (n === 2) return 3;
  if (n === 3) return 4;
  return clampVisualLevel(n);
}

function levelFromLegacyOpacity(opacity: number): NatureVisualLevel {
  if (!Number.isFinite(opacity) || opacity <= 0.04) return 0;
  if (opacity <= 0.12) return 1;
  if (opacity <= 0.24) return 2;
  if (opacity <= 0.44) return 3;
  return 4;
}

function levelFromLegacyBlur(blurPx: number): NatureVisualLevel {
  if (!Number.isFinite(blurPx) || blurPx <= 0) return 0;
  if (blurPx <= 3) return 1;
  if (blurPx <= 6) return 2;
  if (blurPx <= 12) return 3;
  return 4;
}

export type NatureVisualLevels = {
  dimLevel: NatureVisualLevel;
  blurLevel: NatureVisualLevel;
};

export async function readNatureVisualLevels(): Promise<NatureVisualLevels> {
  try {
    const raw =
      (await AsyncStorage.getItem(NATURE_HOME_PREFS_KEYS.softFocus)) ??
      (await AsyncStorage.getItem(NATURE_HOME_PREFS_LEGACY_KEYS.softFocus));
    if (!raw) {
      const defaults = { dimLevel: DEFAULT_DIM_LEVEL, blurLevel: DEFAULT_BLUR_LEVEL };
      await writeNatureVisualLevels(defaults);
      return defaults;
    }
    await AsyncStorage.setItem(NATURE_HOME_PREFS_KEYS.softFocus, raw);
    await AsyncStorage.removeItem(NATURE_HOME_PREFS_LEGACY_KEYS.softFocus);
    const p = JSON.parse(raw) as {
      v?: number;
      level?: number;
      dimLevel?: number;
      blurLevel?: number;
      overlayOpacity?: number;
      blurPx?: number;
    };
    if (p.v === 4) {
      return {
        dimLevel: clampVisualLevel(Math.round(p.dimLevel ?? DEFAULT_DIM_LEVEL)),
        blurLevel: clampVisualLevel(Math.round(p.blurLevel ?? DEFAULT_BLUR_LEVEL)),
      };
    }
    if (p.v === 3) {
      const migrated = {
        dimLevel: migrateVisualLevelFromV3(Math.round(p.dimLevel ?? DEFAULT_DIM_LEVEL)),
        blurLevel: migrateVisualLevelFromV3(Math.round(p.blurLevel ?? DEFAULT_BLUR_LEVEL)),
      };
      await writeNatureVisualLevels(migrated);
      return migrated;
    }
    if (p.v === 2 && typeof p.level === "number") {
      const level = migrateVisualLevelFromV3(Math.round(p.level));
      const migrated = { dimLevel: level, blurLevel: level };
      await writeNatureVisualLevels(migrated);
      return migrated;
    }
    return {
      dimLevel: levelFromLegacyOpacity(Number(p.overlayOpacity)),
      blurLevel: levelFromLegacyBlur(Number(p.blurPx)),
    };
  } catch {
    return { dimLevel: DEFAULT_DIM_LEVEL, blurLevel: DEFAULT_BLUR_LEVEL };
  }
}

export async function writeNatureVisualLevels(levels: NatureVisualLevels): Promise<void> {
  await AsyncStorage.setItem(
    NATURE_HOME_PREFS_KEYS.softFocus,
    JSON.stringify({
      v: 4,
      dimLevel: clampVisualLevel(levels.dimLevel),
      blurLevel: clampVisualLevel(levels.blurLevel),
    }),
  );
  await AsyncStorage.removeItem(NATURE_HOME_PREFS_LEGACY_KEYS.softFocus);
}

export async function readNatureSoftFocusDimLevel(): Promise<NatureVisualLevel> {
  return (await readNatureVisualLevels()).dimLevel;
}

export async function readNatureSoftFocusBlurLevel(): Promise<NatureVisualLevel> {
  return (await readNatureVisualLevels()).blurLevel;
}

export async function writeNatureSoftFocusDimLevel(level: NatureVisualLevel): Promise<void> {
  const cur = await readNatureVisualLevels();
  await writeNatureVisualLevels({ ...cur, dimLevel: clampVisualLevel(level) });
}

export async function writeNatureSoftFocusBlurLevel(level: NatureVisualLevel): Promise<void> {
  const cur = await readNatureVisualLevels();
  await writeNatureVisualLevels({ ...cur, blurLevel: clampVisualLevel(level) });
}

/** @deprecated 同时写入压暗与模糊为同一档 */
export async function writeNatureSoftFocusLevel(level: NatureVisualLevel): Promise<void> {
  const l = clampVisualLevel(level);
  await writeNatureVisualLevels({ dimLevel: l, blurLevel: l });
}

export async function readNatureSoftFocusLevel(): Promise<NatureVisualLevel> {
  return readNatureSoftFocusDimLevel();
}

export async function readNatureSoftFocusPrefs(): Promise<NatureSoftFocusPrefs> {
  const { dimLevel, blurLevel } = await readNatureVisualLevels();
  return mergeNatureVisualPrefs(dimLevel, blurLevel);
}

export async function writeNatureSoftFocusPrefs(p: NatureSoftFocusPrefs): Promise<void> {
  await writeNatureVisualLevels({
    dimLevel: levelFromLegacyOpacity(Number(p.overlayOpacity)),
    blurLevel: levelFromLegacyBlur(Number(p.blurPx)),
  });
}
