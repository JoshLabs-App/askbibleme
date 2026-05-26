const FIRST_OPEN_HINT_KEY = "askbible-first-open-hint-seen";

export function readFirstOpenHintSeen(): boolean {
  if (typeof localStorage === "undefined") return false;
  try {
    return localStorage.getItem(FIRST_OPEN_HINT_KEY) === "1";
  } catch {
    return false;
  }
}

export function markFirstOpenHintSeen(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(FIRST_OPEN_HINT_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function shouldShowFirstOpenHint(): boolean {
  return !readFirstOpenHintSeen();
}
