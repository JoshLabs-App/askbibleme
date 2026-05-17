const DISMISSED_AT_KEY = "selah-pwa-install-dismissed-at";
const INSTALLED_KEY = "selah-pwa-install-completed";

/** 用户点「暂不」后，多少天内不再提示 */
export const PWA_INSTALL_DISMISS_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

export function readInstallDismissedAt(): number | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(DISMISSED_AT_KEY);
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

export function markInstallDismissed(now = Date.now()): void {
  try {
    localStorage.setItem(DISMISSED_AT_KEY, String(now));
  } catch {
    /* ignore */
  }
}

export function isInstallDismissedRecently(now = Date.now()): boolean {
  const at = readInstallDismissedAt();
  if (at == null) return false;
  return now - at < PWA_INSTALL_DISMISS_COOLDOWN_MS;
}

export function readInstallCompleted(): boolean {
  if (typeof localStorage === "undefined") return false;
  try {
    return localStorage.getItem(INSTALLED_KEY) === "1";
  } catch {
    return false;
  }
}

export function markInstallCompleted(): void {
  try {
    localStorage.setItem(INSTALLED_KEY, "1");
  } catch {
    /* ignore */
  }
}
