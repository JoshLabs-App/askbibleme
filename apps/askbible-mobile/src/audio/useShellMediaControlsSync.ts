import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import {
  subscribeShellMediaRemoteCommands,
  syncShellMediaSession,
} from "./shellMediaControls";
import {
  buildShellMediaSessionPayload,
  refreshShellMediaSession,
  setShellMediaSessionLiveArgs,
} from "./shellMediaSessionPayload";
import { useWidgetPlaybackColdStart } from "../widget/widgetPlaybackColdStart";
import {
  syncPlaybackWidget,
  type PlaybackWidgetSnapshot,
} from "../widget/readingAudioWidget";
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
  togglePlayMusic: () => Promise<void>;
  pauseShellPlayback: () => Promise<void>;
  playNext: () => Promise<void>;
  playPrev: () => Promise<void>;
  playTrackAt: (index: number, opts?: { autoPlay?: boolean }) => Promise<boolean>;
  togglePlayScripture: (opts?: { forcePause?: boolean }) => Promise<void>;
  /** 桌面「收听」挂件专用：非读经模式时开始今日读经；读经模式时交给 togglePlayScripture 暂停/续播。 */
  startReadingAudio: () => Promise<boolean>;
};

type ReadingWidgetState = { hasContent: boolean; deepLink: string };

function logRemoteCommand(message: string): void {
  console.info(`[shell-media] ${message}`);
}

/**
 * 桌面每日经文挂件上「读经 / 音乐」两个独立按钮的快照。
 * - 读经：有章节则记录自动续播深链；没在读经模式时保留上次章节，仅播放态置 false。
 * - 音乐：有曲目即视为有内容；音乐无章节深链，冷启动只打开 App。
 */
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

  return {
    nextReading: reading,
    snapshot: {
      scripturePlaying: playbackMode === "scripture" && playing,
      scriptureHasContent: !!reading?.hasContent,
      scriptureDeepLink: reading?.deepLink ?? "",
      musicPlaying: playbackMode === "music" && playing,
      musicHasContent: hasMusic,
      musicDeepLink: "askbible://",
    },
  };
}

export function useShellMediaControlsSync(args: Args): void {
  const argsRef = useRef(args);
  argsRef.current = args;
  const lastReadingRef = useRef<ReadingWidgetState | null>(null);

  setShellMediaSessionLiveArgs(args);

  useEffect(() => {
    console.warn("[shell-media] sync hook mounted", {
      platform: Platform.OS,
      loading: args.loading,
      mode: args.playbackMode,
      playing: args.playing,
    });
    return subscribeShellMediaRemoteCommands({
      // 锁屏 / 通知媒体键：对当前正在播放的内容做纯暂停/续播（尊重当前模式）。
      onPlay: () => {
        const latest = argsRef.current;
        logRemoteCommand(`RemotePlay mode=${latest.playbackMode} playing=${latest.playing}`);
        if (latest.playing) return;
        if (latest.playbackMode === "music") {
          void latest.togglePlayMusic();
        } else {
          void latest.togglePlayScripture();
        }
      },
      onPause: () => {
        const latest = argsRef.current;
        logRemoteCommand(`RemotePause mode=${latest.playbackMode} playing=${latest.playing}`);
        if (latest.playbackMode === "music") {
          void latest.pauseShellPlayback();
        } else {
          void latest.togglePlayScripture({ forcePause: true });
        }
      },
      onToggle: () => {
        const latest = argsRef.current;
        logRemoteCommand(`RemoteToggle mode=${latest.playbackMode} playing=${latest.playing}`);
        if (latest.playbackMode === "music") {
          void latest.togglePlayMusic();
        } else {
          void latest.togglePlayScripture();
        }
      },
      onNext: () => {
        const latest = argsRef.current;
        logRemoteCommand(`RemoteNext mode=${latest.playbackMode} playing=${latest.playing}`);
        void latest.playNext();
      },
      onPrevious: () => {
        const latest = argsRef.current;
        logRemoteCommand(`RemotePrevious mode=${latest.playbackMode} playing=${latest.playing}`);
        void latest.playPrev();
      },
      // 桌面挂件「读经」键：只作用于本日读经音频，不碰音乐播放器。
      onReadingToggle: () => {
        const latest = argsRef.current;
        logRemoteCommand(`RemoteReadingToggle mode=${latest.playbackMode} playing=${latest.playing}`);
        if (latest.playbackMode === "scripture") {
          // 读经模式：纯暂停/续播。
          void latest.togglePlayScripture();
        } else {
          // 音乐 / 空闲：开始今日读经（切换到读经）。
          void latest.startReadingAudio();
        }
      },
      // 桌面挂件「音乐」键：播放/暂停音乐；非音乐模式时开始音乐（会释放读经）。
      onMusicToggle: () => {
        logRemoteCommand(`RemoteMusicToggle mode=${argsRef.current.playbackMode} playing=${argsRef.current.playing}`);
        void argsRef.current.togglePlayMusic();
      },
    });
  }, []);

  useWidgetPlaybackColdStart({
    loading: args.loading,
    tracks: args.tracks,
    trackIndex: args.trackIndex,
    playing: args.playing,
    playbackMode: args.playbackMode,
    playTrackAt: args.playTrackAt,
    startReadingAudio: args.startReadingAudio,
  });

  useEffect(() => {
    const payload = buildShellMediaSessionPayload(args);
    if (!payload) {
      syncShellMediaSession(null);
      return;
    }
    // 暂停时仍保留锁屏元数据，仅更新播放状态。
    if (!payload.playing && payload.positionSec <= 0 && payload.durationSec <= 0) {
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
    const { snapshot, nextReading } = buildPlaybackWidgetSnapshot(args, lastReadingRef.current);
    lastReadingRef.current = nextReading;
    syncPlaybackWidget(snapshot);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [args.playing, args.playbackMode, args.readChapter, args.tracks, args.trackIndex]);

  // iOS：系统可能清掉 Now Playing；播放中每秒刷新一次，保持锁屏 / 控制中心可见。
  useEffect(() => {
    if (Platform.OS !== "ios" || !args.playing) return;
    const tick = () => refreshShellMediaSession();
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
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
