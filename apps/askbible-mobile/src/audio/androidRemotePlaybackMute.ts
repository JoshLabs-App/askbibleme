import { getShellAuxMediaOwner } from "./shellAuxMediaOwner";
import { getShellMusicWantPlaying } from "./shellMusicWantPlaying";
import { getShellScriptureWantPlaying } from "./shellScriptureWantPlaying";
import { getShellVerseWantPlaying } from "./shellVerseWantPlaying";
import {
  clearNatureAmbientSlot,
  getNatureAmbientSlotId,
  isNatureAmbientAudible,
  pauseNatureAmbientForRemote,
  restoreNatureAmbientSlot,
  resumeNatureAmbientForRemote,
} from "../nature/natureAmbientExclusiveStop";

export type AndroidRemoteMuteSnapshot = {
  music: boolean;
  verse: boolean;
  scripture: boolean;
  ambient: boolean;
  ambientSlotId?: string;
};

export type AndroidRemoteMutePlayback = {
  playing: boolean;
  playbackMode: "music" | "scripture";
  pauseShellPlayback: () => Promise<void>;
  ensureShellPlaybackActive: () => Promise<void>;
  togglePlayScripture: (opts?: { forcePause?: boolean }) => Promise<void>;
  /** 首页当前环境音芯片；有值时禁音必须熄黄标。 */
  ambientSlotId?: string;
  onClearAmbient?: () => void;
  onRestoreAmbient?: (id: string) => void;
};

let snapshot: AndroidRemoteMuteSnapshot | null = null;
const muteListeners = new Set<() => void>();

function notifyMuteListeners(): void {
  for (const cb of muteListeners) cb();
}

export function subscribeShellPlaybackMute(onChange: () => void): () => void {
  muteListeners.add(onChange);
  return () => {
    muteListeners.delete(onChange);
  };
}

export function hasAndroidRemoteMuteSnapshot(): boolean {
  const s = snapshot;
  return !!s && (s.music || s.verse || s.scripture || s.ambient);
}

export function isShellPlaybackMuted(): boolean {
  return (
    hasAndroidRemoteMuteSnapshot() &&
    !getShellMusicWantPlaying() &&
    !getShellVerseWantPlaying() &&
    !getShellScriptureWantPlaying() &&
    !isNatureAmbientAudible()
  );
}

export function clearAndroidRemoteMuteSnapshot(): void {
  if (!snapshot) return;
  snapshot = null;
  notifyMuteListeners();
}

function resolveAmbientSlotId(playback: AndroidRemoteMutePlayback): string {
  return (playback.ambientSlotId || getNatureAmbientSlotId()).trim();
}

export function isAndroidRemoteAudioActive(playback: AndroidRemoteMutePlayback): boolean {
  return (
    getShellMusicWantPlaying() ||
    getShellVerseWantPlaying() ||
    getShellScriptureWantPlaying() ||
    isNatureAmbientAudible() ||
    Boolean(resolveAmbientSlotId(playback)) ||
    (!hasAndroidRemoteMuteSnapshot() && playback.playing)
  );
}

export function captureAndroidRemoteMuteSnapshot(
  playback: AndroidRemoteMutePlayback,
): AndroidRemoteMuteSnapshot {
  const aux = getShellAuxMediaOwner();
  const next: AndroidRemoteMuteSnapshot = {
    music:
      getShellMusicWantPlaying() ||
      (playback.playbackMode === "music" && playback.playing),
    verse:
      getShellVerseWantPlaying() || aux?.id === "home-golden-verse",
    scripture:
      getShellScriptureWantPlaying() ||
      (playback.playbackMode === "scripture" && playback.playing),
    ambient: isNatureAmbientAudible() || Boolean(resolveAmbientSlotId(playback)),
    ambientSlotId: resolveAmbientSlotId(playback),
  };
  snapshot = next;
  notifyMuteListeners();
  return next;
}

/** 系统栏暂停：停掉本 App 当前在出的所有声（音乐 / 金句 / 读经 / 环境音）。 */
export function pauseAndroidRemoteAudio(playback: AndroidRemoteMutePlayback): void {
  captureAndroidRemoteMuteSnapshot(playback);
  const aux = getShellAuxMediaOwner();
  if (aux) void aux.pause();
  void pauseNatureAmbientForRemote();
  if (playback.onClearAmbient) {
    playback.onClearAmbient();
  } else if (getNatureAmbientSlotId()) {
    clearNatureAmbientSlot();
  }
  if (
    getShellMusicWantPlaying() ||
    (playback.playbackMode === "music" && playback.playing)
  ) {
    void playback.pauseShellPlayback();
  }
  if (
    getShellScriptureWantPlaying() ||
    (playback.playbackMode === "scripture" && playback.playing)
  ) {
    void playback.togglePlayScripture({ forcePause: true });
  }
  notifyMuteListeners();
}

/** 系统栏再点播放：按暂停前的组合续上。 */
export function resumeAndroidRemoteAudio(playback: AndroidRemoteMutePlayback): boolean {
  const held = snapshot;
  if (!held || !(held.music || held.verse || held.scripture || held.ambient)) {
    return false;
  }
  snapshot = null;
  notifyMuteListeners();
  // 先金句再音乐：音乐占栏，金句保持垫底。
  if (held.verse) {
    const aux = getShellAuxMediaOwner();
    if (aux?.id === "home-golden-verse") void aux.resume();
  }
  if (held.scripture) {
    void playback.togglePlayScripture();
  }
  if (held.music) {
    void playback.ensureShellPlaybackActive();
  }
  if (held.ambientSlotId) {
    if (playback.onRestoreAmbient) {
      playback.onRestoreAmbient(held.ambientSlotId);
    } else {
      restoreNatureAmbientSlot(held.ambientSlotId);
    }
  } else if (held.ambient) {
    void resumeNatureAmbientForRemote();
  }
  return true;
}

export function toggleAndroidRemoteAudio(playback: AndroidRemoteMutePlayback): void {
  if (isAndroidRemoteAudioActive(playback)) {
    pauseAndroidRemoteAudio(playback);
    return;
  }
  resumeAndroidRemoteAudio(playback);
}
