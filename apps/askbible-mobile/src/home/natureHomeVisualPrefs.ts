import AsyncStorage from "@react-native-async-storage/async-storage";
import { NATURE_HOME_PREFS_KEYS, NATURE_HOME_PREFS_LEGACY_KEYS } from "./natureHomePrefsKeys";

/** 账号同步仍带压暗 / 模糊档；首页已改预烘焙柔焦，不再读取这两档做运行时效果。 */
export type NatureVisualLevel = 0 | 1 | 2 | 3 | 4;

export const DEFAULT_DIM_LEVEL: NatureVisualLevel = 0;
export const DEFAULT_BLUR_LEVEL: NatureVisualLevel = 0;

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
