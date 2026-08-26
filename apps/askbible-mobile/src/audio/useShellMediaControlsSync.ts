import { useEffect, useRef } from "react";
import { AppState, DeviceEventEmitter, Platform, type AppStateStatus } from "react-native";
import { getShellAuxMediaOwner } from "./shellAuxMediaOwner";
import {
  clearShellMediaSessionUserDismissed,
  markShellMediaSessionUserDismissed,
  subscribeShellMediaRemoteCommands,
  syncShellMediaSession,
} from "./shellMediaControls";
import {
  getShellMusicWantPlaying,
  setShellMusicWantPlaying,
  subscribeShellMusicWantPlaying,
} from "./shellMusicWantPlaying";
import {
  getShellVerseWantPlaying,
  setShellVerseWantPlaying,
  subscribeShellVerseWantPlaying,
} from "./shellVerseWantPlaying";
import {
  getShellScriptureWantPlaying,
  setShellScriptureWantPlaying,
  subscribeShellScriptureWantPlaying,
} from "./shellScriptureWantPlaying";
import { setShellMusicNativePlaying } from "./shellMusicNativePlaying";
import { isNativeMainTrackOs, isShellNativeAudioTakeover } from "./shellNativeAudioTakeover";
import {
  clearAndroidRemoteMuteSnapshot,
  hasAndroidRemoteMuteSnapshot,
  isAndroidRemoteAudioActive,
  pauseAndroidRemoteAudio,
  resumeAndroidRemoteAudio,
} from "./androidRemotePlaybackMute";
import { getShellAudioInterrupted } from "./shellAudioInterruption";
import { isScriptureUserPauseHeld } from "../music/scriptureUserPause";
import {
  buildShellMediaSessionPayload,
  refreshShellMediaSession,
  setShellMediaSessionLiveArgs,
} from "./shellMediaSessionPayload";
import { useWidgetPlaybackColdStart } from "../widget/widgetPlaybackColdStart";
import {
  syncPlaybackWidget,
  syncPlaybackWidgetForceIdleMusic,
  type PlaybackWidgetSnapshot,
} from "../widget/readingAudioWidget";
import {
  getWidgetVersePlaying,
  subscribeWidgetVersePlaying,
} from "../widget/widgetPlaybackRequest";
import type { MusicPlaybackMode } from "../music/musicPlaybackTypes";
import type { PlaybackTrack } from "../music/types";
import type { ReadChapterPlaybackRegistration } from "../music/scripturePlaybackTypes";

type Args = {
  loading: boolean;
  playing: boolean;
  playbackMode: MusicPlaybackMode;
  tracks: PlaybackTrack[];
  trackIndex: number;
  musicCurrentSec: number;
  musicDurationSec: number;
  scriptureCurrentSec: number;
  scriptureDurationSec: number;
  readChapter: ReadChapterPlaybackRegistration | null;
  /** 锁屏 RemotePlay：已标 playing 但轨哑时强制续播，勿 early-return。 */
  ensureShellPlaybackActive: () => Promise<void>;
  togglePlayMusic: () => Promise<void>;
  pauseShellPlayback: () => Promise<void>;
  playNext: () => Promise<void>;
  playPrev: () => Promise<void>;
  playTrackAt: (index: number, opts?: { autoPlay?: boolean }) => Promise<boolean>;
  togglePlayScripture: (opts?: { forcePause?: boolean }) => Promise<void>;
  /** 桌面「收听」挂件专用：非读经模式时开始今日读经；读经模式时交给 togglePlayScripture 暂停/续播。 */
  startReadingAudio: () => Promise<boolean>;
  /** 桌面挂件「喇叭」：播放当前挂件经文（金句）。 */
  startVerseAudio: (verseKey?: string) => Promise<boolean>;
};

type ReadingWidgetState = { hasContent: boolean; deepLink: string };

function logRemoteCommand(message: string): void {
  console.info(`[shell-media] ${message}`);
}

/**
 * 桌面每日经文挂件上「音乐 / 喇叭 / 读经」三键快照。
 * - 读经：有章节则记录自动续播深链；没在读经模式时保留上次章节，仅播放态置 false。
 * - 音乐：有曲目即视为有内容；音乐无章节深链，冷启动只打开 App。
 * - 经文：金句辅助播放器状态（与壳层 music/scripture 独立）。
 */
function shouldSkipNativeBackgroundSessionTick(appState: AppStateStatus): boolean {
  if (appState === "active") return false;
  if (Platform.OS === "ios") {
    return (
      getShellMusicWantPlaying() ||
      getShellVerseWantPlaying() ||
      getShellScriptureWantPlaying() ||
      isShellNativeAudioTakeover()
    );
  }
  if (Platform.OS === "android") {
    // 金句仍需后台刷会话；音乐/读经已由原生主轨保活。
    return getShellMusicWantPlaying() || getShellScriptureWantPlaying();
  }
  return false;
}

function buildPlaybackWidgetSnapshot(
  args: Args,
  lastReading: ReadingWidgetState | null,
): { snapshot: PlaybackWidgetSnapshot; nextReading: ReadingWidgetState | null } {
  const { playbackMode, readChapter, playing, tracks, trackIndex } = args;

  let reading = lastReading;
  if (playbackMode === "scripture" && readChapter) {
    reading = {
      hasContent: true,
      deepLink: `askbible://read/${readChapter.bookId}/${readChapter.chapter}?autoplay=1`,
    };
  }

  const hasMusic = !!tracks[trackIndex];
  // iOS 黄标只信原生在播；避免 wantPlaying 残留导致停播后仍黄。
  const musicActuallyPlaying =
    playbackMode === "music" &&
    playing &&
    (!isNativeMainTrackOs() || isShellNativeAudioTakeover());

  return {
    nextReading: reading,
    snapshot: {
      scripturePlaying: playbackMode === "scripture" && playing,
      scriptureHasContent: !!reading?.hasContent,
      scriptureDeepLink: reading?.deepLink ?? "",
      musicPlaying: musicActuallyPlaying,
      musicHasContent: hasMusic,
      musicDeepLink: "askbible://",
      versePlaying: getWidgetVersePlaying(),
    },
  };
}

/** 系统栏用户点停：同步清 want，避免定时 sync 把 playing:true 刷回原生把暂停抵消。 */
function androidRemotePauseFromUser(latest: Args): void {
  setShellMusicWantPlaying(false);
  setShellMusicNativePlaying(false);
  setShellVerseWantPlaying(false);
  setShellScriptureWantPlaying(false);
  pauseAndroidRemoteAudio(latest);
  refreshShellMediaSession({ playing: false });
}

export function useShellMediaControlsSync(args: Args): void {
  const argsRef = useRef(args);
  argsRef.current = args;
  const lastReadingRef = useRef<ReadingWidgetState | null>(null);
  /** 刚进后台的时间戳：部分 OEM 关屏会误发 MediaSession onPause，需与用户锁屏点暂停区分。 */
  const leftActiveAtRef = useRef(0);

  setShellMediaSessionLiveArgs(args);

  useEffect(() => {
    // 冷启：若未在播，灭掉残留黄标（进程被杀后挂件盘上常仍 musicPlaying=true）。
    if (Platform.OS !== "ios" && Platform.OS !== "android") return;
    if (getShellMusicWantPlaying() || isShellNativeAudioTakeover()) return;
    syncPlaybackWidgetForceIdleMusic();
  }, []);

  useEffect(() => {
    let appState: AppStateStatus = AppState.currentState;
    const sub = AppState.addEventListener("change", (next) => {
      if (appState === "active" && next !== "active") {
        leftActiveAtRef.current = Date.now();
      }
      if (appState !== "active" && next === "active") {
        const latest = argsRef.current;
        if (
          getShellScriptureWantPlaying() ||
          getShellMusicWantPlaying() ||
          (latest.playing &&
            (latest.playbackMode === "scripture" || latest.playbackMode === "music"))
        ) {
          void latest.ensureShellPlaybackActive();
        }
      }
      appState = next;
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (__DEV__) {
      console.warn("[shell-media] sync hook mounted", {
        platform: Platform.OS,
        loading: args.loading,
        mode: args.playbackMode,
        playing: args.playing,
      });
    }
    const unsubscribe = subscribeShellMediaRemoteCommands({
      // 锁屏 / 通知媒体键：对当前正在播放的内容做纯暂停/续播（尊重当前模式）。
      onPlay: () => {
        clearShellMediaSessionUserDismissed();
        const latest = argsRef.current;
        logRemoteCommand(`RemotePlay mode=${latest.playbackMode} playing=${latest.playing}`);
        // Android：系统栏再点 = 按暂停前的声音组合续上。
        if (Platform.OS === "android") {
          if (resumeAndroidRemoteAudio(latest)) return;
          if (getShellVerseWantPlaying() || getShellAuxMediaOwner()?.id === "home-golden-verse") {
            const aux = getShellAuxMediaOwner();
            if (aux?.id === "home-golden-verse") {
              void aux.resume();
              return;
            }
          }
          void latest.ensureShellPlaybackActive();
          return;
        }
        // iOS：金句意图在播时优先恢复金句，勿误走壳层音乐 ensure。
        if (getShellVerseWantPlaying() || getShellAuxMediaOwner()?.id === "home-golden-verse") {
          const aux = getShellAuxMediaOwner();
          if (aux?.id === "home-golden-verse") {
            void aux.resume();
            return;
          }
        }
        // UI 仍标 playing 时也可能已哑：走 ensure，勿直接 return。
        void latest.ensureShellPlaybackActive();
      },
      onPause: (payload?: unknown) => {
        const latest = argsRef.current;
        logRemoteCommand(`RemotePause mode=${latest.playbackMode} playing=${latest.playing}`);
        if (Platform.OS === "android") {
          const userRemotePause = payload === "user";
          if (isScriptureUserPauseHeld() && latest.playbackMode === "scripture") {
            androidRemotePauseFromUser(latest);
            return;
          }
          // 通知 / 系统栏用户点停：勿走关屏误发续播分支。
          if (userRemotePause) {
            androidRemotePauseFromUser(latest);
            return;
          }
          // 三星关屏常把 MediaSession Pause 标成 user；关屏后数秒内一律当误发。
          const recentlyBackgrounded = Date.now() - leftActiveAtRef.current < 4000;
          if (recentlyBackgrounded && !getShellAudioInterrupted()) {
            if (getShellVerseWantPlaying() || getShellAuxMediaOwner()?.id === "home-golden-verse") {
              const aux = getShellAuxMediaOwner();
              if (aux?.id === "home-golden-verse") void aux.resume();
            }
            // 原生可能已 applyUserPause；ensure 必须能在 JS 仍标 playing 时把声推回来。
            if (
              getShellMusicWantPlaying() ||
              latest.playbackMode === "music" ||
              getShellScriptureWantPlaying() ||
              latest.playbackMode === "scripture"
            ) {
              void latest.ensureShellPlaybackActive();
            }
            return;
          }
          androidRemotePauseFromUser(latest);
          return;
        }
        // iOS：金句在播走 aux.pause；关屏瞬间 OEM 误发的 Pause 则强制续播。
        if (getShellVerseWantPlaying() || getShellAuxMediaOwner()?.id === "home-golden-verse") {
          const aux = getShellAuxMediaOwner();
          if (aux?.id === "home-golden-verse") {
            const recentlyBackgrounded = Date.now() - leftActiveAtRef.current < 4000;
            if (
              !getShellAudioInterrupted() &&
              (recentlyBackgrounded || AppState.currentState !== "active")
            ) {
              void aux.resume();
              return;
            }
            void aux.pause();
            return;
          }
        }
        if (getShellScriptureWantPlaying() || latest.playbackMode === "scripture") {
          void latest.togglePlayScripture({ forcePause: true });
          return;
        }
        if (!latest.playing) {
          const aux = getShellAuxMediaOwner();
          if (aux) {
            void aux.pause();
            return;
          }
        }
        if (latest.playbackMode === "music") {
          void latest.pauseShellPlayback();
        } else {
          void latest.togglePlayScripture({ forcePause: true });
        }
      },
      onToggle: () => {
        const latest = argsRef.current;
        logRemoteCommand(`RemoteToggle mode=${latest.playbackMode} playing=${latest.playing}`);
        // Android 系统栏：点一下全停，再点按原组合续播。
        if (Platform.OS === "android") {
          if (isAndroidRemoteAudioActive(latest)) {
            androidRemotePauseFromUser(latest);
            return;
          }
          clearShellMediaSessionUserDismissed();
          if (resumeAndroidRemoteAudio(latest)) return;
          if (latest.playbackMode === "music") {
            void latest.togglePlayMusic();
          } else {
            void latest.togglePlayScripture();
          }
          return;
        }
        if (!latest.playing) {
          clearShellMediaSessionUserDismissed();
          const aux = getShellAuxMediaOwner();
          if (aux) {
            const payload = aux.buildPayload();
            if (payload?.playing) void aux.pause();
            else void aux.resume();
            return;
          }
        }
        if (latest.playbackMode === "music") {
          if (!latest.playing) clearShellMediaSessionUserDismissed();
          // playing=true 但轨哑时 toggle 会续播；真在播才暂停。
          void latest.togglePlayMusic();
        } else {
          if (!latest.playing) clearShellMediaSessionUserDismissed();
          void latest.togglePlayScripture();
        }
      },
      onNext: () => {
        clearShellMediaSessionUserDismissed();
        const latest = argsRef.current;
        logRemoteCommand(`RemoteNext mode=${latest.playbackMode} playing=${latest.playing}`);
        // 金句在播：推进金句，勿 playNext 切音乐。
        if (getShellVerseWantPlaying() || getShellAuxMediaOwner()?.id === "home-golden-verse") {
          DeviceEventEmitter.emit("ShellMediaNativeVerseAdvance", {});
          return;
        }
        void latest.playNext();
      },
      onPrevious: () => {
        clearShellMediaSessionUserDismissed();
        const latest = argsRef.current;
        logRemoteCommand(`RemotePrevious mode=${latest.playbackMode} playing=${latest.playing}`);
        // 金句在播：重开当前句（对齐 Next→Advance），勿 playPrev 切音乐。
        if (getShellVerseWantPlaying() || getShellAuxMediaOwner()?.id === "home-golden-verse") {
          DeviceEventEmitter.emit("ShellMediaNativeVerseRestart", {});
          return;
        }
        void latest.playPrev();
      },
      // 划掉系统媒体控件：停播栏上内容，并抑制会话自动再弹出。
      onStop: () => {
        const latest = argsRef.current;
        logRemoteCommand(`RemoteStop mode=${latest.playbackMode} playing=${latest.playing}`);
        if (Platform.OS === "android") {
          const recentlyBackgrounded = Date.now() - leftActiveAtRef.current < 4000;
          if (recentlyBackgrounded && !getShellAudioInterrupted()) {
            logRemoteCommand("RemoteStop ignored (OEM screen-off window)");
            return;
          }
          markShellMediaSessionUserDismissed();
          androidRemotePauseFromUser(latest);
          syncShellMediaSession(null);
          return;
        }
        markShellMediaSessionUserDismissed();
        clearAndroidRemoteMuteSnapshot();
        const aux = getShellAuxMediaOwner();
        if (aux) void aux.pause();
        if (latest.playbackMode === "music") {
          void latest.pauseShellPlayback();
        } else if (latest.playing || latest.playbackMode === "scripture") {
          void latest.togglePlayScripture({ forcePause: true });
        }
        syncShellMediaSession(null);
      },
      // 桌面挂件「读经」键：只作用于本日读经音频，不碰音乐播放器。
      onReadingToggle: () => {
        const latest = argsRef.current;
        logRemoteCommand(`RemoteReadingToggle mode=${latest.playbackMode} playing=${latest.playing}`);
        if (latest.playbackMode === "scripture") {
          // 读经模式：纯暂停/续播。
          if (!latest.playing) clearShellMediaSessionUserDismissed();
          void latest.togglePlayScripture();
        } else {
          // 音乐 / 空闲：开始今日读经（切换到读经）。
          clearShellMediaSessionUserDismissed();
          void latest.startReadingAudio();
        }
      },
      // 桌面挂件「音乐」键：播放/暂停音乐；非音乐模式时开始音乐（会释放读经）。
      onMusicToggle: () => {
        if (!argsRef.current.playing) clearShellMediaSessionUserDismissed();
        logRemoteCommand(`RemoteMusicToggle mode=${argsRef.current.playbackMode} playing=${argsRef.current.playing}`);
        void argsRef.current.togglePlayMusic();
      },
      // 桌面挂件「喇叭」：播放当前挂件经文（金句）。
      onVerseToggle: (verseKey) => {
        clearShellMediaSessionUserDismissed();
        logRemoteCommand(`RemoteVerseToggle key=${verseKey ?? ""}`);
        void argsRef.current.startVerseAudio(verseKey);
      },
    });
    return () => {
      if (__DEV__) {
        console.warn("[shell-media] sync hook cleanup");
      }
      unsubscribe();
    };
  }, []);

  useWidgetPlaybackColdStart({
    loading: args.loading,
    tracks: args.tracks,
    trackIndex: args.trackIndex,
    playing: args.playing,
    playbackMode: args.playbackMode,
    playTrackAt: args.playTrackAt,
    startReadingAudio: args.startReadingAudio,
    startVerseAudio: args.startVerseAudio,
  });

  useEffect(() => {
    // 壳层音乐意图在播：系统栏只刷新音乐，勿把金句/环境音插进来。
    // 用户刚点系统栏暂停时已有 mute 快照：勿把 playing:true 刷回去。
    if (getShellMusicWantPlaying() && !hasAndroidRemoteMuteSnapshot()) {
      const keep = buildShellMediaSessionPayload({
        ...args,
        playbackMode: "music",
        playing: true,
      });
      if (keep) {
        syncShellMediaSession(keep);
        return;
      }
    }
    // 壳层未在播时，把锁屏交给金句 / 环境音等辅助播放器（Android 金句也需进栏，否则关屏断播）。
    if (args.playbackMode === "music" && !getShellMusicWantPlaying()) {
      const aux = getShellAuxMediaOwner();
      const auxPayload = aux?.buildPayload() ?? null;
      if (auxPayload?.playing) {
        syncShellMediaSession(auxPayload);
        return;
      }
    }
    if (!args.playing) {
      const aux = getShellAuxMediaOwner();
      const auxPayload = aux?.buildPayload() ?? null;
      if (auxPayload) {
        syncShellMediaSession(auxPayload);
        return;
      }
    }
    const payload = buildShellMediaSessionPayload(
      args.playbackMode === "music"
        ? { ...args, playing: getShellMusicWantPlaying() && args.playing }
        : args,
    );
    if (!payload) {
      if (getShellMusicWantPlaying()) return;
      syncShellMediaSession(null);
      return;
    }
    // 暂停时仍保留锁屏元数据，仅更新播放状态。
    if (!payload.playing && payload.positionSec <= 0 && payload.durationSec <= 0) {
      if (getShellMusicWantPlaying()) return;
      syncShellMediaSession(null);
      return;
    }
    syncShellMediaSession(payload);
  }, [
    args.playing,
    args.playbackMode,
    args.tracks,
    args.trackIndex,
    args.musicCurrentSec,
    args.musicDurationSec,
    args.scriptureCurrentSec,
    args.scriptureDurationSec,
    args.readChapter,
  ]);

  useEffect(() => {
    const push = () => {
      const { snapshot, nextReading } = buildPlaybackWidgetSnapshot(
        argsRef.current,
        lastReadingRef.current,
      );
      lastReadingRef.current = nextReading;
      syncPlaybackWidget(snapshot);
    };
    push();
    return subscribeWidgetVersePlaying(push);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [args.playing, args.playbackMode, args.readChapter, args.tracks, args.trackIndex]);

  // 系统可能清掉 Now Playing / 前台服务；有壳层或辅助播放时刷新。
  // 后台降频：原生侧已自推 elapsed，避免每秒 updateSession 反复碰音频会话。
  useEffect(() => {
    let appState: AppStateStatus = AppState.currentState;
    let id: ReturnType<typeof setInterval> | null = null;

    const tick = () => {
      if (shouldSkipNativeBackgroundSessionTick(appState)) {
        return;
      }
      const latest = argsRef.current;
      if (getShellMusicWantPlaying() && !hasAndroidRemoteMuteSnapshot()) {
        refreshShellMediaSession({ playing: true });
        return;
      }
      // Android 金句：后台仍要刷会话，避免 OEM 把状态打成 paused 后无前台服务保活。
      if (getShellVerseWantPlaying()) {
        if (Platform.OS === "android") {
          const aux = getShellAuxMediaOwner();
          const auxPayload = aux?.buildPayload() ?? null;
          if (auxPayload) {
            syncShellMediaSession({ ...auxPayload, playing: true });
          }
        }
        return;
      }
      if (getShellScriptureWantPlaying()) {
        return;
      }
      if (latest.playbackMode === "music" && !getShellMusicWantPlaying()) {
        const aux = getShellAuxMediaOwner();
        const auxPayload = aux?.buildPayload() ?? null;
        if (auxPayload?.playing) {
          syncShellMediaSession(auxPayload);
        }
        return;
      }
      if (!latest.playing) {
        const aux = getShellAuxMediaOwner();
        const auxPayload = aux?.buildPayload() ?? null;
        if (auxPayload) {
          syncShellMediaSession(auxPayload);
          return;
        }
        return;
      }
      refreshShellMediaSession();
    };

    const arm = () => {
      if (id) {
        clearInterval(id);
        id = null;
      }
      if (shouldSkipNativeBackgroundSessionTick(appState)) {
        return;
      }
      const ms = appState === "active" ? 2500 : 8000;
      tick();
      id = setInterval(tick, ms);
    };

    arm();
    const sub = AppState.addEventListener("change", (next) => {
      appState = next;
      arm();
    });
    const unsubWant = subscribeShellMusicWantPlaying(arm);
    const unsubVerse = subscribeShellVerseWantPlaying(arm);
    const unsubScripture = subscribeShellScriptureWantPlaying(arm);
    return () => {
      if (id) clearInterval(id);
      sub.remove();
      unsubWant();
      unsubVerse();
      unsubScripture();
    };
  }, [
    args.playing,
    args.playbackMode,
    args.tracks,
    args.trackIndex,
    args.musicCurrentSec,
    args.musicDurationSec,
    args.scriptureCurrentSec,
    args.scriptureDurationSec,
    args.readChapter,
  ]);
}
