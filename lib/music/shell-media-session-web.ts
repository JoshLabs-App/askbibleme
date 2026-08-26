export type ShellMediaSessionWebKind = "music" | "scripture";

export type ShellMediaSessionWebPayload = {
  title: string;
  artist: string;
  album?: string;
  playing: boolean;
  positionSec: number;
  durationSec: number;
  playbackRate?: number;
  kind: ShellMediaSessionWebKind;
};

export type ShellMediaSessionWebBridge = {
  onPlay: () => void;
  onPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
};

let bridge: ShellMediaSessionWebBridge | null = null;
let handlersInstalled = false;
let lastPayloadKey = "";

function supportsMediaSession(): boolean {
  return typeof navigator !== "undefined" && "mediaSession" in navigator;
}

function shellMediaArtworkUrl(): string {
  const path = "/branding/icon-192.png";
  if (typeof window === "undefined") return path;
  try {
    return new URL(path, window.location.origin).href;
  } catch {
    return path;
  }
}

function installActionHandlersOnce(): void {
  if (!supportsMediaSession() || handlersInstalled) return;
  handlersInstalled = true;
  const ms = navigator.mediaSession;

  const safe = (action: MediaSessionAction, handler: (() => void) | null) => {
    try {
      ms.setActionHandler(action, handler);
    } catch {
      /* Safari may reject unsupported actions */
    }
  };

  safe("play", () => bridge?.onPlay());
  safe("pause", () => bridge?.onPause());
  safe("nexttrack", () => bridge?.onNext());
  safe("previoustrack", () => bridge?.onPrevious());
  safe("stop", () => bridge?.onPause());
}

export function setShellMediaSessionWebBridge(next: ShellMediaSessionWebBridge | null): void {
  bridge = next;
  if (!next) {
    clearShellMediaSessionWeb();
    return;
  }
  installActionHandlersOnce();
}

export function clearShellMediaSessionWeb(): void {
  if (!supportsMediaSession()) return;
  lastPayloadKey = "";
  try {
    navigator.mediaSession.metadata = null;
    navigator.mediaSession.playbackState = "none";
  } catch {
    /* ignore */
  }
}

export function syncShellMediaSessionWeb(payload: ShellMediaSessionWebPayload | null): void {
  if (!supportsMediaSession()) return;
  if (!payload?.title?.trim()) {
    clearShellMediaSessionWeb();
    return;
  }

  const key = [
    payload.kind,
    payload.title,
    payload.artist,
    payload.album ?? "",
    payload.playing ? "1" : "0",
    Math.floor(payload.positionSec),
    Math.floor(payload.durationSec),
    payload.playbackRate ?? 1,
  ].join("|");
  if (key !== lastPayloadKey) {
    lastPayloadKey = key;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: payload.title,
        artist: payload.artist,
        album: payload.album,
        artwork: [
          { src: shellMediaArtworkUrl(), sizes: "192x192", type: "image/png" },
        ],
      });
    } catch {
      /* ignore */
    }
  }

  try {
    navigator.mediaSession.playbackState = payload.playing ? "playing" : "paused";
  } catch {
    /* ignore */
  }

  if (payload.durationSec > 0 && Number.isFinite(payload.durationSec)) {
    try {
      navigator.mediaSession.setPositionState({
        duration: payload.durationSec,
        playbackRate: payload.playbackRate && payload.playbackRate > 0 ? payload.playbackRate : 1,
        position: Math.max(0, Math.min(payload.positionSec, payload.durationSec)),
      });
    } catch {
      /* setPositionState unsupported or invalid */
    }
  }
}

export function teardownShellMediaSessionWeb(): void {
  bridge = null;
  lastPayloadKey = "";
  if (!supportsMediaSession()) return;
  const ms = navigator.mediaSession;
  const actions: MediaSessionAction[] = [
    "play",
    "pause",
    "nexttrack",
    "previoustrack",
    "stop",
  ];
  for (const action of actions) {
    try {
      ms.setActionHandler(action, null);
    } catch {
      /* ignore */
    }
  }
  handlersInstalled = false;
  clearShellMediaSessionWeb();
}
