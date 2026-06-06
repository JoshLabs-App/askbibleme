const STORAGE_KEY = "askbible-nature-home-scene-loop-all-v1";

export function readNatureHomeLoopAllScenesEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const v = localStorage.getItem(STORAGE_KEY)?.trim();
    return v === "1";
  } catch {
    return false;
  }
}

export function writeNatureHomeLoopAllScenesEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? "1" : "0");
  } catch {
    /* quota / private mode */
  }
}
