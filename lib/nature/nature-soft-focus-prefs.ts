const STORAGE_KEY = "selah-nature-soft-focus-v1";

export type NatureSoftFocusPrefs = {
  overlayOpacity: number;
  blurPx: number;
};

export const NATURE_SOFT_FOCUS_DEFAULTS: NatureSoftFocusPrefs = {
  overlayOpacity: 0.5,
  blurPx: 24,
};

const OVERLAY_MIN = 0.08;
const OVERLAY_MAX = 0.82;
const BLUR_MIN = 2;
const BLUR_MAX = 48;

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function normalize(p: Partial<NatureSoftFocusPrefs> | null | undefined): NatureSoftFocusPrefs {
  const o =
    typeof p?.overlayOpacity === "number" && Number.isFinite(p.overlayOpacity)
      ? p.overlayOpacity
      : NATURE_SOFT_FOCUS_DEFAULTS.overlayOpacity;
  const b =
    typeof p?.blurPx === "number" && Number.isFinite(p.blurPx) ? p.blurPx : NATURE_SOFT_FOCUS_DEFAULTS.blurPx;
  return {
    overlayOpacity: clamp(o, OVERLAY_MIN, OVERLAY_MAX),
    blurPx: clamp(Math.round(b), BLUR_MIN, BLUR_MAX),
  };
}

export function readNatureSoftFocusPrefs(): NatureSoftFocusPrefs {
  if (typeof window === "undefined") return NATURE_SOFT_FOCUS_DEFAULTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return NATURE_SOFT_FOCUS_DEFAULTS;
    return normalize(JSON.parse(raw) as Partial<NatureSoftFocusPrefs>);
  } catch {
    return NATURE_SOFT_FOCUS_DEFAULTS;
  }
}

export function writeNatureSoftFocusPrefs(p: NatureSoftFocusPrefs): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalize(p)));
  } catch {
    // ignore quota / private mode
  }
}
