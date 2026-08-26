import type { MobileLegacyFiguresBundle } from "@/lib/explore/legacy-figures-mobile-bundle-types";

const STORAGE_KEY = "askbible-explore-legacy-figures-bundle-v1";

let memoryBundle: MobileLegacyFiguresBundle | null = null;
let memoryFetchedAt = 0;

export function getCachedLegacyFiguresBundle(): MobileLegacyFiguresBundle | null {
  if (memoryBundle) return memoryBundle;
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { fetchedAt?: number; bundle?: MobileLegacyFiguresBundle };
    if (!parsed.bundle?.bookRows?.length) return null;
    memoryBundle = parsed.bundle;
    memoryFetchedAt = typeof parsed.fetchedAt === "number" ? parsed.fetchedAt : 0;
    return memoryBundle;
  } catch {
    return null;
  }
}

export function getLegacyFiguresBundleFetchedAt(): number {
  return memoryFetchedAt;
}

export function setCachedLegacyFiguresBundle(bundle: MobileLegacyFiguresBundle): void {
  memoryBundle = bundle;
  memoryFetchedAt = Date.now();
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ fetchedAt: memoryFetchedAt, bundle }),
    );
  } catch {
    /* quota */
  }
}
