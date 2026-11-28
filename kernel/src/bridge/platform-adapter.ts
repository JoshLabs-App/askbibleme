import type {
  AskBibleBridge,
  AskBibleBridgeEventMap,
  BridgeEventName,
  BridgeMethodName,
  AskBibleBridgeMethodMap,
  PlatformKind,
} from "./contracts";
import { createBibleRepo } from "./bible-repo";
import { createWebFallbackBridge } from "./web-fallback";

declare const __ASKBIBLE_BUNDLE_ID__: string;
declare const __ASKBIBLE_BUILT_AT__: string;

const CURRENT_BUNDLE_ID =
  typeof __ASKBIBLE_BUNDLE_ID__ === "string" ? __ASKBIBLE_BUNDLE_ID__ : "dev-local";
const CURRENT_BUILT_AT =
  typeof __ASKBIBLE_BUILT_AT__ === "string" ? __ASKBIBLE_BUILT_AT__ : new Date().toISOString();

type Listener<E extends BridgeEventName> = (payload: AskBibleBridgeEventMap[E]) => void;

const eventListeners = new Map<BridgeEventName, Set<Listener<BridgeEventName>>>();
const pendingCalls = new Map<
  string,
  { resolve: (value: unknown) => void; reject: (err: Error) => void }
>();

let callSeq = 0;

function emitBridgeEvent<E extends BridgeEventName>(
  event: E,
  payload: AskBibleBridgeEventMap[E],
): void {
  const set = eventListeners.get(event);
  if (!set) return;
  for (const fn of set) {
    try {
      (fn as Listener<E>)(payload);
    } catch {
      // Never break bridge event loop
    }
  }
}

if (typeof window !== "undefined") {
  window.__askbibleEmit = emitBridgeEvent;
  window.__askbibleResolve = (id: string, ok: boolean, dataOrError: unknown) => {
    const pending = pendingCalls.get(id);
    if (!pending) return;
    pendingCalls.delete(id);
    if (ok) {
      pending.resolve(dataOrError);
    } else {
      pending.reject(new Error(typeof dataOrError === "string" ? dataOrError : "Native bridge error"));
    }
  };
}

export function detectPlatform(): PlatformKind {
  if (typeof window === "undefined") return "web";
  if (window.AskBibleBridge?.platform === "ios" || window.AskBibleBridge?.platform === "android") {
    return window.AskBibleBridge.platform;
  }
  if (window.webkit?.messageHandlers?.askbible) return "ios";
  if (window.AskBibleNative) return "android";
  if (window.AskBibleBridge) {
    const ua = navigator.userAgent.toLowerCase();
    return ua.includes("iphone") || ua.includes("ipad") ? "ios" : "android";
  }
  return "web";
}

export function isNativeShell(): boolean {
  return detectPlatform() !== "web";
}

function createNativeBridgeAdapter(): AskBibleBridge | null {
  if (typeof window === "undefined") return null;
  if (window.AskBibleBridge) return window.AskBibleBridge;

  if (window.webkit?.messageHandlers?.askbible) {
    return {
      call(method, ...rest) {
        const id = `ab_${++callSeq}_${Date.now()}`;
        return new Promise((resolve, reject) => {
          pendingCalls.set(id, {
            resolve: resolve as (v: unknown) => void,
            reject,
          });
          window.webkit!.messageHandlers!.askbible!.postMessage({
            id,
            method,
            args: rest[0] ?? {},
          });
        });
      },
    };
  }

  if (window.AskBibleNative) {
    return {
      async call(method, ...rest) {
        const raw = await window.AskBibleNative!.call(method, JSON.stringify(rest[0] ?? {}));
        return typeof raw === "string" ? JSON.parse(raw) : raw;
      },
    };
  }

  return null;
}

const webFallback = createWebFallbackBridge(emitBridgeEvent, CURRENT_BUNDLE_ID, CURRENT_BUILT_AT);

export const platformBridge = {
  getPlatform: detectPlatform,
  isNativeShell,
  getBundleId: () => CURRENT_BUNDLE_ID,
  getBuiltAt: () => CURRENT_BUILT_AT,

  async call<M extends BridgeMethodName>(
    method: M,
    ...args: AskBibleBridgeMethodMap[M]["args"] extends undefined
      ? [args?: AskBibleBridgeMethodMap[M]["args"]]
      : [args: AskBibleBridgeMethodMap[M]["args"]]
  ): Promise<AskBibleBridgeMethodMap[M]["result"]> {
    const native = createNativeBridgeAdapter();
    if (native) {
      return native.call(method, ...(args as [never]));
    }
    return webFallback.call(method, ...(args as [never]));
  },

  on<E extends BridgeEventName>(event: E, listener: Listener<E>): () => void {
    let set = eventListeners.get(event);
    if (!set) {
      set = new Set();
      eventListeners.set(event, set);
    }
    const wrapped = listener as Listener<BridgeEventName>;
    set.add(wrapped);
    return () => {
      set?.delete(wrapped);
    };
  },
};

export const bibleRepo = createBibleRepo(isNativeShell);
