const STORAGE_KEY = "askbible-web-scripture-playback-rate-v1";

export const SCRIPTURE_PLAYBACK_RATES = [0.75, 1, 1.25, 1.5, 1.75, 2] as const;

export function normalizeScripturePlaybackRate(raw: number | null | undefined): number {
  if (!Number.isFinite(raw)) return 1;
  const target = Number(raw);
  let best: (typeof SCRIPTURE_PLAYBACK_RATES)[number] = SCRIPTURE_PLAYBACK_RATES[0];
  let bestDist = Math.abs(target - best);
  for (const rate of SCRIPTURE_PLAYBACK_RATES) {
    const dist = Math.abs(target - rate);
    if (dist < bestDist) {
      best = rate;
      bestDist = dist;
    }
  }
  return best;
}

export function readScripturePlaybackRatePersisted(): number {
  if (typeof window === "undefined") return 1;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw == null) return 1;
    return normalizeScripturePlaybackRate(Number(raw));
  } catch {
    return 1;
  }
}

export function writeScripturePlaybackRatePersisted(rate: number): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, String(normalizeScripturePlaybackRate(rate)));
  } catch {
    /* ignore */
  }
}

export function nextScripturePlaybackRate(current: number): number {
  const normalized = normalizeScripturePlaybackRate(current);
  const idx = SCRIPTURE_PLAYBACK_RATES.indexOf(normalized as (typeof SCRIPTURE_PLAYBACK_RATES)[number]);
  const nextIdx = idx < 0 ? 1 : (idx + 1) % SCRIPTURE_PLAYBACK_RATES.length;
  return SCRIPTURE_PLAYBACK_RATES[nextIdx]!;
}
