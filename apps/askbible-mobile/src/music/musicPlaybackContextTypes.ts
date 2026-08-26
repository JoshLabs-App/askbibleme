import type { MusicCompanionStore, PlaybackTrack } from "./types";
import type { ReadChapterPlaybackRegistration, ScriptureAudioRepeatMode } from "./scripturePlaybackTypes";
import type { MusicPlaybackMode, MusicRepeatMode, ShellSleepTimerMinutes } from "./musicPlaybackTypes";

export type PlayTrackAtOptions = {
  autoPlay?: boolean;
};

export type MusicPlaybackContextValue = {
  store: MusicCompanionStore | null;
  tracks: PlaybackTrack[];
  trackIndex: number;
  playing: boolean;
  loading: boolean;
  playbackMode: MusicPlaybackMode;
  musicCurrentSec: number;
  musicDurationSec: number;
  canTogglePlayback: boolean;
  scriptureCurrentSec: number;
  scriptureDurationSec: number;
  readChapterAudioAvailable: boolean;
  scripturePreparing: boolean;
  scriptureAudioRepeatMode: ScriptureAudioRepeatMode;
  setScriptureAudioRepeatMode: (mode: ScriptureAudioRepeatMode) => void;
  scripturePlaybackRate: number;
  setScripturePlaybackRate: (rate: number) => Promise<void>;
  seekRatio: (ratio: number) => Promise<void>;
  registerReadChapter: (reg: ReadChapterPlaybackRegistration | null) => void;
  playTrackAt: (index: number, opts?: PlayTrackAtOptions) => Promise<boolean>;
  togglePlayScripture: (opts?: { forcePause?: boolean }) => Promise<boolean>;
  stopScripturePlayback: () => Promise<void>;
  playScriptureChapter: (args: {
    bookId: string;
    chapter: number;
    bookName: string;
    translationId: string;
    chapterAudioSrc?: string | null;
  }, opts?: { startAtSec?: number; endAtSec?: number; onSegmentEnd?: () => void }) => Promise<boolean>;
  togglePlayMusic: () => Promise<void>;
  setMusicGain: (gain: number) => Promise<void>;
  playNext: () => Promise<void>;
  playPrev: () => Promise<void>;
  musicRepeatMode: MusicRepeatMode;
  setMusicRepeatMode: (mode: MusicRepeatMode) => void;
  toggleMusicRepeatOne: () => void;
  toggleMusicRepeatAll: () => void;
  sleepTimerMinutes: 0 | ShellSleepTimerMinutes;
  setSleepTimerMinutes: (minutes: 0 | ShellSleepTimerMinutes) => void;
  pauseShellPlayback: () => Promise<void>;
  musicCatalogUpdateAvailable: boolean;
  checkMusicCatalogUpdate: () => Promise<boolean>;
  downloadMusicCatalogUpdate: () => Promise<boolean>;
  downloadingTrackId: string | null;
  downloadMusicTrackAt: (index: number) => Promise<boolean>;
  setReadHomeTodayScriptureReady: (ready: boolean) => void;
};
