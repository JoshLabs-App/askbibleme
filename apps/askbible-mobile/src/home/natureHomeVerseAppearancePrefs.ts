import AsyncStorage from "@react-native-async-storage/async-storage";
import { NATURE_HOME_PREFS_KEYS, NATURE_HOME_PREFS_LEGACY_KEYS } from "./natureHomePrefsKeys";

export type NatureHomeVerseTextEffect =
  | "classic"
  | "bold"
  | "barStrip"
  | "flat"
  | "engraved"
  | "insetCarved"
  | "letterpress"
  | "softBloom";

export type NatureHomeVerseAppearance = {
  fontFamily: "sans" | "serif";
  textEffect: NatureHomeVerseTextEffect;
};

/** 设置面板展示顺序 */
export const NATURE_HOME_VERSE_TEXT_EFFECTS: readonly NatureHomeVerseTextEffect[] = [
  "classic",
  "insetCarved",
  "bold",
  "barStrip",
] as const;

export const DEFAULT_VERSE_APPEARANCE: NatureHomeVerseAppearance = {
  fontFamily: "sans",
  /** 默认跟随设置里字效列表首项 */
  textEffect: NATURE_HOME_VERSE_TEXT_EFFECTS[0],
};

/** 与网站 `NATURE_HOME_TEXT_SCALE_STEPS` 同步（默认 index 12 = 1.0） */
export const NATURE_HOME_TEXT_SCALE_STEPS = [
  0.5, 0.54, 0.58, 0.62, 0.66, 0.7, 0.74, 0.78, 0.82, 0.86, 0.91, 0.96, 1, 1.05, 1.1, 1.15, 1.22,
  1.29, 1.36, 1.44, 1.54, 1.64, 1.75, 1.86, 2, 2.12, 2.25, 2.38, 2.55, 2.72, 2.9, 3.1, 3.35, 3.6, 3.65,
  3.7, 3.75, 3.82, 3.89, 3.96, 4.04, 4.14, 4.24, 4.35, 4.46, 4.6, 4.72, 4.85, 4.98, 5.15, 5.32, 5.5,
  5.7, 5.95, 6.2,
] as const;

export const DEFAULT_TEXT_SCALE_INDEX = 12;
/** 一键超大字号（约 200%） */
export const SUPER_LARGE_TEXT_SCALE_INDEX = 24;

function clampStepIndex(n: number): number {
  return Math.min(NATURE_HOME_TEXT_SCALE_STEPS.length - 1, Math.max(0, Math.round(n)));
}

const VERSE_TEXT_EFFECTS = NATURE_HOME_VERSE_TEXT_EFFECTS;

function normalizeVerseTextEffect(raw: unknown): NatureHomeVerseTextEffect {
  if (typeof raw === "string" && (VERSE_TEXT_EFFECTS as readonly string[]).includes(raw)) {
    return raw as NatureHomeVerseTextEffect;
  }
  return DEFAULT_VERSE_APPEARANCE.textEffect;
}

export async function readNatureHomeVerseAppearance(): Promise<NatureHomeVerseAppearance> {
  try {
    const raw =
      (await AsyncStorage.getItem(NATURE_HOME_PREFS_KEYS.verseAppearance)) ??
      (await AsyncStorage.getItem(NATURE_HOME_PREFS_LEGACY_KEYS.verseAppearance));
    if (!raw?.trim()) return DEFAULT_VERSE_APPEARANCE;
    await AsyncStorage.setItem(NATURE_HOME_PREFS_KEYS.verseAppearance, raw);
    await AsyncStorage.removeItem(NATURE_HOME_PREFS_LEGACY_KEYS.verseAppearance);
    const p = JSON.parse(raw) as Partial<NatureHomeVerseAppearance>;
    return {
      fontFamily: p.fontFamily === "serif" ? "serif" : "sans",
      textEffect: normalizeVerseTextEffect(p.textEffect),
    };
  } catch {
    return DEFAULT_VERSE_APPEARANCE;
  }
}

export async function writeNatureHomeVerseAppearance(next: NatureHomeVerseAppearance): Promise<void> {
  const normalized: NatureHomeVerseAppearance = {
    fontFamily: next.fontFamily === "serif" ? "serif" : "sans",
    textEffect: normalizeVerseTextEffect(next.textEffect),
  };
  await AsyncStorage.setItem(NATURE_HOME_PREFS_KEYS.verseAppearance, JSON.stringify(normalized));
  await AsyncStorage.removeItem(NATURE_HOME_PREFS_LEGACY_KEYS.verseAppearance);
}

export async function readNatureHomeTextScaleIndex(): Promise<number> {
  try {
    const raw =
      (await AsyncStorage.getItem(NATURE_HOME_PREFS_KEYS.textScale)) ??
      (await AsyncStorage.getItem(NATURE_HOME_PREFS_LEGACY_KEYS.textScale));
    if (!raw) return DEFAULT_TEXT_SCALE_INDEX;
    await AsyncStorage.setItem(NATURE_HOME_PREFS_KEYS.textScale, raw);
    await AsyncStorage.removeItem(NATURE_HOME_PREFS_LEGACY_KEYS.textScale);
    const p = JSON.parse(raw) as { stepIndex?: number };
    if (typeof p.stepIndex === "number") return clampStepIndex(p.stepIndex);
    return DEFAULT_TEXT_SCALE_INDEX;
  } catch {
    return DEFAULT_TEXT_SCALE_INDEX;
  }
}

export async function writeNatureHomeTextScaleIndex(stepIndex: number): Promise<void> {
  await AsyncStorage.setItem(
    NATURE_HOME_PREFS_KEYS.textScale,
    JSON.stringify({ v: 3, stepIndex: clampStepIndex(stepIndex) }),
  );
  await AsyncStorage.removeItem(NATURE_HOME_PREFS_LEGACY_KEYS.textScale);
}

export function textScaleAtIndex(index: number): number {
  return NATURE_HOME_TEXT_SCALE_STEPS[clampStepIndex(index)] ?? 1;
}
