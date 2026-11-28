/**
 * D-47 零弹窗全自动无感更新引擎
 *
 * 铁律：
 * 1. 严禁弹出任何更新提示弹窗或顶部横幅。
 * 2. 切入后台（document.hidden）或桌面窗口失焦闲置满 15 秒且无弹窗/无输入时，自动静默切换。
 * 3. 切换前将当前路由、书卷章号与滚动位置写入 sessionStorage，重载后原地恢复。
 */

import { isNativeShell, platformBridge } from "../bridge/platform-adapter";

const RESTORE_STATE_KEY = "askbible:restore-state:v1";
const DESKTOP_IDLE_SWAP_MS = 15_000;
const POLL_INTERVAL_MS = 30 * 60 * 1000;

export interface RestorableViewState {
  route: string;
  bookId?: string;
  chapter?: number;
  translationId?: string;
  scrollY: number;
  savedAt: number;
}

export interface UpdaterSnapshot {
  bundleId: string;
  builtAt: string;
  pendingBundleId: string | null;
  readyToSwap: boolean;
  lastCheckedAt: string | null;
  checking: boolean;
}

type SnapshotListener = (snapshot: UpdaterSnapshot) => void;

const listeners = new Set<SnapshotListener>();
let state: UpdaterSnapshot = {
  bundleId: platformBridge.getBundleId(),
  builtAt: platformBridge.getBuiltAt(),
  pendingBundleId: null,
  readyToSwap: false,
  lastCheckedAt: null,
  checking: false,
};

let blurIdleTimer: number | null = null;
let started = false;
let currentViewGetter: () => Omit<RestorableViewState, "scrollY" | "savedAt"> = () => ({
  route: typeof window !== "undefined" ? window.location.pathname + window.location.search : "/",
});

function notifyListeners() {
  for (const fn of listeners) {
    try {
      fn({ ...state });
    } catch {
      // Ignore subscriber error
    }
  }
}

export function setCurrentViewSnapshotProvider(
  getter: () => Omit<RestorableViewState, "scrollY" | "savedAt">,
): void {
  currentViewGetter = getter;
}

function isUserTyping(): boolean {
  if (typeof document === "undefined") return false;
  const el = document.activeElement as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return el.isContentEditable;
}

function hasOpenModal(): boolean {
  if (typeof document === "undefined") return false;
  return Boolean(
    document.querySelector('[role="dialog"][aria-modal="true"], [data-modal-open="true"]'),
  );
}

function canSwapSafely(): boolean {
  if (!state.readyToSwap) return false;
  if (isUserTyping()) return false;
  if (hasOpenModal()) return false;
  return true;
}

export function saveViewStateForSwap(): void {
  if (typeof window === "undefined") return;
  try {
    const view = currentViewGetter();
    const payload: RestorableViewState = {
      ...view,
      scrollY: window.scrollY || 0,
      savedAt: Date.now(),
    };
    sessionStorage.setItem(RESTORE_STATE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage quota failure
  }
}

export function consumeRestoredViewState(): RestorableViewState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(RESTORE_STATE_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(RESTORE_STATE_KEY);
    const parsed = JSON.parse(raw) as RestorableViewState;
    if (Date.now() - parsed.savedAt > 120_000) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function executeSilentSwap(): Promise<void> {
  if (!canSwapSafely()) return;
  const pending = state.pendingBundleId ?? undefined;
  state = { ...state, readyToSwap: false };
  notifyListeners();

  saveViewStateForSwap();
  await platformBridge.call("pack.commitSwap", pending ? { bundleId: pending } : undefined);
  window.location.reload();
}

function clearBlurTimer(): void {
  if (blurIdleTimer !== null && typeof window !== "undefined") {
    window.clearTimeout(blurIdleTimer);
    blurIdleTimer = null;
  }
}

function scheduleBlurSwapIfIdle(): void {
  clearBlurTimer();
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (!state.readyToSwap) return;
  if (document.hasFocus()) return;

  blurIdleTimer = window.setTimeout(() => {
    blurIdleTimer = null;
    if (!document.hasFocus() && canSwapSafely()) {
      void executeSilentSwap();
    }
  }, DESKTOP_IDLE_SWAP_MS);
}

export async function manualCheckForUpdate(): Promise<UpdaterSnapshot> {
  state = { ...state, checking: true };
  notifyListeners();
  try {
    const res = await platformBridge.call("pack.checkNow");
    state = {
      ...state,
      checking: false,
      lastCheckedAt: new Date().toISOString(),
      pendingBundleId: res.pendingBundleId ?? state.pendingBundleId,
      readyToSwap: Boolean(res.hasUpdate || res.pendingBundleId),
    };
  } catch {
    state = { ...state, checking: false, lastCheckedAt: new Date().toISOString() };
  }
  notifyListeners();
  return { ...state };
}

export function getUpdaterSnapshot(): UpdaterSnapshot {
  return { ...state };
}

export function subscribeUpdater(listener: SnapshotListener): () => void {
  listeners.add(listener);
  listener({ ...state });
  return () => listeners.delete(listener);
}

export function startSilentUpdater(): () => void {
  if (started || typeof window === "undefined" || typeof document === "undefined") {
    return () => {};
  }
  started = true;

  const offReady = platformBridge.on("pack.readyToSwap", ({ bundleId }) => {
    state = {
      ...state,
      pendingBundleId: bundleId,
      readyToSwap: true,
    };
    notifyListeners();
    if (document.hidden && canSwapSafely()) {
      void executeSilentSwap();
    } else if (!document.hasFocus()) {
      scheduleBlurSwapIfIdle();
    }
  });

  const onVisibilityChange = () => {
    if (document.hidden) {
      if (canSwapSafely()) {
        void executeSilentSwap();
      }
    } else {
      clearBlurTimer();
      void manualCheckForUpdate();
    }
  };

  const onWindowBlur = () => scheduleBlurSwapIfIdle();
  const onWindowFocus = () => clearBlurTimer();

  document.addEventListener("visibilitychange", onVisibilityChange);
  window.addEventListener("blur", onWindowBlur);
  window.addEventListener("focus", onWindowFocus);

  const pollId = window.setInterval(() => {
    void manualCheckForUpdate();
  }, POLL_INTERVAL_MS);

  // Web 环境：监听 SW waiting 状态（原生壳严禁注册 SW）
  if (!isNativeShell() && "serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistration().then((reg) => {
      if (!reg) return;
      if (reg.waiting) {
        state = { ...state, readyToSwap: true, pendingBundleId: state.pendingBundleId ?? "sw-waiting" };
        notifyListeners();
      }
      reg.addEventListener("updatefound", () => {
        const installing = reg.installing;
        if (!installing) return;
        installing.addEventListener("statechange", () => {
          if (installing.state === "installed" && navigator.serviceWorker.controller) {
            state = { ...state, readyToSwap: true, pendingBundleId: state.pendingBundleId ?? "sw-ready" };
            notifyListeners();
            if (document.hidden && canSwapSafely()) {
              void executeSilentSwap();
            } else if (!document.hasFocus()) {
              scheduleBlurSwapIfIdle();
            }
          }
        });
      });
    }).catch(() => {});
  }

  // 启动后延迟 3 秒静默巡检一次
  const bootTimer = window.setTimeout(() => {
    void manualCheckForUpdate();
  }, 3000);

  return () => {
    started = false;
    offReady();
    clearBlurTimer();
    window.clearTimeout(bootTimer);
    window.clearInterval(pollId);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    window.removeEventListener("blur", onWindowBlur);
    window.removeEventListener("focus", onWindowFocus);
  };
}
