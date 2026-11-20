export const TV_RELAY_HTTP_BASE =
  process.env.NEXT_PUBLIC_TV_RELAY_BASE?.replace(/\/+$/, "") || "https://tv-relay.joshlabs.app";

export const TV_RELAY_WS_BASE = TV_RELAY_HTTP_BASE.replace(/^http/, "ws");

export type TvPlanChapter = { bookId: string; chapter: number };

export type TvMediaPayload =
  | { kind: "music"; album: string; trackSrc: string; trackTitle?: string; positionSec?: number }
  | { kind: "plan"; scopeKey?: string; queue: TvPlanChapter[]; index: number; positionSec?: number }
  | { kind: "scripture"; bookId: string; chapter: number; verse?: number; positionSec?: number; audioPlaying?: boolean }
  | { kind: "verse"; verseKey: string };

export type TvCommand =
  | { op: "handoff"; cmdId: string; deviceId?: string; media: TvMediaPayload; sentAt: number }
  | {
      op: "control";
      cmdId: string;
      deviceId?: string;
      action: "play" | "pause" | "next" | "prev" | "seek" | "sceneNext" | "scenePrev";
      value?: number;
    }
  | { op: "stop"; cmdId: string; deviceId?: string };

export type TvPlaybackState = {
  op: "state";
  deviceId?: string;
  name?: string;
  kind: "idle" | "music" | "plan" | "scripture" | "verse";
  title: string;
  playing: boolean;
  positionSec: number;
  durationSec: number;
  bookId?: string;
  chapter?: number;
  verse?: number;
  ackCmdId?: string;
  error?: "autoplay-blocked" | "load-failed";
};

export type TvDeviceInfo = {
  id: string;
  name: string;
  online: boolean;
  lastSeenAt: number;
  state: TvPlaybackState | null;
};

export type StoredTvPairing = {
  tvToken: string;
  deviceId: string;
  userId: string;
  tvName: string;
};

export const TV_PAIRING_STORAGE_KEY = "askbible.tv.pairing.v1";

export function readStoredTvPairing(): StoredTvPairing | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(TV_PAIRING_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredTvPairing>;
    if (!parsed?.tvToken || !parsed?.deviceId || !parsed?.userId) return null;
    return {
      tvToken: parsed.tvToken,
      deviceId: parsed.deviceId,
      userId: parsed.userId,
      tvName: parsed.tvName || "客厅电视",
    };
  } catch {
    return null;
  }
}

export function writeStoredTvPairing(pairing: StoredTvPairing | null): void {
  if (typeof window === "undefined") return;
  try {
    if (!pairing) window.localStorage.removeItem(TV_PAIRING_STORAGE_KEY);
    else window.localStorage.setItem(TV_PAIRING_STORAGE_KEY, JSON.stringify(pairing));
  } catch {
    /* ignore */
  }
}

export function makeCmdId(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
