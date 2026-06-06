const STORAGE_KEY = "askbible-nature-home-ambient-scene-v1";

export function readNatureHomeAmbientSceneSlotId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY)?.trim();
    return raw || null;
  } catch {
    return null;
  }
}

export function writeNatureHomeAmbientSceneSlotId(id: string): void {
  if (typeof window === "undefined") return;
  const next = id.trim();
  try {
    if (!next) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* quota / private mode */
  }
}
