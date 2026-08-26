import { DeviceEventEmitter } from "react-native";

export type WidgetPlaybackAction = "music" | "reading" | "verse";

const VERSE_PLAY_EVENT = "askbible-widget-verse-play";
const VERSE_STOP_EVENT = "askbible-widget-verse-stop";

let pendingVerseKey: string | null = null;
let versePlaying = false;
const versePlayingListeners = new Set<() => void>();

export function setWidgetVersePlaying(next: boolean): void {
  if (versePlaying === next) return;
  versePlaying = next;
  for (const listener of versePlayingListeners) listener();
}

export function getWidgetVersePlaying(): boolean {
  return versePlaying;
}

export function subscribeWidgetVersePlaying(listener: () => void): () => void {
  versePlayingListeners.add(listener);
  return () => {
    versePlayingListeners.delete(listener);
  };
}

export function queueWidgetVersePlay(verseKey: string): void {
  const key = verseKey.trim().toUpperCase();
  if (!key) return;
  pendingVerseKey = key;
  DeviceEventEmitter.emit(VERSE_PLAY_EVENT, key);
}

export function consumeQueuedWidgetVerseKey(): string | null {
  const key = pendingVerseKey;
  pendingVerseKey = null;
  return key;
}

export function peekQueuedWidgetVerseKey(): string | null {
  return pendingVerseKey;
}

export function requestWidgetVerseStop(): void {
  pendingVerseKey = null;
  DeviceEventEmitter.emit(VERSE_STOP_EVENT);
}

export function subscribeWidgetVersePlayRequest(handler: (verseKey: string) => void): () => void {
  const sub = DeviceEventEmitter.addListener(VERSE_PLAY_EVENT, (key: string) => {
    if (typeof key === "string" && key.trim()) handler(key.trim().toUpperCase());
  });
  return () => sub.remove();
}

export function subscribeWidgetVerseStopRequest(handler: () => void): () => void {
  const sub = DeviceEventEmitter.addListener(VERSE_STOP_EVENT, handler);
  return () => sub.remove();
}

export function parseWidgetPlaybackDeepLink(
  url: string,
): { action: WidgetPlaybackAction; verseKey?: string } | null {
  const trimmed = url.trim();
  if (!/askbible:/i.test(trimmed) || !/widget\/play/i.test(trimmed)) return null;
  try {
    const normalized = trimmed.replace(/^askbible:\/\//i, "https://askbible.local/");
    const u = new URL(normalized);
    const action = (u.searchParams.get("action") || "").trim().toLowerCase();
    if (action !== "music" && action !== "reading" && action !== "verse") return null;
    const verseKey = (u.searchParams.get("verseKey") || "").trim().toUpperCase() || undefined;
    return { action: action as WidgetPlaybackAction, verseKey };
  } catch {
    return null;
  }
}
