import { Audio, type AVPlaybackStatus } from "expo-av";
import { Asset } from "expo-asset";
import { AppState, Platform, type AppStateStatus } from "react-native";
import {
  configureShellAudioMode,
  primeShellSoundPlayback,
  shellSoundDownloadFirst,
} from "../audio/shellAudioMode";
import {
  logShellSoundError,
  safeGetSoundStatus,
  safePauseSound,
  safePlaySound,
  safeSeekSoundRatio,
  safeStopAndUnloadSound,
} from "../audio/safeShellSound";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { readCuvChapterAudioVoice } from "../bible/cuv-chapter-audio-voice-prefs";
import { resolveChapterAudioExternalUrl } from "../bible/chapter-audio-sources";
import type { CuvChapterAudioVoiceId } from "../bible/cuv-chapter-audio-voices";
import { scriptureAudioUrlsEqual } from "../bible/cuv-chapter-audio";
import {
  resolveScripturePlayableSrcForChapter,
  translationSupportsChapterAudio,
} from "../bible/read-chapter-audio";
import { getNextScriptureChapterInBook } from "../bible/next-scripture-chapter";
import { resolveReadChapterNeighbors } from "../bible/read-chapter-neighbors";
import { getScriptureBookDisplayName } from "../bible/scripture-book-display-name";
import { getAskBibleBaseUrl } from "../config/askbibleBaseUrl";
import { isMobileBundledOnly } from "../config/mobileBundledOnly";
import {
  checkMusicResourcePackUpdate,
  downloadMusicTrackAssets,
  ensureMusicResourcePackSync,
  hydrateMusicResourcePackState,
  readSyncedMusicCompanionStore,
  subscribeMusicResourcePackChange,
} from "../media/musicResourcePackSync";
import {
  fetchMusicCompanionStoreFromRemote,
  getBundledMusicCompanionStore,
  hasMusicPlaybackActivated,
  isMusicCompanionStoreDifferent,
  markMusicPlaybackActivated,
  readCachedMusicCompanionStore,
  writeCachedMusicCompanionStore,
} from "./fetchMusicCompanion";
import { musicTrackAvSource } from "./musicTrackPlayback";
import { enrichPlaybackTracks, firstPlayableTrackIndex, isTrackPlayable } from "./trackArtwork";
import type { MusicCompanionStore, PlaybackTrack } from "./types";
import { trackTelemetry } from "../telemetry/client";
import {
  getActiveReadChapterPlayback,
  setActiveReadChapterPlayback,
} from "../read/read-chapter-playback-store";
import {
  normalizeScripturePlaybackRate,
  readMusicPlaybackResume,
  readScripturePlaybackRate,
  writeMusicPlaybackResume,
  writeScripturePlaybackRate,
} from "./music-playback-prefs";

export type ReadChapterPlaybackRegistration = {
  bookId: string;
  chapter: number;
  bookName: string;
  translationId: string;
  chapterAudioSrc: string | null;
  onAdvanceNextChapter: () => void;
  onAdvanceNextInBook: () => void;
};

export type ScriptureAudioRepeatMode = "off" | "chapter" | "book";

/** 与网站壳层睡眠定时器一致：到时仅暂停播放，不锁屏。 */
export type ShellSleepTimerMinutes = 15 | 30 | 60 | 120;
export type MusicRepeatMode = "off" | "one" | "all";
/** 场景/曲目切换：即时切歌（0 = 不淡化） */
const CALM_ALBUM_SWITCH_FADE_MS = 0;
/** 同曲目暂停/继续：即时响应 */
const CALM_ALBUM_PAUSE_FADE_MS = 0;
const CALM_ALBUMS = new Set(["专注工作", "睡眠"]);
const CALM_TRACK_END_TRIM_MS = 240;
const CALM_LOOP_CROSSFADE_MS = 520;
const CALM_LOOP_RESTART_OFFSET_MS = 120;
type CalmLoopProfile = {
  endTrimMs: number;
  crossfadeMs: number;
  restartOffsetMs: number;
  startOffsetMs?: number;
};

const CALM_TRACK_LOOP_PROFILE_BY_ID: Record<string, Partial<CalmLoopProfile>> = {
  // Relaxing Brown Noise: 切歌时去掉起播瞬态“哒”声。
  "track-mpkn1s6ax3sk": {
    startOffsetMs: 380,
    restartOffsetMs: 380,
  },
};

type PlaybackMode = "music" | "scripture";

type MusicPlaybackContextValue = {
  store: MusicCompanionStore | null;
  tracks: PlaybackTrack[];
  trackIndex: number;
  playing: boolean;
  loading: boolean;
  playbackMode: PlaybackMode;
  musicCurrentSec: number;
  musicDurationSec: number;
  canTogglePlayback: boolean;
  scriptureCurrentSec: number;
  scriptureDurationSec: number;
  readChapterAudioAvailable: boolean;
  /** 正在加载经文 MP3（尚未 isPlaying） */
  scripturePreparing: boolean;
  scriptureAudioRepeatMode: ScriptureAudioRepeatMode;
  setScriptureAudioRepeatMode: (mode: ScriptureAudioRepeatMode) => void;
  scripturePlaybackRate: number;
  setScripturePlaybackRate: (rate: number) => Promise<void>;
  seekRatio: (ratio: number) => Promise<void>;
  registerReadChapter: (reg: ReadChapterPlaybackRegistration | null) => void;
  playTrackAt: (index: number) => Promise<void>;
  /** 读经章快捷栏：整章朗读 */
  togglePlayScripture: () => Promise<void>;
  /** 指定章节朗读：用于首页等非读章入口，可选跳转到某秒。 */
  playScriptureChapter: (args: {
    bookId: string;
    chapter: number;
    bookName: string;
    translationId: string;
    chapterAudioSrc?: string | null;
  }, opts?: { startAtSec?: number; endAtSec?: number; onSegmentEnd?: () => void }) => Promise<boolean>;
  /** 底栏播放钮 / 首页 / 音乐：仅背景音乐 */
  togglePlayMusic: () => Promise<void>;
  /** 调整背景音乐增益（0~1），用于语音播报 ducking。 */
  setMusicGain: (gain: number) => Promise<void>;
  playNext: () => Promise<void>;
  playPrev: () => Promise<void>;
  musicRepeatMode: MusicRepeatMode;
  setMusicRepeatMode: (mode: MusicRepeatMode) => void;
  sleepTimerMinutes: 0 | ShellSleepTimerMinutes;
  setSleepTimerMinutes: (minutes: 0 | ShellSleepTimerMinutes) => void;
  musicCatalogUpdateAvailable: boolean;
  checkMusicCatalogUpdate: () => Promise<boolean>;
  downloadMusicCatalogUpdate: () => Promise<boolean>;
  downloadingTrackId: string | null;
  downloadMusicTrackAt: (index: number) => Promise<boolean>;
};

const MusicPlaybackContext = createContext<MusicPlaybackContextValue | null>(null);

function pickRandomNextTrackIndex(current: number, total: number): number {
  if (total <= 1) return 0;
  let next = current;
  for (let i = 0; i < 8 && next === current; i += 1) {
    next = Math.floor(Math.random() * total);
  }
  if (next === current) return (current + 1) % total;
  return next;
}

function pickRandomNextTrackIndexInAlbum(
  tracks: PlaybackTrack[],
  currentIndex: number,
  fallbackTotal: number,
): number {
  const current = tracks[currentIndex];
  const albumKey = (current?.album || "").trim();
  if (!albumKey) return pickRandomNextTrackIndex(currentIndex, fallbackTotal);
  const sameAlbumIndices = tracks
    .map((tr, idx) => ({ tr, idx }))
    .filter(({ tr }) => (tr.album || "").trim() === albumKey)
    .map(({ idx }) => idx);
  if (sameAlbumIndices.length <= 1) return currentIndex;
  const currentPos = sameAlbumIndices.findIndex((idx) => idx === currentIndex);
  if (currentPos < 0) return sameAlbumIndices[0] ?? currentIndex;
  let nextPos = currentPos;
  for (let i = 0; i < 8 && nextPos === currentPos; i += 1) {
    nextPos = Math.floor(Math.random() * sameAlbumIndices.length);
  }
  if (nextPos === currentPos) {
    nextPos = (currentPos + 1) % sameAlbumIndices.length;
  }
  return sameAlbumIndices[nextPos] ?? currentIndex;
}

function shouldUseCalmAlbumFade(track: PlaybackTrack | null | undefined): boolean {
  return CALM_ALBUMS.has((track?.album || "").trim());
}

function albumLabelForTrack(track: PlaybackTrack | null | undefined): string {
  return (track?.album || "").trim();
}

function resolveCalmSwitchFadeMs(
  prevTrack: PlaybackTrack | null,
  nextTrack: PlaybackTrack,
): { fadeOutMs: number; fadeInMs: number } {
  const switching =
    prevTrack?.id !== nextTrack.id ||
    albumLabelForTrack(prevTrack) !== albumLabelForTrack(nextTrack);
  if (!switching) {
    return { fadeOutMs: 0, fadeInMs: 0 };
  }
  return {
    fadeOutMs: shouldUseCalmAlbumFade(prevTrack) ? CALM_ALBUM_SWITCH_FADE_MS : 0,
    fadeInMs: shouldUseCalmAlbumFade(nextTrack) ? CALM_ALBUM_SWITCH_FADE_MS : 0,
  };
}

function resolveCalmLoopProfile(
  track: PlaybackTrack | null | undefined,
): CalmLoopProfile | null {
  if (!shouldUseCalmAlbumFade(track)) return null;
  const base: CalmLoopProfile = {
    endTrimMs: CALM_TRACK_END_TRIM_MS,
    crossfadeMs: CALM_LOOP_CROSSFADE_MS,
    restartOffsetMs: CALM_LOOP_RESTART_OFFSET_MS,
    startOffsetMs: 0,
  };
  const byId = track?.id ? CALM_TRACK_LOOP_PROFILE_BY_ID[track.id] : undefined;
  if (!byId) return base;
  return { ...base, ...byId };
}

async function fadeSoundVolume(
  sound: Audio.Sound,
  from: number,
  to: number,
  durationMs: number,
): Promise<void> {
  const steps = 24;
  const stepMs = Math.max(16, Math.floor(durationMs / steps));
  try {
    await sound.setVolumeAsync(from);
  } catch {
    return;
  }
  for (let i = 1; i <= steps; i += 1) {
    const t = i / steps;
    // smoothstep: 比线性更自然，过渡头尾不“切”。
    const eased = t * t * (3 - 2 * t);
    const next = from + (to - from) * eased;
    try {
      await sound.setVolumeAsync(next);
    } catch {
      return;
    }
    if (i < steps) {
      await new Promise<void>((resolve) => setTimeout(resolve, stepMs));
    }
  }
}

function hasAtLeastBundledTracks(
  candidate: MusicCompanionStore | null | undefined,
  bundled: MusicCompanionStore,
): candidate is MusicCompanionStore {
  if (!candidate) return false;
  const candidateCount = Array.isArray(candidate.audioTracks) ? candidate.audioTracks.length : 0;
  const bundledCount = Array.isArray(bundled.audioTracks) ? bundled.audioTracks.length : 0;
  return candidateCount >= bundledCount;
}

export function MusicPlaybackProvider({ children }: { children: ReactNode }) {
  const [store, setStore] = useState<MusicCompanionStore | null>(null);
  const [trackIndex, setTrackIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [playbackMode, setPlaybackMode] = useState<PlaybackMode>("music");
  const [readChapter, setReadChapter] = useState<ReadChapterPlaybackRegistration | null>(null);
  const [scriptureCurrentSec, setScriptureCurrentSec] = useState(0);
  const [scriptureDurationSec, setScriptureDurationSec] = useState(0);
  const [scriptureAudioRepeatMode, setScriptureAudioRepeatModeState] =
    useState<ScriptureAudioRepeatMode>("off");
  const [scripturePlaybackRate, setScripturePlaybackRateState] = useState(1);
  const [scripturePreparing, setScripturePreparing] = useState(false);
  const [musicCurrentSec, setMusicCurrentSec] = useState(0);
  const [musicDurationSec, setMusicDurationSec] = useState(0);
  const [musicRepeatMode, setMusicRepeatModeState] = useState<MusicRepeatMode>("all");
  const [sleepTimerMinutes, setSleepTimerMinutesState] = useState<0 | ShellSleepTimerMinutes>(0);
  const [musicCatalogUpdateAvailable, setMusicCatalogUpdateAvailable] = useState(false);
  const [musicPackRevision, setMusicPackRevision] = useState(0);
  const [downloadingTrackId, setDownloadingTrackId] = useState<string | null>(null);

  const soundRef = useRef<Audio.Sound | null>(null);
  const sleepTimerDeadlineRef = useRef<number | null>(null);
  /** 每路 Sound 独立 id，忽略已卸载实例的状态回调（避免重音 / 关不掉） */
  const activeSoundIdRef = useRef(0);
  const playbackEpochRef = useRef(0);
  const scripturePlayInFlightRef = useRef<Promise<void> | null>(null);
  const playbackModeRef = useRef<PlaybackMode>("music");
  const trackIndexRef = useRef(0);
  const scriptureSrcRef = useRef<string | null>(null);
  const scriptureStopAtSecRef = useRef<number | null>(null);
  const scriptureStopAtOnEndedRef = useRef<(() => void) | null>(null);
  const autoPlayScriptureRef = useRef(false);
  const readChapterRef = useRef<ReadChapterPlaybackRegistration | null>(null);
  const scriptureAudioRepeatRef = useRef<ScriptureAudioRepeatMode>("off");
  const scripturePlaybackRateRef = useRef(1);
  const playTrackAtRef = useRef<(index: number) => Promise<void>>(async () => {});
  const musicSessionRef = useRef<{ trackId: string; startedAt: number } | null>(null);
  const calmLoopTransitioningRef = useRef(false);
  const playTrackGenerationRef = useRef(0);
  const resumeTrackIdRef = useRef<string | null>(null);
  const resumePositionSecRef = useRef<number>(0);
  const playbackResumeHydratedRef = useRef(false);
  const lastMusicPersistMsRef = useRef(0);
  const musicRepeatModeRef = useRef<MusicRepeatMode>("all");
  const musicGainRef = useRef(1);
  const latestRemoteMusicStoreRef = useRef<MusicCompanionStore | null>(null);
  const failedTrackIdsRef = useRef<Set<string>>(new Set());

  const endMusicSession = useCallback(() => {
    const s = musicSessionRef.current;
    if (!s) return;
    musicSessionRef.current = null;
    trackTelemetry("music_session", {
      track_id: s.trackId,
      duration_ms: Date.now() - s.startedAt,
    });
  }, []);
  const baseUrl = useMemo(() => getAskBibleBaseUrl(), []);

  const tracks = useMemo(
    () => (store ? enrichPlaybackTracks(store, baseUrl) : []),
    [store, baseUrl, musicPackRevision],
  );

  useEffect(() => subscribeMusicResourcePackChange(() => setMusicPackRevision((n) => n + 1)), []);
  const storeRef = useRef<MusicCompanionStore | null>(null);
  storeRef.current = store;

  trackIndexRef.current = trackIndex;
  playbackModeRef.current = playbackMode;
  scriptureAudioRepeatRef.current = scriptureAudioRepeatMode;
  scripturePlaybackRateRef.current = scripturePlaybackRate;
  musicRepeatModeRef.current = musicRepeatMode;

  const persistMusicResume = useCallback(
    async (trackId: string, positionSec: number) => {
      const normalizedTrackId = trackId.trim();
      if (!normalizedTrackId) return;
      const normalizedSec = Number.isFinite(positionSec) ? Math.max(0, positionSec) : 0;
      resumeTrackIdRef.current = normalizedTrackId;
      resumePositionSecRef.current = normalizedSec;
      try {
        await writeMusicPlaybackResume({ trackId: normalizedTrackId, positionSec: normalizedSec });
      } catch {
        /* ignore local storage write failures */
      }
    },
    [],
  );

  const setScriptureAudioRepeatMode = useCallback((mode: ScriptureAudioRepeatMode) => {
    scriptureAudioRepeatRef.current = mode;
    setScriptureAudioRepeatModeState(mode);
  }, []);

  const setScripturePlaybackRate = useCallback(async (rate: number) => {
    const normalized = normalizeScripturePlaybackRate(rate);
    scripturePlaybackRateRef.current = normalized;
    setScripturePlaybackRateState(normalized);
    try {
      await writeScripturePlaybackRate(normalized);
    } catch {
      /* ignore local storage write failures */
    }
    const sound = soundRef.current;
    if (!sound || playbackModeRef.current !== "scripture") return;
    try {
      await sound.setRateAsync(normalized, true);
    } catch (err) {
      logShellSoundError("setScripturePlaybackRate", err);
    }
  }, []);

  const setMusicRepeatMode = useCallback((mode: MusicRepeatMode) => {
    musicRepeatModeRef.current = mode;
    setMusicRepeatModeState(mode);
  }, []);

  const pauseShellPlayback = useCallback(async () => {
    const sound = soundRef.current;
    if (!sound) {
      setPlaying(false);
      return;
    }
    await safePauseSound(sound);
    setPlaying(false);
  }, []);

  const setSleepTimerMinutes = useCallback((minutes: 0 | ShellSleepTimerMinutes) => {
    setSleepTimerMinutesState(minutes);
    if (minutes === 0) {
      sleepTimerDeadlineRef.current = null;
      return;
    }
    sleepTimerDeadlineRef.current = Date.now() + minutes * 60 * 1000;
  }, []);

  useEffect(() => {
    void readScripturePlaybackRate().then((rate) => {
      const normalized = normalizeScripturePlaybackRate(rate);
      scripturePlaybackRateRef.current = normalized;
      setScripturePlaybackRateState(normalized);
    });
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      const d = sleepTimerDeadlineRef.current;
      if (d == null || Date.now() < d) return;
      sleepTimerDeadlineRef.current = null;
      setSleepTimerMinutesState(0);
      void pauseShellPlayback();
    }, 1000);
    return () => clearInterval(id);
  }, [pauseShellPlayback]);

  const seekRatio = useCallback(async (ratio: number) => {
    const sound = soundRef.current;
    if (!sound) return;
    const st = await safeGetSoundStatus(sound);
    if (!st?.isLoaded || st.durationMillis == null || st.durationMillis <= 0) return;
    const clamped = Math.max(0, Math.min(1, ratio));
    const ok = await safeSeekSoundRatio(sound, clamped);
    if (!ok) return;
    const sec = clamped * (st.durationMillis / 1000);
    if (playbackModeRef.current === "music") {
      setMusicCurrentSec(sec);
    } else {
      setScriptureCurrentSec(sec);
    }
  }, []);

  const setMusicGain = useCallback(async (gain: number) => {
    const next = Math.max(0, Math.min(1, Number(gain)));
    musicGainRef.current = next;
    const sound = soundRef.current;
    if (!sound || playbackModeRef.current !== "music") return;
    const st = await safeGetSoundStatus(sound);
    if (!st?.isLoaded) return;
    try {
      await sound.setVolumeAsync(next);
    } catch (err) {
      logShellSoundError("setMusicGain", err);
    }
  }, []);

  useEffect(() => {
    const loadingGuard = setTimeout(() => setLoading(false), 4000);
    void (async () => {
      setLoading(true);
      try {
        const audioModeWarmup = Promise.race([
          configureShellAudioMode(),
          new Promise<void>((resolve) => setTimeout(resolve, 1200)),
        ]);
        // 启动先用内置曲库，保证秒开；再按条件覆盖本机缓存与线上新数据。
        const bundledStore = getBundledMusicCompanionStore();
        setStore(bundledStore);
        if (isMobileBundledOnly()) {
          const tracks = enrichPlaybackTracks(bundledStore, getAskBibleBaseUrl());
          setTrackIndex(firstPlayableTrackIndex(tracks));
          await new Promise<void>((resolve) => setTimeout(resolve, 480));
          await audioModeWarmup;
          return;
        }
        await hydrateMusicResourcePackState();
        const syncedStore = await readSyncedMusicCompanionStore();
        const cachedStore = await readCachedMusicCompanionStore();
        const remote = await fetchMusicCompanionStoreFromRemote();
        const nextStore =
          remote && hasAtLeastBundledTracks(remote, bundledStore)
            ? remote
            : syncedStore && hasAtLeastBundledTracks(syncedStore, bundledStore)
              ? syncedStore
              : cachedStore && hasAtLeastBundledTracks(cachedStore, bundledStore)
                ? cachedStore
                : bundledStore;
        setStore(nextStore);
        if (nextStore !== bundledStore) {
          await writeCachedMusicCompanionStore(nextStore);
        }
        void audioModeWarmup;
      } finally {
        setLoading(false);
      }
    })();
    return () => {
      clearTimeout(loadingGuard);
      const sound = soundRef.current;
      soundRef.current = null;
      if (sound) void safeStopAndUnloadSound(sound);
    };
  }, []);

  useEffect(() => {
    if (!isMobileBundledOnly() || tracks.length === 0) return;
    const current = tracks[trackIndex];
    if (current?.localReady) return;
    const next = firstPlayableTrackIndex(tracks);
    if (next !== trackIndex) setTrackIndex(next);
  }, [tracks, trackIndex]);

  const checkMusicCatalogUpdate = useCallback(async (): Promise<boolean> => {
    if (isMobileBundledOnly()) {
      latestRemoteMusicStoreRef.current = null;
      setMusicCatalogUpdateAvailable(false);
      return false;
    }
    const packCheck = await checkMusicResourcePackUpdate();
    if (packCheck.available) {
      setMusicCatalogUpdateAvailable(true);
      return true;
    }
    const bundled = getBundledMusicCompanionStore();
    const current = storeRef.current ?? bundled;
    const remote = await fetchMusicCompanionStoreFromRemote();
    if (!remote || !hasAtLeastBundledTracks(remote, bundled)) {
      latestRemoteMusicStoreRef.current = null;
      setMusicCatalogUpdateAvailable(false);
      return false;
    }
    const available = isMusicCompanionStoreDifferent(remote, current);
    latestRemoteMusicStoreRef.current = available ? remote : null;
    setMusicCatalogUpdateAvailable(available);
    return available;
  }, []);

  const downloadMusicCatalogUpdate = useCallback(async (): Promise<boolean> => {
    if (isMobileBundledOnly()) {
      latestRemoteMusicStoreRef.current = null;
      setMusicCatalogUpdateAvailable(false);
      return false;
    }
    const bundled = getBundledMusicCompanionStore();
    const current = storeRef.current ?? bundled;
    let remote = latestRemoteMusicStoreRef.current;
    if (!remote || !isMusicCompanionStoreDifferent(remote, current)) {
      remote = await fetchMusicCompanionStoreFromRemote();
    }
    const synced = await ensureMusicResourcePackSync({ force: true });
    const syncedStore = (await readSyncedMusicCompanionStore()) ?? remote;
    const nextStore =
      syncedStore && hasAtLeastBundledTracks(syncedStore, bundled)
        ? syncedStore
        : remote && hasAtLeastBundledTracks(remote, bundled)
          ? remote
          : null;
    if (!synced && !nextStore) {
      latestRemoteMusicStoreRef.current = null;
      setMusicCatalogUpdateAvailable(false);
      return false;
    }
    if (nextStore) {
      const currentTrackId = tracks[trackIndexRef.current]?.id ?? "";
      const nextTrackIndex = nextStore.audioTracks.findIndex((x) => x.id === currentTrackId);
      setStore(nextStore);
      storeRef.current = nextStore;
      setTrackIndex(nextTrackIndex >= 0 ? nextTrackIndex : 0);
      await writeCachedMusicCompanionStore(nextStore);
    }
    latestRemoteMusicStoreRef.current = null;
    setMusicCatalogUpdateAvailable(false);
    return synced || Boolean(nextStore);
  }, [tracks]);

  useEffect(() => {
    if (loading) return;
    void checkMusicCatalogUpdate();
  }, [loading, checkMusicCatalogUpdate]);

  useEffect(() => {
    if (tracks.length === 0 || playbackResumeHydratedRef.current) return;
    playbackResumeHydratedRef.current = true;
    void (async () => {
      const saved = await readMusicPlaybackResume();
      if (!saved) return;
      let idx = tracks.findIndex((x) => x.id === saved.trackId);
      if (idx < 0) return;
      if (isMobileBundledOnly() && !tracks[idx]?.localReady) {
        idx = firstPlayableTrackIndex(tracks);
      }
      resumeTrackIdRef.current = tracks[idx]?.id ?? saved.trackId;
      resumePositionSecRef.current = Math.max(0, saved.positionSec);
      setTrackIndex(idx);
      setMusicCurrentSec(Math.max(0, saved.positionSec));
    })();
  }, [tracks]);

  useEffect(() => {
    const onAppState = (state: AppStateStatus) => {
      if (state !== "active") return;
      void configureShellAudioMode();
    };
    const sub = AppState.addEventListener("change", onAppState);
    return () => sub.remove();
  }, []);

  const unloadCurrent = useCallback(async () => {
    playbackEpochRef.current += 1;
    activeSoundIdRef.current += 1;
    const sound = soundRef.current;
    soundRef.current = null;
    if (!sound) return;
    await safeStopAndUnloadSound(sound);
  }, []);

  const stopScripturePlayback = useCallback(async () => {
    setScripturePreparing(false);
    endMusicSession();
    await unloadCurrent();
    scriptureSrcRef.current = null;
    scriptureStopAtSecRef.current = null;
    setScriptureCurrentSec(0);
    setScriptureDurationSec(0);
    setPlaying(false);
    setPlaybackMode("music");
    playbackModeRef.current = "music";
  }, [unloadCurrent, endMusicSession]);

  const cacheMusicTrackInBackground = useCallback((trackId: string) => {
    if (isMobileBundledOnly()) return;
    const storeTrack = storeRef.current?.audioTracks.find((t) => t.id === trackId);
    if (!storeTrack) return;
    setDownloadingTrackId(trackId);
    void downloadMusicTrackAssets({
      src: storeTrack.src,
      analysisSrc: storeTrack.analysisSrc,
    })
      .then((ok) => {
        if (ok) setMusicPackRevision((n) => n + 1);
      })
      .finally(() => {
        setDownloadingTrackId((current) => (current === trackId ? null : current));
      });
  }, []);

  const downloadMusicTrackAt = useCallback(
    async (index: number): Promise<boolean> => {
      if (tracks.length === 0) return false;
      const i = ((index % tracks.length) + tracks.length) % tracks.length;
      const track = tracks[i];
      if (!track || track.localReady) return true;
      const storeTrack = storeRef.current?.audioTracks.find((t) => t.id === track.id);
      if (!storeTrack) return false;
      setDownloadingTrackId(track.id);
      try {
        const ok = await downloadMusicTrackAssets({
          src: storeTrack.src,
          analysisSrc: storeTrack.analysisSrc,
        });
        if (ok) setMusicPackRevision((n) => n + 1);
        return ok;
      } finally {
        setDownloadingTrackId((current) => (current === track.id ? null : current));
      }
    },
    [tracks],
  );

  const playTrackAt = useCallback(
    async (index: number) => {
      if (tracks.length === 0) return;
      const generation = ++playTrackGenerationRef.current;
      const i = ((index % tracks.length) + tracks.length) % tracks.length;
      const track = tracks[i]!;
      const avSource = musicTrackAvSource(track);
      if (!track.localReady && !isMobileBundledOnly()) {
        cacheMusicTrackInBackground(track.id);
      }
      if (avSource == null) {
        const missingId = track.id.trim();
        if (missingId) failedTrackIdsRef.current.add(missingId);
        // 当前曲目在本地包中不可播（例如轻量包未包含该文件）时，自动跳到下一首可播曲目。
        const fallbackCandidates: number[] = [];
        for (let k = 0; k < tracks.length; k += 1) {
          if (k === i) continue;
          const candidate = tracks[k];
          if (!candidate) continue;
          const tid = candidate.id.trim();
          if (!tid || failedTrackIdsRef.current.has(tid)) continue;
          if (!isTrackPlayable(candidate)) continue;
          const candidateSource = musicTrackAvSource(candidate);
          if (candidateSource == null) {
            failedTrackIdsRef.current.add(tid);
            continue;
          }
          fallbackCandidates.push(k);
        }
        const fallbackIndex = fallbackCandidates[0];
        if (fallbackIndex != null) {
          void playTrackAtRef.current(fallbackIndex);
          return;
        }
        if (failedTrackIdsRef.current.size >= tracks.length) {
          failedTrackIdsRef.current.clear();
        }
        setPlaying(false);
        return;
      }
      // iOS：直连 require() 模块；Android 再尝试 Asset 本地 URI（部分机型对大包更稳）。
      if (track.bundledModule != null && Platform.OS === "android") {
        try {
          const [asset] = await Asset.loadAsync(track.bundledModule);
          const localUri = (asset?.localUri || asset?.uri || "").trim();
          if (localUri) {
            avSource = { uri: localUri };
          }
        } catch {
          // bundled 资源预热失败时，回退到原始 avSource 继续尝试播放。
        }
      }
      calmLoopTransitioningRef.current = false;
      const prevTrack = tracks[trackIndexRef.current] ?? null;
      const { fadeOutMs, fadeInMs } = resolveCalmSwitchFadeMs(prevTrack, track);
      endMusicSession();
      if (playbackModeRef.current === "music" && fadeOutMs > 0) {
        const currentSound = soundRef.current;
        if (currentSound) {
          const currentStatus = await safeGetSoundStatus(currentSound);
          const fromVolume =
            currentStatus?.isLoaded && typeof currentStatus.volume === "number"
              ? currentStatus.volume
              : musicGainRef.current;
          await fadeSoundVolume(currentSound, fromVolume, 0, fadeOutMs);
        }
      }
      if (generation !== playTrackGenerationRef.current) return;
      await unloadCurrent();
      if (generation !== playTrackGenerationRef.current) return;
      await configureShellAudioMode();
      setMusicCurrentSec(0);
      setMusicDurationSec(0);
      const epoch = playbackEpochRef.current;
      const soundId = ++activeSoundIdRef.current;
      const resumeSecForTrack =
        resumeTrackIdRef.current === track.id ? Math.max(0, resumePositionSecRef.current) : 0;
      const calmLoopProfileForTrack = resolveCalmLoopProfile(track);
      let sound: Audio.Sound;
      try {
        const created = await Audio.Sound.createAsync(
          avSource,
          {
            shouldPlay: false,
            progressUpdateIntervalMillis: 120,
            volume: fadeInMs > 0 ? 0 : musicGainRef.current,
            isMuted: false,
          },
          (status: AVPlaybackStatus) => {
            if (soundId !== activeSoundIdRef.current || epoch !== playbackEpochRef.current) return;
            if (!status.isLoaded) return;
            setPlaying(status.isPlaying);
            if (playbackModeRef.current === "music") {
              const calmLoopProfile = resolveCalmLoopProfile(track);
              const shouldTrimTail =
                calmLoopProfile != null &&
                musicRepeatModeRef.current === "one" &&
                (status.durationMillis ?? 0) > calmLoopProfile.endTrimMs + 80;
              setMusicCurrentSec(status.positionMillis / 1000);
              setMusicDurationSec(
                status.durationMillis != null
                  ? Math.max(
                      0,
                      (status.durationMillis - (shouldTrimTail ? calmLoopProfile.endTrimMs : 0)) / 1000,
                    )
                  : 0,
              );
              if (shouldTrimTail && status.durationMillis != null && calmLoopProfile != null) {
                const trimAtMs = Math.max(0, status.durationMillis - calmLoopProfile.endTrimMs);
                const releaseAtMs = Math.max(0, trimAtMs - 420);
                if (
                  !calmLoopTransitioningRef.current &&
                  status.positionMillis >= trimAtMs
                ) {
                  calmLoopTransitioningRef.current = true;
                  const active = soundRef.current;
                  if (active) {
                    const fromVolume =
                      typeof status.volume === "number" ? status.volume : musicGainRef.current;
                    void (async () => {
                      await fadeSoundVolume(active, fromVolume, 0, calmLoopProfile.crossfadeMs);
                      try {
                        await active.setPositionAsync(calmLoopProfile.restartOffsetMs);
                        await active.setVolumeAsync(0);
                      } catch {
                        calmLoopTransitioningRef.current = false;
                        return;
                      }
                      const ok = await safePlaySound(active);
                      if (!ok) {
                        calmLoopTransitioningRef.current = false;
                        setPlaying(false);
                        return;
                      }
                      await fadeSoundVolume(
                        active,
                        0,
                        musicGainRef.current,
                        calmLoopProfile.crossfadeMs,
                      );
                      calmLoopTransitioningRef.current = false;
                      setPlaying(true);
                    })();
                  }
                  return;
                }
                if (status.positionMillis < releaseAtMs) {
                  calmLoopTransitioningRef.current = false;
                }
              }
              const now = Date.now();
              if (now - lastMusicPersistMsRef.current > 1800 || !status.isPlaying) {
                lastMusicPersistMsRef.current = now;
                void persistMusicResume(track.id, status.positionMillis / 1000);
              }
            }
            if (status.didJustFinish && playbackModeRef.current === "music") {
              if (musicRepeatModeRef.current === "one") {
                const active = soundRef.current;
                if (active) {
                  const calmLoopProfile = resolveCalmLoopProfile(track);
                  if (calmLoopProfile != null) {
                    if (calmLoopTransitioningRef.current) return;
                    const fromVolume =
                      typeof status.volume === "number" ? status.volume : musicGainRef.current;
                    calmLoopTransitioningRef.current = true;
                    void (async () => {
                      await fadeSoundVolume(active, fromVolume, 0, calmLoopProfile.crossfadeMs);
                      try {
                        await active.setPositionAsync(calmLoopProfile.restartOffsetMs);
                        await active.setVolumeAsync(0);
                      } catch (err) {
                        calmLoopTransitioningRef.current = false;
                        logShellSoundError("music-repeat-one-calm-seek", err);
                        return;
                      }
                      const ok = await safePlaySound(active);
                      if (!ok) {
                        calmLoopTransitioningRef.current = false;
                        setPlaying(false);
                        return;
                      }
                      await fadeSoundVolume(active, 0, musicGainRef.current, calmLoopProfile.crossfadeMs);
                      calmLoopTransitioningRef.current = false;
                      setPlaying(true);
                    })().catch((err) => {
                      calmLoopTransitioningRef.current = false;
                      logShellSoundError("music-repeat-one-calm", err);
                    });
                  } else {
                    void active
                      .setPositionAsync(0)
                      .then(() => safePlaySound(active))
                      .catch((err) => logShellSoundError("music-repeat-one", err));
                  }
                }
                setPlaying(true);
                return;
              }
              if (musicRepeatModeRef.current === "all") {
                const next = pickRandomNextTrackIndexInAlbum(
                  tracks,
                  trackIndexRef.current,
                  tracks.length,
                );
                void playTrackAtRef.current(next);
                return;
              }
              setPlaying(false);
            }
          },
          shellSoundDownloadFirst(avSource),
        );
        sound = created.sound;
        await primeShellSoundPlayback(sound);
        if (resumeSecForTrack > 0) {
          await sound.setPositionAsync(Math.floor(resumeSecForTrack * 1000));
          setMusicCurrentSec(resumeSecForTrack);
        } else if (
          (calmLoopProfileForTrack?.startOffsetMs ?? 0) > 0
        ) {
          const startOffsetMs = Math.max(0, Math.floor(calmLoopProfileForTrack?.startOffsetMs ?? 0));
          await sound.setPositionAsync(startOffsetMs);
          setMusicCurrentSec(startOffsetMs / 1000);
        } else {
          setMusicCurrentSec(0);
        }
        const resumedPlay = await safePlaySound(sound);
        if (!resumedPlay) {
          setPlaying(false);
          await safeStopAndUnloadSound(sound);
          return;
        }
        if (fadeInMs > 0) {
          await fadeSoundVolume(sound, 0, musicGainRef.current, fadeInMs);
        }
        if (generation !== playTrackGenerationRef.current) {
          await sound.unloadAsync();
          return;
        }
      } catch (err) {
        logShellSoundError("playTrackAt", err);
        const failedId = track.id.trim();
        if (failedId) failedTrackIdsRef.current.add(failedId);
        // 某个源不可播（超时/损坏）时自动跳到下一首可疑似可播源，避免用户点击播放无响应。
        const fallbackCandidates: number[] = [];
        for (let k = 0; k < tracks.length; k += 1) {
          if (k === i) continue;
          const tid = tracks[k]?.id?.trim() ?? "";
          if (!tid || failedTrackIdsRef.current.has(tid)) continue;
          fallbackCandidates.push(k);
        }
        const fallbackIndex = fallbackCandidates[0];
        if (fallbackIndex != null) {
          void playTrackAtRef.current(fallbackIndex);
          return;
        }
        if (failedTrackIdsRef.current.size >= tracks.length) {
          failedTrackIdsRef.current.clear();
        }
        setPlaying(false);
        return;
      }
      if (epoch !== playbackEpochRef.current || soundId !== activeSoundIdRef.current) {
        await sound.unloadAsync();
        return;
      }
      soundRef.current = sound;
      setTrackIndex(i);
      setPlaybackMode("music");
      playbackModeRef.current = "music";
      scriptureSrcRef.current = null;
      setPlaying(true);
      failedTrackIdsRef.current.delete(track.id.trim());
      resumeTrackIdRef.current = track.id;
      resumePositionSecRef.current = 0;
      trackTelemetry("music_play", { track_id: track.id });
      musicSessionRef.current = { trackId: track.id, startedAt: Date.now() };
      void (async () => {
        await markMusicPlaybackActivated();
        const snapshot = storeRef.current;
        if (snapshot?.audioTracks?.length) {
          await writeCachedMusicCompanionStore(snapshot);
        }
      })();
    },
    [tracks, unloadCurrent, endMusicSession, persistMusicResume, cacheMusicTrackInBackground],
  );

  playTrackAtRef.current = playTrackAt;

  const playScripture = useCallback(
    async (src: string) => {
      const trimmed = src.trim();
      if (!trimmed) return;

      const prev = scripturePlayInFlightRef.current;
      if (prev) {
        try {
          await prev;
        } catch {
          /* superseded */
        }
      }

      const run = async () => {
        await unloadCurrent();
        await configureShellAudioMode();
        const epoch = playbackEpochRef.current;

        scriptureSrcRef.current = trimmed;
        scriptureStopAtSecRef.current = null;
        scriptureStopAtOnEndedRef.current = null;
        setPlaybackMode("scripture");
        playbackModeRef.current = "scripture";
        setScripturePreparing(true);

        const soundId = ++activeSoundIdRef.current;
        let sound: Audio.Sound;
        try {
          const scriptureSource = { uri: trimmed };
          if (__DEV__) {
            console.warn("[scripture-audio] playScripture source", trimmed);
          }
          const created = await Audio.Sound.createAsync(
            scriptureSource,
            {
              shouldPlay: true,
              progressUpdateIntervalMillis: 350,
              volume: 1,
              isMuted: false,
              rate: scripturePlaybackRateRef.current,
              shouldCorrectPitch: true,
            },
            (status: AVPlaybackStatus) => {
              if (soundId !== activeSoundIdRef.current) return;
              if (!status.isLoaded) {
                if ("error" in status && status.error) {
                  setPlaying(false);
                }
                return;
              }
              setPlaying(status.isPlaying);
              setScriptureCurrentSec(status.positionMillis / 1000);
              setScriptureDurationSec(
                status.durationMillis != null ? status.durationMillis / 1000 : 0,
              );
              const stopAtSec = scriptureStopAtSecRef.current;
              if (
                stopAtSec != null &&
                Number.isFinite(stopAtSec) &&
                status.positionMillis >= Math.max(0, Math.floor((stopAtSec - 0.06) * 1000))
              ) {
                scriptureStopAtSecRef.current = null;
                const active = soundRef.current;
                if (active) {
                  void active
                    .setPositionAsync(Math.max(0, Math.floor(stopAtSec * 1000)))
                    .catch((err) => logShellSoundError("scripture-stopAt-seek", err));
                  void safePauseSound(active).catch((err) =>
                    logShellSoundError("scripture-stopAt-pause", err),
                  );
                }
                setPlaying(false);
                const onSegmentEnd = scriptureStopAtOnEndedRef.current;
                scriptureStopAtOnEndedRef.current = null;
                if (onSegmentEnd) {
                  setTimeout(() => onSegmentEnd(), 80);
                }
                return;
              }
              if (status.didJustFinish) {
                const mode = scriptureAudioRepeatRef.current;
                const rc = readChapterRef.current;
                if (!rc) {
                  setPlaying(false);
                  return;
                }
                if (mode === "chapter") {
                  const active = soundRef.current;
                  if (active) {
                    void active
                      .setPositionAsync(0)
                      .then(() => safePlaySound(active))
                      .catch((err) => logShellSoundError("scripture-repeat", err));
                  }
                  setPlaying(true);
                  return;
                }
                if (mode === "book") {
                  const next = getNextScriptureChapterInBook(rc.bookId, rc.chapter);
                  if (next) {
                    autoPlayScriptureRef.current = true;
                    rc.onAdvanceNextInBook();
                    return;
                  }
                }
                setPlaying(false);
                autoPlayScriptureRef.current = true;
                rc.onAdvanceNextChapter();
              }
            },
            shellSoundDownloadFirst(scriptureSource),
          );
          sound = created.sound;
          await primeShellSoundPlayback(sound);
        } catch (err) {
          if (epoch === playbackEpochRef.current) {
            scriptureSrcRef.current = null;
            setPlaybackMode("music");
            playbackModeRef.current = "music";
            setPlaying(false);
          }
          setScripturePreparing(false);
          logShellSoundError("playScripture-create", err);
          if (__DEV__) {
            console.warn("[scripture-audio] play failed:", trimmed, err);
          }
          return;
        }

        if (epoch !== playbackEpochRef.current || soundId !== activeSoundIdRef.current) {
          await sound.unloadAsync();
          setScripturePreparing(false);
          return;
        }

        soundRef.current = sound;
        setPlaying(true);
        setScripturePreparing(false);
      };

      const op = run();
      scripturePlayInFlightRef.current = op;
      try {
        await op;
      } finally {
        if (scripturePlayInFlightRef.current === op) {
          scripturePlayInFlightRef.current = null;
        }
      }
    },
    [unloadCurrent],
  );

  const patchReadChapterSrc = useCallback((src: string) => {
    const rc = readChapterRef.current;
    if (!rc || !src.trim()) return;
    if (rc.chapterAudioSrc?.trim() === src.trim()) return;
    const next = { ...rc, chapterAudioSrc: src.trim() };
    readChapterRef.current = next;
    setReadChapter(next);
  }, []);

  const tryPlayScriptureWithFallback = useCallback(
    async (reg: ReadChapterPlaybackRegistration, preferredSrc: string): Promise<void> => {
      if (__DEV__) {
        console.warn("[scripture-audio] try primary src", preferredSrc);
      }
      await playScripture(preferredSrc);
      const started =
        playbackModeRef.current === "scripture" &&
        soundRef.current != null &&
        scriptureSrcRef.current != null;
      if (started) return;

      const voiceId = await readCuvChapterAudioVoice();
      const externalSrc = resolveChapterAudioExternalUrl({
        translationId: reg.translationId,
        bookId: reg.bookId,
        chapter: reg.chapter,
        voiceId,
      });
      const fallbackSrc =
        externalSrc && !scriptureAudioUrlsEqual(externalSrc, preferredSrc)
          ? externalSrc
          : await resolveScripturePlayableSrcForChapter({
              translationId: reg.translationId,
              bookId: reg.bookId,
              chapter: reg.chapter,
              bookName: reg.bookName,
              voiceId,
              // 首次直播失败后，跳过当前缓存源，强制重算可播链接。
              cachedSrc: null,
            });
      if (!fallbackSrc || scriptureAudioUrlsEqual(fallbackSrc, preferredSrc)) {
        if (__DEV__) {
          console.warn("[scripture-audio] no fallback src", reg.bookId, reg.chapter, reg.translationId);
        }
        return;
      }

      if (__DEV__) {
        console.warn("[scripture-audio] fallback src", fallbackSrc);
      }
      patchReadChapterSrc(fallbackSrc);
      await playScripture(fallbackSrc);
    },
    [patchReadChapterSrc, playScripture],
  );

  const registerReadChapter = useCallback((reg: ReadChapterPlaybackRegistration | null) => {
    const prev = readChapterRef.current;
    readChapterRef.current = reg;
    setActiveReadChapterPlayback(reg);
    setReadChapter(reg);

    if (!reg) {
      if (playbackModeRef.current === "scripture") {
        void stopScripturePlayback().catch((err) => logShellSoundError("stop-on-unregister", err));
      }
      return;
    }

    if (reg.chapterAudioSrc && autoPlayScriptureRef.current) {
      autoPlayScriptureRef.current = false;
      void tryPlayScriptureWithFallback(reg, reg.chapterAudioSrc).catch((err) =>
        logShellSoundError("auto-play-scripture", err),
      );
      return;
    }

    const sameChapter =
      prev?.bookId === reg.bookId &&
      prev?.chapter === reg.chapter &&
      prev?.translationId === reg.translationId;
    const sameSrc =
      Boolean(reg.chapterAudioSrc) &&
      Boolean(scriptureSrcRef.current) &&
      scriptureAudioUrlsEqual(scriptureSrcRef.current!, reg.chapterAudioSrc!);
    if (sameChapter && sameSrc && playbackModeRef.current === "scripture") {
      return;
    }
  }, [stopScripturePlayback, tryPlayScriptureWithFallback]);

  const resolveActiveReadChapter = useCallback((): ReadChapterPlaybackRegistration | null => {
    return getActiveReadChapterPlayback() ?? readChapterRef.current ?? readChapter;
  }, [readChapter]);

  const playScriptureChapter = useCallback(
    async (
      args: {
        bookId: string;
        chapter: number;
        bookName: string;
        translationId: string;
        chapterAudioSrc?: string | null;
      },
      opts?: { startAtSec?: number; endAtSec?: number; onSegmentEnd?: () => void },
    ): Promise<boolean> => {
      try {
        await configureShellAudioMode();
        if (!translationSupportsChapterAudio(args.translationId)) {
          return false;
        }
        const voiceId = await readCuvChapterAudioVoice();
        const scriptureSrc = await resolveScripturePlayableSrcForChapter({
          translationId: args.translationId,
          bookId: args.bookId,
          chapter: args.chapter,
          bookName: args.bookName,
          voiceId,
          cachedSrc: args.chapterAudioSrc,
        });
        if (!scriptureSrc) {
          return false;
        }

        const reg: ReadChapterPlaybackRegistration = {
          bookId: args.bookId,
          chapter: args.chapter,
          bookName: args.bookName,
          translationId: args.translationId,
          chapterAudioSrc: scriptureSrc,
          onAdvanceNextChapter: () => {
            const { next } = resolveReadChapterNeighbors(args.bookId, args.chapter);
            if (!next) {
              setPlaying(false);
              return;
            }
            void playScriptureChapter({
              bookId: next.bookId,
              chapter: next.chapter,
              bookName: getScriptureBookDisplayName(next.bookId),
              translationId: args.translationId,
            });
          },
          onAdvanceNextInBook: () => {
            const next = getNextScriptureChapterInBook(args.bookId, args.chapter);
            if (!next) {
              setPlaying(false);
              return;
            }
            void playScriptureChapter({
              bookId: next.bookId,
              chapter: next.chapter,
              bookName: getScriptureBookDisplayName(next.bookId),
              translationId: args.translationId,
            });
          },
        };
        readChapterRef.current = reg;
        setActiveReadChapterPlayback(reg);
        setReadChapter(reg);
        patchReadChapterSrc(scriptureSrc);

        await tryPlayScriptureWithFallback(reg, scriptureSrc);
        const started =
          playbackModeRef.current === "scripture" &&
          soundRef.current != null &&
          scriptureSrcRef.current != null;
        if (!started) {
          return false;
        }

        const seekSec = opts?.startAtSec;
        if (Number.isFinite(seekSec) && (seekSec ?? 0) > 0) {
          const sound = soundRef.current;
          if (sound) {
            const st = await safeGetSoundStatus(sound);
            if (st?.isLoaded) {
              const nextSec = Math.max(0, seekSec ?? 0);
              await sound.setPositionAsync(Math.floor(nextSec * 1000));
              setScriptureCurrentSec(nextSec);
            }
          }
        }
        const endAtSec = opts?.endAtSec;
        if (
          Number.isFinite(endAtSec) &&
          Number.isFinite(seekSec) &&
          (endAtSec ?? 0) > (seekSec ?? 0) + 0.12
        ) {
          scriptureStopAtSecRef.current = endAtSec ?? null;
          scriptureStopAtOnEndedRef.current = opts?.onSegmentEnd ?? null;
        } else {
          scriptureStopAtSecRef.current = null;
          scriptureStopAtOnEndedRef.current = null;
        }
        return true;
      } catch (err) {
        logShellSoundError("playScriptureChapter", err);
        return false;
      }
    },
    [patchReadChapterSrc, tryPlayScriptureWithFallback],
  );

  const togglePlayMusic = useCallback(async () => {
    if (tracks.length === 0) return;
    const playIdx = isMobileBundledOnly()
      ? firstPlayableTrackIndex(tracks)
      : trackIndexRef.current;
    if (isMobileBundledOnly() && !tracks[playIdx]?.localReady) return;
    try {
      await configureShellAudioMode();
      const sound = soundRef.current;
      const st = sound ? await safeGetSoundStatus(sound) : null;
      const currentTrack = tracks[playIdx] ?? null;
      const useCalmFade = shouldUseCalmAlbumFade(currentTrack);

      if (playbackModeRef.current !== "music" || !sound || !st?.isLoaded) {
        await playTrackAt(playIdx);
        return;
      }

      if (st.isPlaying) {
        if (useCalmFade) {
          const fromVolume = typeof st.volume === "number" ? st.volume : musicGainRef.current;
          await fadeSoundVolume(sound, fromVolume, 0, CALM_ALBUM_PAUSE_FADE_MS);
        }
        await safePauseSound(sound);
        if (useCalmFade) {
          try {
            await sound.setVolumeAsync(musicGainRef.current);
          } catch {
            /* ignore restore failures */
          }
        }
        setPlaying(false);
        await persistMusicResume(tracks[trackIndex]?.id ?? "", st.positionMillis / 1000);
        return;
      }

      if (useCalmFade) {
        try {
          await sound.setVolumeAsync(0);
        } catch {
          /* ignore pre-play fade setup failures */
        }
      }
      let ok = await safePlaySound(sound);
      if (!ok) {
        await playTrackAt(playIdx);
        return;
      }
      if (useCalmFade) {
        await fadeSoundVolume(sound, 0, musicGainRef.current, CALM_ALBUM_PAUSE_FADE_MS);
      }
      setPlaying(true);
      if (st.durationMillis != null) {
        setMusicCurrentSec(st.positionMillis / 1000);
        setMusicDurationSec(st.durationMillis / 1000);
      }
    } catch (err) {
      logShellSoundError("togglePlayMusic", err);
      setPlaying(false);
    }
  }, [persistMusicResume, playTrackAt, trackIndex, tracks]);

  const togglePlayScripture = useCallback(async () => {
    try {
      await configureShellAudioMode();
      const rc = resolveActiveReadChapter();
      if (!rc || !translationSupportsChapterAudio(rc.translationId)) {
        return;
      }
      const voiceId = await readCuvChapterAudioVoice();
      const scriptureSrc = await resolveScripturePlayableSrcForChapter({
        translationId: rc.translationId,
        bookId: rc.bookId,
        chapter: rc.chapter,
        bookName: rc.bookName,
        voiceId,
        cachedSrc: rc.chapterAudioSrc,
      });
      if (!scriptureSrc) {
        if (__DEV__) {
          console.warn("[scripture-audio] no playable src", rc.bookId, rc.chapter, rc.translationId);
        }
        return;
      }
      if (__DEV__) {
        console.warn("[scripture-audio] resolved src", scriptureSrc);
      }
      patchReadChapterSrc(scriptureSrc);
      const sameScripture =
        playbackModeRef.current === "scripture" &&
        scriptureSrcRef.current &&
        scriptureAudioUrlsEqual(scriptureSrcRef.current, scriptureSrc);

      if (sameScripture) {
        if (scripturePlayInFlightRef.current) {
          try {
            await scripturePlayInFlightRef.current;
          } catch {
            /* ignore */
          }
        }
        const sound = soundRef.current;
        if (!sound) {
          await tryPlayScriptureWithFallback(rc, scriptureSrc);
          return;
        }
        const st = await safeGetSoundStatus(sound);
        if (!st?.isLoaded) {
          await playScripture(scriptureSrc);
          return;
        }
        if (st.isPlaying) {
          await safePauseSound(sound);
          setPlaying(false);
        } else {
          const ok = await safePlaySound(sound);
          setPlaying(ok);
        }
        return;
      }

      if (playbackModeRef.current !== "scripture") {
        if (soundRef.current) {
          await unloadCurrent();
        }
        await tryPlayScriptureWithFallback(rc, scriptureSrc);
        return;
      }

      if (soundRef.current) {
        await unloadCurrent();
      } else {
        await stopScripturePlayback();
      }
      await tryPlayScriptureWithFallback(rc, scriptureSrc);
    } catch (err) {
      logShellSoundError("togglePlayScripture", err);
      setPlaying(false);
    }
  }, [patchReadChapterSrc, playScripture, resolveActiveReadChapter, stopScripturePlayback, tryPlayScriptureWithFallback, unloadCurrent]);

  const playNext = useCallback(async () => {
    if (playbackModeRef.current === "scripture") {
      resolveActiveReadChapter()?.onAdvanceNextChapter();
      return;
    }
    await playTrackAt(pickRandomNextTrackIndex(trackIndex, tracks.length));
  }, [playTrackAt, resolveActiveReadChapter, trackIndex, tracks.length]);

  const playPrev = useCallback(async () => {
    await playTrackAt(trackIndex - 1);
  }, [playTrackAt, trackIndex]);

  const activeReadForAudio =
    getActiveReadChapterPlayback() ?? readChapterRef.current ?? readChapter;
  const readChapterSupportsAudio = Boolean(
    activeReadForAudio && translationSupportsChapterAudio(activeReadForAudio.translationId),
  );
  const hasPlayableMusic = tracks.some((t) => isTrackPlayable(t));
  const canTogglePlayback =
    readChapterSupportsAudio ||
    hasPlayableMusic ||
    (!isMobileBundledOnly() && tracks.length > 0);
  const readChapterAudioAvailable = readChapterSupportsAudio;

  const value = useMemo(
    (): MusicPlaybackContextValue => ({
      store,
      tracks,
      trackIndex,
      playing,
      loading,
      playbackMode,
      musicCurrentSec,
      musicDurationSec,
      canTogglePlayback,
      scriptureCurrentSec,
      scriptureDurationSec,
      readChapterAudioAvailable,
      scripturePreparing,
      scriptureAudioRepeatMode,
      setScriptureAudioRepeatMode,
      scripturePlaybackRate,
      setScripturePlaybackRate,
      seekRatio,
      registerReadChapter,
      playTrackAt,
      togglePlayScripture,
      playScriptureChapter,
      togglePlayMusic,
      setMusicGain,
      playNext,
      playPrev,
      musicRepeatMode,
      setMusicRepeatMode,
      sleepTimerMinutes,
      setSleepTimerMinutes,
      musicCatalogUpdateAvailable,
      checkMusicCatalogUpdate,
      downloadMusicCatalogUpdate,
      downloadingTrackId,
      downloadMusicTrackAt,
    }),
    [
      store,
      tracks,
      trackIndex,
      playing,
      loading,
      playbackMode,
      musicCurrentSec,
      musicDurationSec,
      canTogglePlayback,
      scriptureCurrentSec,
      scriptureDurationSec,
      readChapterAudioAvailable,
      scripturePreparing,
      scriptureAudioRepeatMode,
      setScriptureAudioRepeatMode,
      scripturePlaybackRate,
      setScripturePlaybackRate,
      seekRatio,
      registerReadChapter,
      playTrackAt,
      togglePlayScripture,
      playScriptureChapter,
      togglePlayMusic,
      setMusicGain,
      playNext,
      playPrev,
      musicRepeatMode,
      setMusicRepeatMode,
      sleepTimerMinutes,
      setSleepTimerMinutes,
      musicCatalogUpdateAvailable,
      checkMusicCatalogUpdate,
      downloadMusicCatalogUpdate,
      downloadingTrackId,
      downloadMusicTrackAt,
    ],
  );

  return <MusicPlaybackContext.Provider value={value}>{children}</MusicPlaybackContext.Provider>;
}

export function useMusicPlaybackOptional(): MusicPlaybackContextValue | null {
  return useContext(MusicPlaybackContext);
}

export function useMusicPlayback(): MusicPlaybackContextValue {
  const ctx = useMusicPlaybackOptional();
  if (!ctx) throw new Error("useMusicPlayback must be used within MusicPlaybackProvider");
  return ctx;
}

/** 读经章：解析音频 URL 并注册壳层播放（发现版/讲解版之外的整章朗读） */
export async function resolveReadChapterAudioRegistration(
  args: Omit<ReadChapterPlaybackRegistration, "chapterAudioSrc"> & {
    voiceId?: CuvChapterAudioVoiceId;
  },
): Promise<ReadChapterPlaybackRegistration> {
  let chapterAudioSrc: string | null = null;
  if (translationSupportsChapterAudio(args.translationId)) {
    const voiceId = args.voiceId ?? (await readCuvChapterAudioVoice());
    chapterAudioSrc = await resolveScripturePlayableSrcForChapter({
      translationId: args.translationId,
      bookName: args.bookName,
      bookId: args.bookId,
      chapter: args.chapter,
      voiceId,
    });
  }
  return { ...args, chapterAudioSrc };
}
