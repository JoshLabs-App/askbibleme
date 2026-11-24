export const ASKBIBLE_SHELL_VIEWPORT_ID = "askbible-shell-viewport";
export const ASKBIBLE_MOBILE_MODEL_CHANGE_EVENT = "askbible:mobile-model-change";

export const PHONE_VIEWPORT_WIDTH = 390;
export const PHONE_VIEWPORT_HEIGHT = 844;
export const PHONE_SHELL_OUTER_WIDTH = 414;
export const PHONE_SHELL_OUTER_HEIGHT = 896;
export const DESKTOP_MODEL_MIN_WIDTH = 769;

export function isMobileModelActive(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.dataset.abMobileModel === "1";
}

export function isEmbeddedPreviewFrame(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export function isDesktopViewportEligible(width?: number): boolean {
  if (typeof window === "undefined") return false;
  if (isEmbeddedPreviewFrame()) return false;
  const w = typeof width === "number" ? width : window.innerWidth;
  return w >= DESKTOP_MODEL_MIN_WIDTH;
}

export function computePhoneFrameScale(
  availWidth: number,
  availHeight: number,
  outerWidth = PHONE_SHELL_OUTER_WIDTH,
  outerHeight = PHONE_SHELL_OUTER_HEIGHT,
): number {
  if (availWidth <= 0 || availHeight <= 0) return 1;
  const ratio = Math.min(1, availWidth / outerWidth, availHeight / outerHeight);
  return Math.max(0.48, Math.round(ratio * 1000) / 1000);
}

export function getEffectiveShellViewportSize(): { width: number; height: number } {
  if (isMobileModelActive()) {
    return { width: PHONE_VIEWPORT_WIDTH, height: PHONE_VIEWPORT_HEIGHT };
  }
  if (typeof window === "undefined") {
    return { width: PHONE_VIEWPORT_WIDTH, height: PHONE_VIEWPORT_HEIGHT };
  }
  return { width: window.innerWidth, height: window.innerHeight };
}

export function getAppShellPortalRoot(): HTMLElement {
  if (typeof document === "undefined") {
    throw new Error("getAppShellPortalRoot called during SSR");
  }
  if (isMobileModelActive()) {
    const el = document.getElementById(ASKBIBLE_SHELL_VIEWPORT_ID);
    if (el) return el;
  }
  return document.body;
}

export function subscribeMobileModelChange(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(ASKBIBLE_MOBILE_MODEL_CHANGE_EVENT, onChange);
  return () => window.removeEventListener(ASKBIBLE_MOBILE_MODEL_CHANGE_EVENT, onChange);
}
