import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import {
  clampShellChromeTune,
  DEFAULT_SHELL_CHROME_TUNE,
  type ShellChromeTune,
} from "../shell/chromeScrim";

const KEYS = {
  verseAppearance: "askbible-nature-home-verse-appearance-v1",
  textScale: "askbible-nature-home-text-scale-v1",
  softFocus: "askbible-nature-soft-focus-v1",
  chromeTune: "askbible.shell-template-chrome-tune-v1",
  ttsPrefs: "askbible-nature-home-tts-v1",
} as const;

const LEGACY_KEYS = {
  verseAppearance: "selah-nature-home-verse-appearance-v1",
  textScale: "selah-nature-home-text-scale-v1",
  softFocus: "selah-nature-soft-focus-v1",
  chromeTune: "selah.shell-template-chrome-tune-v1",
  ttsPrefs: "selah-nature-home-tts-v1",
} as const;

export type NatureHomeTtsLevel = 0 | 1 | 2 | 3 | 4;

export type NatureHomeTtsPrefs = {
  rateLevel: NatureHomeTtsLevel;
  pitchLevel: NatureHomeTtsLevel;
  voiceId: string;
};

type TtsPrefsListener = () => void;

const ttsPrefsListeners = new Set<TtsPrefsListener>();
let ttsPrefsVersion = 0;

function emitTtsPrefsChange() {
  ttsPrefsVersion += 1;
  ttsPrefsListeners.forEach((listener) => {
    try {
      listener();
    } catch {
      /* ignore listener errors */
    }
  });
}

export const DEFAULT_NATURE_HOME_TTS_PREFS: NatureHomeTtsPrefs = {
  rateLevel: 2,
  pitchLevel: 2,
  voiceId: "",
};

function clampTtsLevel(raw: unknown): NatureHomeTtsLevel {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 2;
  if (n <= 0) return 0;
  if (n >= 4) return 4;
  if (n >= 3) return 3;
  if (n >= 2) return 2;
  if (n >= 1) return 1;
  return 0;
}

export function ttsRateFromLevel(level: NatureHomeTtsLevel): number {
  if (level <= 0) return 0.38;
  if (level === 1) return 0.5;
  if (level === 2) return 0.62;
  if (level === 3) return 0.74;
  return 0.86;
}

export function ttsPitchFromLevel(level: NatureHomeTtsLevel): number {
  if (level <= 0) return 0.45;
  if (level === 1) return 0.68;
  if (level === 2) return 0.9;
  if (level === 3) return 1.2;
  return 1.4;
}

export async function readNatureHomeTtsPrefs(): Promise<NatureHomeTtsPrefs> {
  try {
    const raw =
      (await AsyncStorage.getItem(KEYS.ttsPrefs)) ??
      (await AsyncStorage.getItem(LEGACY_KEYS.ttsPrefs));
    if (!raw?.trim()) return DEFAULT_NATURE_HOME_TTS_PREFS;
    await AsyncStorage.setItem(KEYS.ttsPrefs, raw);
    await AsyncStorage.removeItem(LEGACY_KEYS.ttsPrefs);
    const parsed = JSON.parse(raw) as Partial<NatureHomeTtsPrefs>;
    return {
      rateLevel: clampTtsLevel(parsed.rateLevel),
      pitchLevel: clampTtsLevel(parsed.pitchLevel),
      voiceId: typeof parsed.voiceId === "string" ? parsed.voiceId.trim() : "",
    };
  } catch {
    return DEFAULT_NATURE_HOME_TTS_PREFS;
  }
}

export async function writeNatureHomeTtsPrefs(next: NatureHomeTtsPrefs): Promise<void> {
  const normalized: NatureHomeTtsPrefs = {
    rateLevel: clampTtsLevel(next.rateLevel),
    pitchLevel: clampTtsLevel(next.pitchLevel),
    voiceId: typeof next.voiceId === "string" ? next.voiceId.trim() : "",
  };
  await AsyncStorage.setItem(KEYS.ttsPrefs, JSON.stringify(normalized));
  await AsyncStorage.removeItem(LEGACY_KEYS.ttsPrefs);
  emitTtsPrefsChange();
}

export function subscribeNatureHomeTtsPrefs(listener: TtsPrefsListener): () => void {
  ttsPrefsListeners.add(listener);
  return () => {
    ttsPrefsListeners.delete(listener);
  };
}

export function getNatureHomeTtsPrefsVersion(): number {
  return ttsPrefsVersion;
}

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

/** 压暗 / 模糊各四档：关 / 微微 / 轻 / 重 */
export type NatureVisualLevel = 0 | 1 | 2 | 3;

export const NATURE_VISUAL_LEVELS: readonly NatureVisualLevel[] = [0, 1, 2, 3];

/** @deprecated 与 `NatureVisualLevel` 相同，保留旧名 */
export type NatureSoftFocusLevel = NatureVisualLevel;

export const NATURE_SOFT_FOCUS_LEVELS = NATURE_VISUAL_LEVELS;

export type NatureSoftFocusPrefs = {
  overlayOpacity: number;
  blurPx: number;
};

/** 与 iOS 首页一致：关 / 微微 / 轻 / 重 */
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

/**
 * `expo-blur` intensity（0–100）。
 * Android 与设置菜单背板同款（`dimezisBlurView`），比旧映射更重、更接近 CSS `backdrop-filter`。
 */
export function blurIntensityFromPx(blurPx: number): number {
  if (blurPx <= 0) return 0;
  if (Platform.OS === "android") {
    if (blurPx <= 4) return 48;
    if (blurPx <= 9) return 68;
    return 96;
  }
  if (blurPx <= 4) return 26;
  if (blurPx <= 9) return 40;
  return 76;
}

function clampVisualLevel(n: number): NatureVisualLevel {
  if (n <= 0) return 0;
  if (n >= 3) return 3;
  if (n >= 2) return 2;
  return 1;
}

function levelFromLegacyOpacity(opacity: number): NatureVisualLevel {
  if (!Number.isFinite(opacity) || opacity <= 0.1) return 0;
  if (opacity <= 0.24) return 1;
  if (opacity <= 0.44) return 2;
  return 3;
}

function levelFromLegacyBlur(blurPx: number): NatureVisualLevel {
  if (!Number.isFinite(blurPx) || blurPx <= 0) return 0;
  if (blurPx <= 8) return 1;
  if (blurPx <= 16) return 2;
  return 3;
}

export type NatureVisualLevels = {
  dimLevel: NatureVisualLevel;
  blurLevel: NatureVisualLevel;
};

export async function readNatureVisualLevels(): Promise<NatureVisualLevels> {
  try {
    const raw =
      (await AsyncStorage.getItem(KEYS.softFocus)) ??
      (await AsyncStorage.getItem(LEGACY_KEYS.softFocus));
    if (!raw) {
      const defaults = { dimLevel: DEFAULT_DIM_LEVEL, blurLevel: DEFAULT_BLUR_LEVEL };
      await writeNatureVisualLevels(defaults);
      return defaults;
    }
    await AsyncStorage.setItem(KEYS.softFocus, raw);
    await AsyncStorage.removeItem(LEGACY_KEYS.softFocus);
    const p = JSON.parse(raw) as {
      v?: number;
      level?: number;
      dimLevel?: number;
      blurLevel?: number;
      overlayOpacity?: number;
      blurPx?: number;
    };
    if (p.v === 3) {
      return {
        dimLevel: clampVisualLevel(Math.round(p.dimLevel ?? DEFAULT_DIM_LEVEL)),
        blurLevel: clampVisualLevel(Math.round(p.blurLevel ?? DEFAULT_BLUR_LEVEL)),
      };
    }
    if (p.v === 2 && typeof p.level === "number") {
      const level = clampVisualLevel(Math.round(p.level));
      return { dimLevel: level, blurLevel: level };
    }
    return {
      dimLevel: levelFromLegacyOpacity(Number(p.overlayOpacity)),
      blurLevel: levelFromLegacyBlur(Number(p.blurPx)),
    };
  } catch {
    return { dimLevel: DEFAULT_DIM_LEVEL, blurLevel: DEFAULT_BLUR_LEVEL };
  }
}

async function writeNatureVisualLevels(levels: NatureVisualLevels): Promise<void> {
  await AsyncStorage.setItem(
    KEYS.softFocus,
    JSON.stringify({
      v: 3,
      dimLevel: clampVisualLevel(levels.dimLevel),
      blurLevel: clampVisualLevel(levels.blurLevel),
    }),
  );
  await AsyncStorage.removeItem(LEGACY_KEYS.softFocus);
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
      (await AsyncStorage.getItem(KEYS.verseAppearance)) ??
      (await AsyncStorage.getItem(LEGACY_KEYS.verseAppearance));
    if (!raw?.trim()) return DEFAULT_VERSE_APPEARANCE;
    await AsyncStorage.setItem(KEYS.verseAppearance, raw);
    await AsyncStorage.removeItem(LEGACY_KEYS.verseAppearance);
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
  await AsyncStorage.setItem(KEYS.verseAppearance, JSON.stringify(normalized));
  await AsyncStorage.removeItem(LEGACY_KEYS.verseAppearance);
}

export async function readNatureHomeTextScaleIndex(): Promise<number> {
  try {
    const raw =
      (await AsyncStorage.getItem(KEYS.textScale)) ??
      (await AsyncStorage.getItem(LEGACY_KEYS.textScale));
    if (!raw) return DEFAULT_TEXT_SCALE_INDEX;
    await AsyncStorage.setItem(KEYS.textScale, raw);
    await AsyncStorage.removeItem(LEGACY_KEYS.textScale);
    const p = JSON.parse(raw) as { stepIndex?: number };
    if (typeof p.stepIndex === "number") return clampStepIndex(p.stepIndex);
    return DEFAULT_TEXT_SCALE_INDEX;
  } catch {
    return DEFAULT_TEXT_SCALE_INDEX;
  }
}

export async function writeNatureHomeTextScaleIndex(stepIndex: number): Promise<void> {
  await AsyncStorage.setItem(
    KEYS.textScale,
    JSON.stringify({ v: 3, stepIndex: clampStepIndex(stepIndex) }),
  );
  await AsyncStorage.removeItem(LEGACY_KEYS.textScale);
}

export function textScaleAtIndex(index: number): number {
  return NATURE_HOME_TEXT_SCALE_STEPS[clampStepIndex(index)] ?? 1;
}

export async function readShellChromeTune(): Promise<ShellChromeTune> {
  try {
    const raw =
      (await AsyncStorage.getItem(KEYS.chromeTune)) ??
      (await AsyncStorage.getItem(LEGACY_KEYS.chromeTune));
    if (!raw?.trim()) return DEFAULT_SHELL_CHROME_TUNE;
    await AsyncStorage.setItem(KEYS.chromeTune, raw);
    await AsyncStorage.removeItem(LEGACY_KEYS.chromeTune);
    return clampShellChromeTune({ ...DEFAULT_SHELL_CHROME_TUNE, ...(JSON.parse(raw) as ShellChromeTune) });
  } catch {
    return DEFAULT_SHELL_CHROME_TUNE;
  }
}
