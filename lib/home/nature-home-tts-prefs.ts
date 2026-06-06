export type NatureHomeTtsLevel = 0 | 1 | 2 | 3 | 4;

export type NatureHomeTtsPrefs = {
  rateLevel: NatureHomeTtsLevel;
  pitchLevel: NatureHomeTtsLevel;
  voiceId: string;
};

const STORAGE_KEY = "askbible-nature-home-tts-v1";
const STORAGE_KEY_LEGACY = "selah-nature-home-tts-v1";

export const NATURE_HOME_TTS_PREFS_UPDATED_EVENT = "selah:nature-home-tts-prefs-updated";

type Listener = () => void;
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {
      /* ignore */
    }
  });
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(NATURE_HOME_TTS_PREFS_UPDATED_EVENT));
  }
}

export function subscribeNatureHomeTtsPrefs(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
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

export function readNatureHomeTtsPrefs(): NatureHomeTtsPrefs {
  if (typeof window === "undefined") return DEFAULT_NATURE_HOME_TTS_PREFS;
  try {
    const raw =
      window.localStorage.getItem(STORAGE_KEY) ?? window.localStorage.getItem(STORAGE_KEY_LEGACY);
    if (!raw?.trim()) return DEFAULT_NATURE_HOME_TTS_PREFS;
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

export function writeNatureHomeTtsPrefs(next: NatureHomeTtsPrefs): void {
  if (typeof window === "undefined") return;
  const normalized: NatureHomeTtsPrefs = {
    rateLevel: clampTtsLevel(next.rateLevel),
    pitchLevel: clampTtsLevel(next.pitchLevel),
    voiceId: typeof next.voiceId === "string" ? next.voiceId.trim() : "",
  };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    window.localStorage.removeItem(STORAGE_KEY_LEGACY);
    emit();
  } catch {
    /* ignore */
  }
}
