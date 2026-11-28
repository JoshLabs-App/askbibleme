import type {
  AskBibleBridge,
  AskBibleBridgeEventMap,
  AskBibleBridgeMethodMap,
  AudioStateSnapshot,
  AudioStreamKind,
  AuthSession,
  BridgeEventName,
  BridgeMethodName,
  PackStatus,
  ThemeMode,
} from "./contracts";
import { createBibleRepo } from "./bible-repo";

const THEME_STORAGE_KEY = "askbible-theme-mode";
const SESSION_STORAGE_KEY = "askbible-web-session";
const REMINDER_STORAGE_KEY = "askbible-reminder-config";

const EXCLUSIVE_WITH: Record<AudioStreamKind, AudioStreamKind[]> = {
  music: ["scripture"],
  scripture: ["music", "verse"],
  verse: ["scripture"],
};

function createEmptyStream(title: string) {
  return {
    wantPlaying: false,
    isPlaying: false,
    title,
    positionSec: 0,
    durationSec: 0,
  };
}

export function resolveThemeMode(mode: ThemeMode): "light" | "dark" {
  if (mode === "light" || mode === "dark") return mode;
  if (typeof window !== "undefined" && window.matchMedia) {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return "light";
}

export function applyThemeToDocument(mode: ThemeMode): "light" | "dark" {
  const resolved = resolveThemeMode(mode);
  if (typeof document !== "undefined") {
    document.documentElement.classList.toggle("dark", resolved === "dark");
  }
  return resolved;
}

export function createWebFallbackBridge(
  emit: <E extends BridgeEventName>(event: E, payload: AskBibleBridgeEventMap[E]) => void,
  bundleId: string,
  builtAt: string,
): AskBibleBridge {
  const repo = createBibleRepo(() => false);
  let pendingBundleId: string | null = null;
  let lastCheckedAt: string | null = null;

  const audioState: AudioStateSnapshot = {
    audibleStreams: [],
    music: createEmptyStream("安静 · 默认专辑"),
    scripture: createEmptyStream("圣经朗读"),
    verse: createEmptyStream("每日金句"),
    updatedAt: Date.now(),
  };

  function recomputeAudible() {
    const order: AudioStreamKind[] = ["music", "scripture", "verse"];
    audioState.audibleStreams = order.filter((k) => audioState[k].isPlaying);
    audioState.updatedAt = Date.now();
  }

  async function checkManifestUpdate(): Promise<{
    hasUpdate: boolean;
    bundleId: string;
    pendingBundleId: string | null;
  }> {
    lastCheckedAt = new Date().toISOString();
    try {
      const res = await fetch("/pack-manifest.json", { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as { bundleId?: string };
        if (data.bundleId && data.bundleId !== bundleId) {
          pendingBundleId = data.bundleId;
          emit("pack.readyToSwap", { bundleId: data.bundleId });
          return { hasUpdate: true, bundleId, pendingBundleId };
        }
      }
    } catch {
      // Offline: stay completely silent
    }
    return { hasUpdate: false, bundleId, pendingBundleId };
  }

  const handlers: {
    [K in BridgeMethodName]: (
      args: AskBibleBridgeMethodMap[K]["args"],
    ) => Promise<AskBibleBridgeMethodMap[K]["result"]>;
  } = {
    async "audio.intent"(req) {
      const target = audioState[req.stream];
      if (req.action === "play" || req.action === "resume") {
        for (const conflict of EXCLUSIVE_WITH[req.stream]) {
          audioState[conflict].wantPlaying = false;
          audioState[conflict].isPlaying = false;
        }
        target.wantPlaying = true;
        target.isPlaying = true;
        if (req.payload?.title) target.title = req.payload.title;
        if (req.payload?.bookId) target.bookId = req.payload.bookId;
        if (req.payload?.chapter) target.chapter = req.payload.chapter;
        if (req.payload?.verse) target.verse = req.payload.verse;
        if (req.payload?.url) target.url = req.payload.url;
      } else if (req.action === "pause" || req.action === "stop") {
        target.wantPlaying = false;
        target.isPlaying = false;
        if (req.action === "stop") target.positionSec = 0;
      } else if (req.action === "seek" && typeof req.payload?.positionSec === "number") {
        target.positionSec = req.payload.positionSec;
      }
      recomputeAudible();
      emit("audio.state", { ...audioState });
      return { ...audioState };
    },

    async "shell.setTab"(args) {
      emit("shell.tabSelected", { tab: args.tab, route: args.route });
      return { ok: true };
    },

    async "shell.setTheme"(args) {
      try {
        localStorage.setItem(THEME_STORAGE_KEY, args.mode);
      } catch {
        // Ignore storage quota errors
      }
      const resolved = applyThemeToDocument(args.mode);
      return { ok: true, resolved };
    },

    async "shell.haptic"(args) {
      if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
        const ms = args.style === "success" ? 18 : args.style === "medium" ? 12 : 6;
        navigator.vibrate(ms);
      }
      return { ok: true };
    },

    async "pack.status"(): Promise<PackStatus> {
      const downloadedTranslations = await repo.getDownloadedTranslationIds();
      return {
        bundleId,
        builtAt,
        pendingBundleId,
        readyToSwap: Boolean(pendingBundleId),
        platform: "web",
        downloadedTranslations,
        lastCheckedAt,
      };
    },

    async "pack.checkNow"() {
      return checkManifestUpdate();
    },

    async "pack.downloadTranslation"(args) {
      await repo.getChapter(args.id, "JHN", 1);
      await repo.getChapter(args.id, "PSA", 23);
      const ids = await repo.markTranslationDownloaded(args.id);
      return { ok: true, id: args.id, cachedCount: ids.length };
    },

    async "pack.commitSwap"() {
      if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
        const reg = await navigator.serviceWorker.getRegistration().catch(() => null);
        if (reg?.waiting) {
          reg.waiting.postMessage({ type: "SKIP_WAITING" });
        }
      }
      return { ok: true };
    },

    async "auth.signIn"(args): Promise<AuthSession> {
      const session: AuthSession = {
        signedIn: true,
        userId: `web-${args.provider}-local`,
        email: args.email || "reader@askbible.me",
        displayName: args.email ? args.email.split("@")[0] : "AskBible 读者",
        provider: args.provider,
      };
      try {
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
      } catch {
        // Ignore
      }
      return session;
    },

    async "auth.getSession"(): Promise<AuthSession> {
      try {
        const raw = localStorage.getItem(SESSION_STORAGE_KEY);
        if (raw) return JSON.parse(raw) as AuthSession;
      } catch {
        // Ignore
      }
      return { signedIn: false };
    },

    async "auth.signOut"() {
      try {
        localStorage.removeItem(SESSION_STORAGE_KEY);
      } catch {
        // Ignore
      }
      return { ok: true };
    },

    async "sys.setReminder"(args) {
      try {
        localStorage.setItem(REMINDER_STORAGE_KEY, JSON.stringify(args));
      } catch {
        // Ignore
      }
      return { ok: true, ...args };
    },

    async "sys.syncWidget"() {
      return { ok: true };
    },

    async "sys.shareImage"(args) {
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        try {
          await navigator.share({ text: args.text, title: "AskBible.me" });
          return { ok: true, method: "web-share" };
        } catch {
          // User cancelled or unsupported
        }
      }
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(args.text).catch(() => {});
        return { ok: true, method: "clipboard" };
      }
      return { ok: true, method: "clipboard" };
    },
  };

  return {
    call(method, ...rest) {
      const fn = handlers[method] as (arg: unknown) => Promise<unknown>;
      return fn(rest[0]) as ReturnType<AskBibleBridge["call"]>;
    },
  };
}
