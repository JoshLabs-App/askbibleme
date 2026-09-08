import { getPlaybackSnapshot } from "./playbackState";
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
import { isShellNativeAudioTakeover } from "./shellNativeAudioTakeover";
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

/**
 * 把 App 内的三条播放意图（音乐 / 读经 / 金句）与原生媒体会话/系统远程指令双向同步的 hook。
 * 职责：订阅 RemotePlay/Pause/Toggle/Next/Previous/Stop 等系统媒体键，路由到对应播放器；
 *   周期性刷新会话 payload 以防系统清空 Now Playing；同步桌面挂件快照。
 * 边界：不做具体音频解码/播放，只做「谁该响、系统按键该转发给谁」的仲裁；实际播放逻辑
 *   在各自的 hook（如 useHomeNatureVerseAudioPlayback）和 shellMediaControls 原生桥接层。
 * 交互模块：shellMediaControls（原生会话桥接）、shellAuxMediaOwner（当前占用锁屏的辅助播放
 *   者，如首页金句）、shell*WantPlaying 系列全局标志、androidRemotePlaybackMute（安卓关屏
 *   误触发 Pause 的规避）、widget/*（桌面挂件同步）。
 * 大量分支要区分「用户主动在系统栏点了暂停」与「OEM 关屏时误发的 Pause 事件」——
 * 这类误发是本文件复杂度的主要来源，见 leftActiveAtRef 与 recentlyBackgrounded 判断。
 */
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
// 后台会话刷新 tick 是否应跳过：iOS/Android 原生已接管主轨播放时，JS 侧再刷会话
// 反而可能打断原生心跳/定时器，因此按平台和当前占用者分别判断是否可以安全跳过。
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
    playbackMode === "music" && playing;

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
  // 挂件读经卡片的最近一次状态；音乐/空闲态下沿用它以避免深链在模式切换间闪烁。
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
      /*
       * 锁屏 / 通知栏的播放暂停键：**原生已经处理完了**（PauseAll / ResumeTransport），
       * JS 这里只补它做不到的一件事——一路都没起来时说明没有可续播的内容，由 JS 挑一首。
       *
       * 这里原本有一百三十行：安卓与 iOS 各一套分支、金句 aux 的接管与交还、
       * 三星关屏误发 Pause 的时间窗启发式……它们全都在重建「刚才在播什么、该恢复谁」，
       * 而那正是原生此刻精确知道的事（三条流各自的 uri 与 userPaused）。
       * 关屏误发的判断也已经在 ShellPlaybackService 里，不必在 JS 再猜一遍。
       */
      onPlay: () => {
        clearShellMediaSessionUserDismissed();
        if (getPlaybackSnapshot().nowPlayingStream != null) return;
        void argsRef.current.ensureShellPlaybackActive();
      },
      onPause: () => {
        /* 原生已 PauseAll；UI 会从 ShellPlaybackState 收到结果。 */
      },
      onToggle: () => {
        clearShellMediaSessionUserDismissed();
        if (getPlaybackSnapshot().nowPlayingStream != null) return;
        void argsRef.current.ensureShellPlaybackActive();
      },
      onNext: () => {
        clearShellMediaSessionUserDismissed();
        const latest = argsRef.current;
        logRemoteCommand(`RemoteNext mode=${latest.playbackMode} playing=${latest.playing}`);
        // 金句在播：推进金句，勿 playNext 切音乐。
        if (getPlaybackSnapshot().nowPlayingStream === "verse") {
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
        if (getPlaybackSnapshot().nowPlayingStream === "verse") {
          DeviceEventEmitter.emit("ShellMediaNativeVerseRestart", {});
          return;
        }
        void latest.playPrev();
      },
      /** 划掉系统媒体控件：原生 handleUserDismiss 已停播并撤通知，这里只记下别再自动弹回。 */
      onStop: () => {
        markShellMediaSessionUserDismissed();
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

  /**
   * 把当前这一路的元数据（标题 / 作者 / 封面 / 时长）推给原生。
   *
   * **不再决定「谁占锁屏」**——那是原生的仲裁（nowPlaying：读经 > 音乐 > 金句叠底）。
   * 这里原本有一套优先级回退：先看壳层音乐意图、再看 aux 播放器、再看 playbackMode，
   * 每一层命中就提前返回「免得互相覆盖」。那些覆盖担忧在原生按流记账之后不成立了：
   * 不带 userPlay 的同步碰不到「谁在播」，只补元数据。
   */
  useEffect(() => {
    const payload = buildShellMediaSessionPayload(args);
    if (payload) syncShellMediaSession(payload);
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

    // 前台/后台用不同刷新周期：前台 2.5s 保持界面新鲜，后台放宽到 8s 省电，
    // 并在 want-playing 标志变化时立即重新武装计时器（arm）而不是等下一个 tick。
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
