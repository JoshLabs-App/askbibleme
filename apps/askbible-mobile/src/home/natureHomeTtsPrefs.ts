import AsyncStorage from "@react-native-async-storage/async-storage";
import { NATURE_HOME_PREFS_KEYS, NATURE_HOME_PREFS_LEGACY_KEYS } from "./natureHomePrefsKeys";

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
      (await AsyncStorage.getItem(NATURE_HOME_PREFS_KEYS.ttsPrefs)) ??
      (await AsyncStorage.getItem(NATURE_HOME_PREFS_LEGACY_KEYS.ttsPrefs));
    if (!raw?.trim()) return DEFAULT_NATURE_HOME_TTS_PREFS;
    await AsyncStorage.setItem(NATURE_HOME_PREFS_KEYS.ttsPrefs, raw);
    await AsyncStorage.removeItem(NATURE_HOME_PREFS_LEGACY_KEYS.ttsPrefs);
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
  await AsyncStorage.setItem(NATURE_HOME_PREFS_KEYS.ttsPrefs, JSON.stringify(normalized));
  await AsyncStorage.removeItem(NATURE_HOME_PREFS_LEGACY_KEYS.ttsPrefs);
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
