import { Audio, type AVPlaybackStatus } from "expo-av";
import { AppState, Platform, type AppStateStatus } from "react-native";
import { configureShellAudioMode } from "../audio/shellAudioMode";
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
import { scriptureAudioUrlsEqual } from "../bible/cuv-chapter-audio";
import {
  resolveScripturePlayableSrcForChapter,
  translationSupportsChapterAudio,
} from "../bible/read-chapter-audio";
import { getNextScriptureChapterInBook } from "../bible/next-scripture-chapter";
import { getAskBibleBaseUrl } from "../config/askbibleBaseUrl";
import { fetchMusicCompanionStore } from "./fetchMusicCompanion";
import { musicTrackAvSource } from "./musicTrackPlayback";
import { enrichPlaybackTracks } from "./trackArtwork";
import type { MusicCompanionStore, PlaybackTrack } from "./types";
import { trackTelemetry } from "../telemetry/client";
import {
  getActiveReadChapterPlayback,
  setActiveReadChapterPlayback,
} from "../read/read-chapter-playback-store";

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
export type ShellSleepTimerMinutes = 30 | 60 | 120;

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
  seekRatio: (ratio: number) => Promise<void>;
  registerReadChapter: (reg: ReadChapterPlaybackRegistration | null) => void;
  playTrackAt: (index: number) => Promise<void>;
  togglePlay: () => Promise<void>;
  playNext: () => Promise<void>;
  playPrev: () => Promise<void>;
  sleepTimerMinutes: 0 | ShellSleepTimerMinutes;
  setSleepTimerMinutes: (minutes: 0 | ShellSleepTimerMinutes) => void;
};

const MusicPlaybackContext = createContext<MusicPlaybackContextValue | null>(null);

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
  const [scripturePreparing, setScripturePreparing] = useState(false);
  const [musicCurrentSec, setMusicCurrentSec] = useState(0);
  const [musicDurationSec, setMusicDurationSec] = useState(0);
  const [sleepTimerMinutes, setSleepTimerMinutesState] = useState<0 | ShellSleepTimerMinutes>(0);

  const soundRef = useRef<Audio.Sound | null>(null);
  const sleepTimerDeadlineRef = useRef<number | null>(null);
  /** 每路 Sound 独立 id，忽略已卸载实例的状态回调（避免重音 / 关不掉） */
  const activeSoundIdRef = useRef(0);
  const playbackEpochRef = useRef(0);
  const scripturePlayInFlightRef = useRef<Promise<void> | null>(null);
  const playbackModeRef = useRef<PlaybackMode>("music");
  const trackIndexRef = useRef(0);
  const scriptureSrcRef = useRef<string | null>(null);
  const autoPlayScriptureRef = useRef(false);
  const readChapterRef = useRef<ReadChapterPlaybackRegistration | null>(null);
  const scriptureAudioRepeatRef = useRef<ScriptureAudioRepeatMode>("off");
  const playTrackAtRef = useRef<(index: number) => Promise<void>>(async () => {});
  const musicSessionRef = useRef<{ trackId: string; startedAt: number } | null>(null);

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
    [store, baseUrl],
  );

  trackIndexRef.current = trackIndex;
  playbackModeRef.current = playbackMode;
  scriptureAudioRepeatRef.current = scriptureAudioRepeatMode;

  const setScriptureAudioRepeatMode = useCallback((mode: ScriptureAudioRepeatMode) => {
    scriptureAudioRepeatRef.current = mode;
    setScriptureAudioRepeatModeState(mode);
  }, []);

  const pauseShellPlayback = useCallback(async () => {
    const sound = soundRef.current;
    if (!sound) {
      setPlaying(false);
      return;
    }
    try {
      const st = await sound.getStatusAsync();
      if (st.isLoaded && st.isPlaying) {
        await sound.pauseAsync();
      }
    } catch {
      /* ignore */
    }
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
    const st = await sound.getStatusAsync();
    if (!st.isLoaded || st.durationMillis == null || st.durationMillis <= 0) return;
    const clamped = Math.max(0, Math.min(1, ratio));
    const pos = clamped * st.durationMillis;
    await sound.setPositionAsync(pos);
    const sec = pos / 1000;
    if (playbackModeRef.current === "music") {
      setMusicCurrentSec(sec);
    } else {
      setScriptureCurrentSec(sec);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        await configureShellAudioMode();
        const s = await fetchMusicCompanionStore();
        setStore(s);
      } finally {
        setLoading(false);
      }
    })();
    return () => {
      void soundRef.current?.unloadAsync();
      soundRef.current = null;
    };
  }, []);

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
    try {
      await sound.stopAsync();
    } catch {
      /* already stopped */
    }
    try {
      await sound.unloadAsync();
    } catch {
      /* ignore */
    }
  }, []);

  const stopScripturePlayback = useCallback(async () => {
    setScripturePreparing(false);
    endMusicSession();
    await unloadCurrent();
    scriptureSrcRef.current = null;
    setScriptureCurrentSec(0);
    setScriptureDurationSec(0);
    setPlaying(false);
    setPlaybackMode("music");
    playbackModeRef.current = "music";
  }, [unloadCurrent, endMusicSession]);

  const playTrackAt = useCallback(
    async (index: number) => {
      if (tracks.length === 0) return;
      const i = ((index % tracks.length) + tracks.length) % tracks.length;
      const track = tracks[i]!;
      const avSource = musicTrackAvSource(track);
      if (avSource == null) return;
      endMusicSession();
      await unloadCurrent();
      await configureShellAudioMode();
      setMusicCurrentSec(0);
      setMusicDurationSec(0);
      const epoch = playbackEpochRef.current;
      const soundId = ++activeSoundIdRef.current;
      let sound: Audio.Sound;
      try {
        const created = await Audio.Sound.createAsync(
          avSource,
          { shouldPlay: true, progressUpdateIntervalMillis: 120 },
          (status: AVPlaybackStatus) => {
            if (soundId !== activeSoundIdRef.current || epoch !== playbackEpochRef.current) return;
            if (!status.isLoaded) return;
            setPlaying(status.isPlaying);
            if (playbackModeRef.current === "music") {
              setMusicCurrentSec(status.positionMillis / 1000);
              setMusicDurationSec(
                status.durationMillis != null ? status.durationMillis / 1000 : 0,
              );
            }
            if (status.didJustFinish && playbackModeRef.current === "music") {
              void playTrackAtRef.current(trackIndexRef.current + 1);
            }
          },
          Platform.OS === "android",
        );
        sound = created.sound;
      } catch {
        if (__DEV__) {
          console.warn("[music] play failed:", track.id, track.src);
        }
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
      trackTelemetry("music_play", { track_id: track.id });
      musicSessionRef.current = { trackId: track.id, startedAt: Date.now() };
    },
    [tracks, unloadCurrent, endMusicSession],
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
        setPlaybackMode("scripture");
        playbackModeRef.current = "scripture";
        setScripturePreparing(true);

        const soundId = ++activeSoundIdRef.current;
        let sound: Audio.Sound;
        try {
          const created = await Audio.Sound.createAsync(
            { uri: trimmed },
            { shouldPlay: true, progressUpdateIntervalMillis: 350 },
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
                    void active.setPositionAsync(0).then(() => active.playAsync());
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
            Platform.OS === "android",
          );
          sound = created.sound;
        } catch {
          if (epoch === playbackEpochRef.current) {
            scriptureSrcRef.current = null;
            setPlaybackMode("music");
            playbackModeRef.current = "music";
            setPlaying(false);
          }
          setScripturePreparing(false);
          if (__DEV__) {
            console.warn("[scripture-audio] play failed:", trimmed);
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

  const registerReadChapter = useCallback((reg: ReadChapterPlaybackRegistration | null) => {
    const prev = readChapterRef.current;
    readChapterRef.current = reg;
    setActiveReadChapterPlayback(reg);
    setReadChapter(reg);

    if (!reg) {
      if (playbackModeRef.current === "scripture") {
        void stopScripturePlayback();
      }
      return;
    }

    if (reg.chapterAudioSrc && autoPlayScriptureRef.current) {
      autoPlayScriptureRef.current = false;
      void playScripture(reg.chapterAudioSrc);
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
  }, [playScripture, stopScripturePlayback]);

  const patchReadChapterSrc = useCallback((src: string) => {
    const rc = readChapterRef.current;
    if (!rc || !src.trim()) return;
    if (rc.chapterAudioSrc?.trim() === src.trim()) return;
    const next = { ...rc, chapterAudioSrc: src.trim() };
    readChapterRef.current = next;
    setReadChapter(next);
  }, []);

  const resolveActiveReadChapter = useCallback((): ReadChapterPlaybackRegistration | null => {
    return getActiveReadChapterPlayback() ?? readChapterRef.current ?? readChapter;
  }, [readChapter]);

  const togglePlay = useCallback(async () => {
    const rc = resolveActiveReadChapter();
    if (rc && translationSupportsChapterAudio(rc.translationId)) {
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
            await playScripture(scriptureSrc);
            return;
          }
          const st = await sound.getStatusAsync();
          if (!st.isLoaded) {
            await playScripture(scriptureSrc);
            return;
          }
          if (st.isPlaying) {
            await sound.pauseAsync();
            setPlaying(false);
          } else {
            await sound.playAsync();
            setPlaying(true);
          }
          return;
        }

        if (playbackModeRef.current === "music" && soundRef.current) {
          await unloadCurrent();
        } else if (playbackModeRef.current === "scripture") {
          await stopScripturePlayback();
        }
      await playScripture(scriptureSrc);
      return;
    }

    if (resolveActiveReadChapter()) {
      return;
    }

    if (!soundRef.current && tracks.length > 0) {
      await playTrackAt(trackIndex);
      return;
    }
    if (!soundRef.current) return;
    const st = await soundRef.current.getStatusAsync();
    if (!st.isLoaded) return;
    if (st.isPlaying) {
      await soundRef.current.pauseAsync();
      setPlaying(false);
    } else {
      await soundRef.current.playAsync();
      setPlaying(true);
    }
    if (playbackModeRef.current === "music" && st.durationMillis != null) {
      setMusicCurrentSec(st.positionMillis / 1000);
      setMusicDurationSec(st.durationMillis / 1000);
    }
  }, [
    patchReadChapterSrc,
    playScripture,
    playTrackAt,
    resolveActiveReadChapter,
    stopScripturePlayback,
    unloadCurrent,
    trackIndex,
    tracks.length,
  ]);

  const playNext = useCallback(async () => {
    if (playbackModeRef.current === "scripture") {
      resolveActiveReadChapter()?.onAdvanceNextChapter();
      return;
    }
    await playTrackAt(trackIndex + 1);
  }, [playTrackAt, resolveActiveReadChapter, trackIndex]);

  const playPrev = useCallback(async () => {
    await playTrackAt(trackIndex - 1);
  }, [playTrackAt, trackIndex]);

  const activeReadForAudio = getActiveReadChapterPlayback() ?? readChapter;
  const readChapterSupportsAudio = Boolean(
    activeReadForAudio && translationSupportsChapterAudio(activeReadForAudio.translationId),
  );
  const canTogglePlayback = readChapterSupportsAudio || tracks.length > 0;
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
      seekRatio,
      registerReadChapter,
      playTrackAt,
      togglePlay,
      playNext,
      playPrev,
      sleepTimerMinutes,
      setSleepTimerMinutes,
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
      seekRatio,
      registerReadChapter,
      playTrackAt,
      togglePlay,
      playNext,
      playPrev,
      sleepTimerMinutes,
      setSleepTimerMinutes,
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
  args: Omit<ReadChapterPlaybackRegistration, "chapterAudioSrc">,
): Promise<ReadChapterPlaybackRegistration> {
  let chapterAudioSrc: string | null = null;
  if (translationSupportsChapterAudio(args.translationId)) {
    const voiceId = await readCuvChapterAudioVoice();
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
