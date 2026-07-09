const APP_IMMERSIVE_STORAGE_KEY = "askbible-ui-immersive-v1";

const listeners = new Set<() => void>();

function emitAppImmersiveChange() {
  for (const listener of listeners) {
    try {
      listener();
    } catch {
      /* ignore */
    }
  }
}

export function readAppImmersiveFromStorage(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(APP_IMMERSIVE_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function subscribeAppImmersive(onStore: () => void) {
  if (typeof window === "undefined") return () => {};
  listeners.add(onStore);
  const onStorage = (e: StorageEvent) => {
    if (e.key === APP_IMMERSIVE_STORAGE_KEY || e.key === null) onStore();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onStore);
    window.removeEventListener("storage", onStorage);
  };
}

export function writeAppImmersiveToStorage(next: boolean): void {
  try {
    if (next) window.localStorage.setItem(APP_IMMERSIVE_STORAGE_KEY, "1");
    else window.localStorage.removeItem(APP_IMMERSIVE_STORAGE_KEY);
  } catch {
    /* ignore */
  }
  emitAppImmersiveChange();
}

