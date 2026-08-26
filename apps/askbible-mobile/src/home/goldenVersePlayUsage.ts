import AsyncStorage from "@react-native-async-storage/async-storage";

const PLAY_MS_KEY = "askbible-golden-verse-play-ms-v1";
const FIRST_OPEN_MS_KEY = "askbible-golden-verse-first-open-ms-v1";

let playMs = 0;
let firstOpenMs = 0;
let hydrated = false;
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((l) => {
    try {
      l();
    } catch {
      /* ignore */
    }
  });
}

export function subscribeGoldenVersePlayUsage(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getGoldenVersePlayMs(): number {
  return playMs;
}

export function getGoldenVerseFirstOpenMs(): number {
  return firstOpenMs;
}

export async function hydrateGoldenVersePlayUsage(): Promise<void> {
  if (hydrated) return;
  try {
    const [playRaw, openRaw] = await Promise.all([
      AsyncStorage.getItem(PLAY_MS_KEY),
      AsyncStorage.getItem(FIRST_OPEN_MS_KEY),
    ]);
    const parsedPlay = Number(playRaw);
    playMs = Number.isFinite(parsedPlay) && parsedPlay > 0 ? Math.floor(parsedPlay) : 0;
    const parsedOpen = Number(openRaw);
    if (Number.isFinite(parsedOpen) && parsedOpen > 0) {
      firstOpenMs = Math.floor(parsedOpen);
    } else {
      firstOpenMs = Date.now();
      await AsyncStorage.setItem(FIRST_OPEN_MS_KEY, String(firstOpenMs));
    }
  } catch {
    playMs = 0;
    firstOpenMs = Date.now();
  }
  hydrated = true;
  emit();
}

/** 金句朗读中累加时长（传入本段实际播放毫秒）。 */
export async function addGoldenVersePlayMs(deltaMs: number): Promise<void> {
  const add = Math.max(0, Math.floor(deltaMs));
  if (add <= 0) return;
  if (!hydrated) await hydrateGoldenVersePlayUsage();
  playMs += add;
  emit();
  try {
    await AsyncStorage.setItem(PLAY_MS_KEY, String(playMs));
  } catch {
    /* keep memory */
  }
}
