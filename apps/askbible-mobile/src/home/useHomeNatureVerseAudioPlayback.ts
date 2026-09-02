import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { AppState, DeviceEventEmitter, Platform, type AppStateStatus } from "react-native";
import { createAudioPlayer, type AudioPlayer } from "expo-audio";
import { toLegacyPlaybackStatus, type LegacyPlaybackStatus } from "../audio/legacyPlaybackStatus";
import { waitForAudioPlayerLoaded } from "../audio/expoAudioPlayerReady";
import {
  isNearNaturalEnd,
  resolveGoldenVerseAudioUrl,
} from "./homeGoldenVerseAudioPlaybackHelpers";
import {
  configureScriptureShellAudioMode,
  configureShellAudioMode,
  shellSoundDownloadFirst,
} from "../audio/shellAudioMode";
import { safePlaySound, safeStopAndUnloadSound } from "../audio/safeShellSound";
import {
  getShellAuxMediaOwner,
  setShellAuxMediaOwner,
} from "../audio/shellAuxMediaOwner";
import { getShellAudioInterrupted } from "../audio/shellAudioInterruption";
import { getShellMusicWantPlaying } from "../audio/shellMusicWantPlaying";
import {
  getShellVerseWantPlaying,
  setShellVerseWantPlaying,
} from "../audio/shellVerseWantPlaying";
import { setShellNativeAudioTakeover } from "../audio/shellNativeAudioTakeover";
import {
  ensureShellMediaSceneArtwork,
  getShellMediaSceneArtworkUri,
} from "../audio/shellMediaSceneArtwork";
import { refreshShellMediaSession } from "../audio/shellMediaSessionPayload";
import {
  clearShellMediaSessionUserDismissed,
  pauseShellAppMusic,
  syncShellMediaSession,
  syncShellMediaSessionExplicit,
} from "../audio/shellMediaControls";
import { warmBundledModuleUri } from "../music/musicTrackPlayback";
import { requestNotificationPermissions } from "../notifications/notification-permissions";
import {
  ensureBundledGoldenVersePackInstalled,
  isBundledGoldenVersePackReady,
} from "./ensureBundledGoldenVersePack";
import { resolveGoldenVersePlaybackUri } from "./ensureGoldenVerseLocalPlaybackUri";
import {
  GOLDEN_VERSE_NATIVE_PREFETCH_COUNT,
  buildGoldenVerseAudioRemoteUrl,
  isGoldenVerseAudioRemoteStreamEnabled,
} from "./goldenVerseAudioRemote";
import {
  addGoldenVersePlayMs,
  hydrateGoldenVersePlayUsage,
} from "./goldenVersePlayUsage";
import { parseGoldenVerseKeyFromAudioUri } from "./parseGoldenVerseKeyFromAudioUri";
import {
  getHomeGoldenVerseAudioTranslationId,
  hydrateHomeGoldenVerseAudioTranslationId,
  subscribeHomeGoldenVerseAudioTranslationId,
} from "./homeGoldenVerseAudioPrefs";
import { getHomeVerseGapSec, hydrateHomeVerseGapSec } from "./homeVerseGapPrefs";

/**
 * 首页「每日金句」自动播放的核心 hook。
 * 职责：解析金句音频 URI → 驱动 expo-av（非 iOS/Android）或原生媒体会话（iOS/Android）播放 →
 *   句末静音间隔 → 触发外部 advanceNow 换下一句；并把播放状态同步进锁屏/通知栏媒体会话。
 * 边界：不负责金句文案/翻译选择的 UI，也不直接管理背景音乐（仅通过 shellAuxMediaOwner /
 *   shellMusicWantPlaying 与音乐播放协调，避免两者抢占同一原生 AudioSession）。
 * 交互模块：shellAudioMode（AVAudioSession 配置）、shellMediaControls / shellMediaSessionPayload
 *   （系统媒体控制中心同步）、shellAuxMediaOwner（前台可见的“谁在响”仲裁）、
 *   ensureGoldenVerseLocalPlaybackUri（本地/远程音频 URI 解析）。
 * iOS/Android 关屏后 JS 线程可能被系统冻结或降频，因此“换句”逻辑必须能由原生侧
 * （MediaPlayer / AVPlayer 队列耗尽事件）驱动，不能只依赖 expo-av 的状态回调。
 */
const VERSE_MEDIA_OWNER_ID = "home-golden-verse";

/** iOS 音乐在播时勿切 scripture AudioMode，否则会打断原生音乐；金句叠在同一 playback 会话上。 */
async function ensureVerseAudioMode(): Promise<void> {
  if (Platform.OS === "ios" && getShellMusicWantPlaying()) {
    await configureShellAudioMode();
    return;
  }
  await configureScriptureShellAudioMode();
}
/** 覆盖设置里 3/5/7 秒间隔；较短间隔靠播放进度截断。 */
const GAP_SILENCE_MODULE = require("../../assets/audio/verse-gap-silence-7.mp3");

type Phase = "verse" | "gap" | "idle";

type Args = {
  baseUrl: string;
  verseKey: string | null;
  active: boolean;
  advanceNow: () => Promise<void>;
  /** iOS 后台换句：预取下一句本地 URI，供原生 gap 后直接接播。 */
  peekNextVerseKey?: () => string | null;
  peekNextTwoVerseKeys?: () => [string | null, string | null];
  peekNextVerseKeys?: (count: number) => string[];
  pinNextVerseKey?: (key: string | null) => void;
  onActiveChange: (active: boolean) => void;
};

export function useHomeNatureVerseAudioPlayback({
  baseUrl,
  verseKey,
  active,
  advanceNow,
  peekNextVerseKey,
  peekNextTwoVerseKeys,
  peekNextVerseKeys,
  pinNextVerseKey,
  onActiveChange,
}: Args) {
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [uriResolving, setUriResolving] = useState(false);
  const audioTranslationId = useSyncExternalStore(
    subscribeHomeGoldenVerseAudioTranslationId,
    getHomeGoldenVerseAudioTranslationId,
    getHomeGoldenVerseAudioTranslationId,
  );
  const soundRef = useRef<AudioPlayer | null>(null);
  const advanceNowRef = useRef(advanceNow);
  const peekNextVerseKeyRef = useRef(peekNextVerseKey);
  const peekNextTwoVerseKeysRef = useRef(peekNextTwoVerseKeys);
  const peekNextVerseKeysRef = useRef(peekNextVerseKeys);
  const pinNextVerseKeyRef = useRef(pinNextVerseKey);
  const activeRef = useRef(active);
  const onActiveChangeRef = useRef(onActiveChange);
  const playingRef = useRef(false);
  const phaseRef = useRef<Phase>("idle");
  const verseKeyRef = useRef(verseKey);
  const srcRef = useRef<string | null>(null);
  const gapSecRef = useRef(5);
  const gapAssetUriRef = useRef<string | null>(null);
  const nextAssetUriRef = useRef<string | null>(null);
  const nextNextAssetUriRef = useRef<string | null>(null);
  const nextAssetUrisRef = useRef<string[]>([]);
  const lastPositionMillisRef = useRef(0);
  const unflushedMillisRef = useRef(0);
  /** iOS 原生金句：用墙钟累计本句已听时长（无 expo-av status）。 */
  const iosVerseStartedAtRef = useRef(0);
  const lastDurationSecRef = useRef(0);
  const lastPositionSecRef = useRef(0);
  const verseEndHandledRef = useRef(false);
  const gapEndHandledRef = useRef(false);
  const gapStartedAtRef = useRef(0);
  const gapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoResumeUntilRef = useRef(0);
  const notificationPrimeRef = useRef(false);
  const playGapSilenceRef = useRef<() => Promise<void>>(async () => {});
  const missingAudioSkipRef = useRef(0);
  /**
   * iOS 原生已接播的下一句 key：play effect 对该 key 只补预取，不 userPlay 重开。
   * 用 key 而非一次性 bool，避免依赖变化导致 effect 重跑时误重开。
   */
  const iosNativeChainedVerseKeyRef = useRef<string | null>(null);
  /** 原生已用 userPlay 开播的句；effect 重跑时只补队列，勿再 seek 回 0。 */
  const nativeVerseStartedRef = useRef<{ key: string; uri: string } | null>(null);
  /** play effect 代际：取消/重跑时丢掉过期的 resolve + userPlay。 */
  const playGenerationRef = useRef(0);
  const verseUriCacheRef = useRef<Map<string, string>>(new Map());

  const src = useMemo(
    () => resolveGoldenVerseAudioUrl(baseUrl, verseKey, audioTranslationId),
    [audioTranslationId, baseUrl, verseKey],
  );

  useEffect(() => {
    void hydrateHomeGoldenVerseAudioTranslationId();
    void hydrateHomeVerseGapSec();
    void hydrateGoldenVersePlayUsage();
  }, []);

  useEffect(() => {
    advanceNowRef.current = advanceNow;
  }, [advanceNow]);
  useEffect(() => {
    peekNextVerseKeyRef.current = peekNextVerseKey;
  }, [peekNextVerseKey]);
  useEffect(() => {
    peekNextTwoVerseKeysRef.current = peekNextTwoVerseKeys;
  }, [peekNextTwoVerseKeys]);
  useEffect(() => {
    peekNextVerseKeysRef.current = peekNextVerseKeys;
  }, [peekNextVerseKeys]);
  useEffect(() => {
    pinNextVerseKeyRef.current = pinNextVerseKey;
  }, [pinNextVerseKey]);

  const resolveKeyUri = useCallback(
    async (key: string | null): Promise<string | null> => {
      if (!key || key === verseKeyRef.current) return null;
      const remote = resolveGoldenVerseAudioUrl(baseUrl, key, audioTranslationId);
      try {
        return await resolveGoldenVersePlaybackUri({
          verseKey: key,
          translationId: audioTranslationId,
          remoteUrl: remote,
        });
      } catch {
        return null;
      }
    },
    [audioTranslationId, baseUrl],
  );

  const prefetchNextAssetUris = useCallback(async (countOverride?: number): Promise<{
    nextAssetUri: string | null;
    nextNextAssetUri: string | null;
    nextAssetUris: string[];
  }> => {
    // iOS / Android 原生金句队列都靠预取；勿只给 iOS（安卓关屏会单句循环）。
    if (Platform.OS !== "ios" && Platform.OS !== "android") {
      return { nextAssetUri: null, nextNextAssetUri: null, nextAssetUris: [] };
    }
    const count = countOverride ?? GOLDEN_VERSE_NATIVE_PREFETCH_COUNT;
    const peekMany = peekNextVerseKeysRef.current;
    const peekTwo = peekNextTwoVerseKeysRef.current;
    const peekOne = peekNextVerseKeyRef.current;
    const keys = peekMany
      ? peekMany(count)
      : peekTwo
        ? peekTwo().filter((key): key is string => Boolean(key))
        : [peekOne?.() ?? null].filter((key): key is string => Boolean(key));
    if (keys[0]) pinNextVerseKeyRef.current?.(keys[0]);
    // 关屏窗口很短：R2 直链按键拼 URL，勿对每句 HEAD。
    const resolved =
      isGoldenVerseAudioRemoteStreamEnabled()
        ? keys.map((key) => buildGoldenVerseAudioRemoteUrl(key, audioTranslationId))
        : await Promise.all(keys.map((key) => resolveKeyUri(key)));
    const nextAssetUris = resolved.filter((uri): uri is string => Boolean(uri));
    nextAssetUriRef.current = nextAssetUris[0] ?? null;
    nextNextAssetUriRef.current = nextAssetUris[1] ?? null;
    nextAssetUrisRef.current = nextAssetUris;
    return {
      nextAssetUri: nextAssetUris[0] ?? null,
      nextNextAssetUri: nextAssetUris[1] ?? null,
      nextAssetUris,
    };
  }, [audioTranslationId, resolveKeyUri]);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    onActiveChangeRef.current = onActiveChange;
  }, [onActiveChange]);

  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);

  useEffect(() => {
    verseKeyRef.current = verseKey;
  }, [verseKey]);

  useEffect(() => {
    srcRef.current = src;
  }, [src]);

  const flushListeningTime = useCallback(() => {
    const millis = unflushedMillisRef.current;
    unflushedMillisRef.current = 0;
    if (Platform.OS === "ios" && iosVerseStartedAtRef.current > 0) {
      const wall = Date.now() - iosVerseStartedAtRef.current;
      iosVerseStartedAtRef.current = Date.now();
      if (wall > 0) void addGoldenVersePlayMs(wall);
    }
    if (millis > 0) void addGoldenVersePlayMs(millis);
  }, []);

  const clearResumeTimer = useCallback(() => {
    if (resumeTimerRef.current) {
      clearTimeout(resumeTimerRef.current);
      resumeTimerRef.current = null;
    }
  }, []);

  const clearGapTimer = useCallback(() => {
    if (gapTimerRef.current) {
      clearTimeout(gapTimerRef.current);
      gapTimerRef.current = null;
    }
  }, []);

  const finishGapAndAdvance = useCallback(() => {
    if (gapEndHandledRef.current) return;
    gapEndHandledRef.current = true;
    clearGapTimer();
    clearResumeTimer();
    if (!activeRef.current) return;
    void advanceNowRef.current().catch(() => undefined);
  }, [clearGapTimer, clearResumeTimer]);

  const buildPayload = useCallback(
    (isPlaying: boolean, status?: { durationMillis?: number | null; positionMillis?: number }) => {
      if (status) {
        if ((status.durationMillis ?? 0) > 0) {
          lastDurationSecRef.current = (status.durationMillis ?? 0) / 1000;
        }
        if (typeof status.positionMillis === "number") {
          lastPositionSecRef.current = Math.floor(status.positionMillis / 1000);
        }
      }
      // 系统栏固定文案 + 场景海报；assetUri 供 Android 原生 MediaPlayer 关屏续播。
      return {
        title: "AskBible.me",
        artist: "Daily Verse",
        album: "AskBible.me",
        assetUri: srcRef.current,
        artworkUri: getShellMediaSceneArtworkUri(),
        durationSec: lastDurationSecRef.current,
        positionSec: lastPositionSecRef.current,
        playing: isPlaying,
        kind: "verse" as const,
        gapSec: gapSecRef.current,
        gapAssetUri: gapAssetUriRef.current,
        nextAssetUri: nextAssetUriRef.current,
        nextNextAssetUri: nextNextAssetUriRef.current,
        nextAssetUris: nextAssetUrisRef.current,
      };
    },
    [],
  );

  /** 原生已开播后只补队列/元数据，勿再带 assetUri（防 iOS 缓冲期 tearDown 重播）。 */
  const buildVerseQueueOnlyPayload = useCallback((isPlaying: boolean) => {
    const base = buildPayload(isPlaying);
    const { assetUri: _omit, ...rest } = base;
    return rest;
  }, [buildPayload]);

  const buildVersePostStartSyncPayload = useCallback(
    (isPlaying: boolean) => {
      if (Platform.OS === "ios" || Platform.OS === "android") {
        return buildVerseQueueOnlyPayload(isPlaying);
      }
      return buildPayload(isPlaying);
    },
    [buildPayload, buildVerseQueueOnlyPayload],
  );

  const unloadCurrentSound = useCallback(async () => {
    flushListeningTime();
    const sound = soundRef.current;
    soundRef.current = null;
    if (sound) await safeStopAndUnloadSound(sound);
  }, [flushListeningTime]);

  // true 表示用户主动暂停了传输（区别于句末/间隔等内部状态切换），
  // 用于阻止 tryResumeCurrentSound / AppState 回前台时把播放顶回去。
  const transportPausedRef = useRef(false);

  const stopFully = useCallback(async () => {
    transportPausedRef.current = false;
    clearResumeTimer();
    clearGapTimer();
    autoResumeUntilRef.current = 0;
    gapStartedAtRef.current = 0;
    phaseRef.current = "idle";
    verseEndHandledRef.current = false;
    gapEndHandledRef.current = false;
    iosNativeChainedVerseKeyRef.current = null;
    nativeVerseStartedRef.current = null;
    verseUriCacheRef.current.clear();
    setPlaying(false);
    playingRef.current = false;
    setShellVerseWantPlaying(false);
    // 首页可能已先清 wantPlaying；仍必须把 userPause 送到原生，否则 MediaPlayer / AVPlayer 继续出声。
    syncShellMediaSessionExplicit({
      ...buildPayload(false),
      playing: false,
      userPause: true,
    });
    if (Platform.OS === "ios") setShellNativeAudioTakeover(false);
    refreshShellMediaSession();
    await unloadCurrentSound();
    if (getShellAuxMediaOwner()?.id === VERSE_MEDIA_OWNER_ID) {
      setShellAuxMediaOwner(null);
    }
  }, [buildPayload, clearGapTimer, clearResumeTimer, unloadCurrentSound]);

  const pauseTransport = useCallback(async () => {
    if (!activeRef.current) return;
    transportPausedRef.current = true;
    clearResumeTimer();
    autoResumeUntilRef.current = 0;
    setPlaying(false);
    playingRef.current = false;
    setShellVerseWantPlaying(false);
    syncShellMediaSessionExplicit({
      ...buildPayload(false),
      playing: false,
      userPause: true,
    });
  }, [buildPayload, clearResumeTimer]);

  // 仅 expo-av 路径使用：尝试续播当前 sound；对近结尾/间隔末尾等即将自然切换的
  // 时刻主动放弃续播，交给状态回调/timer 去推进换句，避免和换句逻辑产生竞态。
  const tryResumeCurrentSound = useCallback(async () => {
    if (!activeRef.current) return false;
    if (transportPausedRef.current) return false;
    // 用户锁屏暂停会清 wantPlaying；勿再自动顶回去。
    if (!getShellVerseWantPlaying()) return false;
    if (phaseRef.current !== "verse" && phaseRef.current !== "gap") return false;
    const sound = soundRef.current;
    if (!sound) return false;
    try {
      await ensureVerseAudioMode();
      const st = toLegacyPlaybackStatus(sound.currentStatus, sound.volume, sound.muted);
      if (!st.isLoaded || st.isPlaying) return st.isLoaded && !!st.isPlaying;
      if (
        phaseRef.current === "verse" &&
        isNearNaturalEnd(st)
      ) {
        // 近结尾勿再 resume（含后台）：交给 didJustFinish / reachedEnd 进间隔换句。
        return false;
      }
      if (phaseRef.current === "gap") {
        const gapMs = Math.max(0, getHomeVerseGapSec()) * 1000;
        if ((st.positionMillis ?? 0) >= gapMs - 80) return false;
      }
      clearShellMediaSessionUserDismissed();
      const ok = await safePlaySound(sound);
      if (ok) {
        autoResumeUntilRef.current = Date.now() + 8_000;
        setPlaying(true);
        playingRef.current = true;
        syncShellMediaSessionExplicit(buildPayload(true, st));
      }
      return ok;
    } catch {
      return false;
    }
  }, [buildPayload]);

  const scheduleResume = useCallback(() => {
    if (!activeRef.current) return;
    clearResumeTimer();
    autoResumeUntilRef.current = Date.now() + 8_000;
    resumeTimerRef.current = setTimeout(() => {
      resumeTimerRef.current = null;
      void tryResumeCurrentSound();
    }, 350);
  }, [clearResumeTimer, tryResumeCurrentSound]);

  /** 传输续播（中间键 / 锁屏）：只 playing:true，禁止 userPlay（防句中 seek 0）。 */
  const syncVerseTransportResume = useCallback(() => {
    transportPausedRef.current = false;
    clearShellMediaSessionUserDismissed();
    setShellVerseWantPlaying(true);
    setPlaying(true);
    playingRef.current = true;
    if (Platform.OS === "ios") setShellNativeAudioTakeover(true);

    if (Platform.OS === "ios" || Platform.OS === "android") {
      if (getShellMusicWantPlaying()) {
        void prefetchNextAssetUris().then(({ nextAssetUri, nextNextAssetUri, nextAssetUris }) => {
          if (!activeRef.current) return;
          syncShellMediaSessionExplicit({
            ...buildVerseQueueOnlyPayload(true),
            nextAssetUri,
            nextNextAssetUri,
            nextAssetUris,
            playing: true,
          });
        });
        return;
      }
      if (nativeVerseStartedRef.current) {
        syncShellMediaSessionExplicit({
          ...buildVerseQueueOnlyPayload(true),
          playing: true,
        });
      } else {
        syncShellMediaSessionExplicit({
          ...buildPayload(true),
          ...(srcRef.current ? { assetUri: srcRef.current } : {}),
          playing: true,
        });
      }
      return;
    }
    void tryResumeCurrentSound();
  }, [buildPayload, buildVerseQueueOnlyPayload, prefetchNextAssetUris, tryResumeCurrentSound]);

  const resumeTransport = useCallback(async () => {
    if (!activeRef.current) return;
    syncVerseTransportResume();
  }, [syncVerseTransportResume]);

  /**
   * 非 iOS/Android 平台（expo-av 直接播放）的进度回调，按 phase 分流处理。
   * 用 phaseRef 而不是闭包里的 phase 判活：sound 是异步创建的，若期间 phase 已经
   * 切走（如提前触发了间隔/停止），回调必须自行失效，否则会污染新阶段的状态。
   * 仅比 phaseRef 还不够：旧 sound 卸载是异步的，若新一代 sound 已经把 phaseRef
   * 切回同一个 phase（如连续换句都是 "verse"），旧 sound 卸载完成前的最后一次
   * 回调会因 phase 相同而"诈活"，用旧的 position/duration 污染新 sound 的状态。
   * 因此必须再确认 soundRef.current 就是这次回调所属的 sound 本身。
   */
  const attachStatusHandler = useCallback(
    (sound: AudioPlayer, phase: "verse" | "gap") => {
      sound.addListener("playbackStatusUpdate", (raw) => {
        const status = toLegacyPlaybackStatus(raw, sound.volume, sound.muted);
        if (!status.isLoaded) return;
        if (phaseRef.current !== phase) return;
        if (soundRef.current !== sound) return;

        const position = status.positionMillis;
        const delta = position - lastPositionMillisRef.current;
        lastPositionMillisRef.current = position;

        if (phase === "verse" && status.isPlaying && delta > 0 && delta < 5000) {
          unflushedMillisRef.current += delta;
          if (unflushedMillisRef.current >= 10_000) flushListeningTime();
        }

        if (status.isPlaying) {
          clearResumeTimer();
          autoResumeUntilRef.current = Date.now() + 8_000;
          setPlaying(true);
          playingRef.current = true;
          syncShellMediaSessionExplicit(buildPayload(true, status));
        }

        if (phase === "verse") {
          // 后台 / 回桌面后也要能换句：不能只认前台；近结尾也不再靠 resume 顶住。
          const reachedEnd =
            !!status.didJustFinish ||
            (!status.isPlaying &&
              isNearNaturalEnd(status) &&
              Date.now() >= autoResumeUntilRef.current);

          if (!status.isPlaying && !reachedEnd) {
            setPlaying(false);
            playingRef.current = false;
            if (
              activeRef.current &&
              getShellVerseWantPlaying() &&
              !verseEndHandledRef.current
            ) {
              if (isNearNaturalEnd(status)) {
                // 已近结尾却未 didJustFinish：直接进间隔，避免后台 suspend 后死循环 resume。
                verseEndHandledRef.current = true;
                clearResumeTimer();
                flushListeningTime();
                void playGapSilenceRef.current();
              } else {
                scheduleResume();
                syncShellMediaSessionExplicit(buildPayload(true, status));
              }
            }
          }

          if (reachedEnd && !verseEndHandledRef.current) {
            verseEndHandledRef.current = true;
            clearResumeTimer();
            flushListeningTime();
            // 立刻接静音轨，保持媒体会话一直 playing（不靠 setTimeout）。
            void playGapSilenceRef.current();
          }
          return;
        }

        // gap phase：墙钟时间为主（防 didJustFinish 过早）；播放进度为辅；另有 timer 兜底。
        const gapMs = Math.max(0, getHomeVerseGapSec()) * 1000;
        const elapsed = Math.max(0, Date.now() - gapStartedAtRef.current);
        const gapDone =
          (gapMs <= 0 && elapsed >= 0) ||
          elapsed >= gapMs ||
          position >= Math.max(0, gapMs - 60);

        if (!status.isPlaying && !gapDone) {
          setPlaying(false);
          playingRef.current = false;
          if (
            activeRef.current &&
            getShellVerseWantPlaying() &&
            !gapEndHandledRef.current
          ) {
            scheduleResume();
            syncShellMediaSessionExplicit(buildPayload(true, status));
          }
        }

        if (gapDone) {
          finishGapAndAdvance();
        }
      });
    },
    [buildPayload, clearResumeTimer, finishGapAndAdvance, flushListeningTime, scheduleResume],
  );

  const playGapSilence = useCallback(async () => {
    if (!activeRef.current) return;
    phaseRef.current = "gap";
    gapEndHandledRef.current = false;
    clearResumeTimer();
    clearGapTimer();
    const gapSec = Math.max(0, getHomeVerseGapSec());
    const gapMs = gapSec * 1000;
    gapStartedAtRef.current = Date.now();

    // 墙钟兜底：静音轨失败 / 进度回调丢失时仍按设置间隔换句。
    gapTimerRef.current = setTimeout(() => {
      gapTimerRef.current = null;
      if (phaseRef.current === "gap") finishGapAndAdvance();
    }, Math.max(0, gapMs));

    if (gapSec <= 0) {
      finishGapAndAdvance();
      return;
    }

    try {
      await ensureVerseAudioMode();
      const prev = soundRef.current;
      soundRef.current = null;
      if (prev) void safeStopAndUnloadSound(prev);

      const sound = createAudioPlayer(GAP_SILENCE_MODULE, { updateInterval: 200 });
      // 略提高音量，避免部分 Android 把近静音轨当成“可忽略”而立刻结束。
      sound.volume = 0.05;
      sound.muted = false;
      await waitForAudioPlayerLoaded(sound);
      if (!activeRef.current || phaseRef.current !== "gap") {
        await safeStopAndUnloadSound(sound);
        return;
      }
      sound.play();
      soundRef.current = sound;
      setPlaying(true);
      playingRef.current = true;
      autoResumeUntilRef.current = Date.now() + Math.max(8_000, gapMs + 2_000);
      syncShellMediaSessionExplicit(
        buildPayload(true, {
          durationMillis: gapMs,
          positionMillis: 0,
        }),
      );
      attachStatusHandler(sound, "gap");
    } catch {
      // 静音轨失败：保留上面的墙钟 timer，到期再换句（不再立刻跳）。
    }
  }, [
    attachStatusHandler,
    buildPayload,
    clearGapTimer,
    clearResumeTimer,
    finishGapAndAdvance,
  ]);

  useEffect(() => {
    playGapSilenceRef.current = playGapSilence;
  }, [playGapSilence]);

  useEffect(() => {
    if (!active) {
      if (getShellAuxMediaOwner()?.id === VERSE_MEDIA_OWNER_ID) {
        setShellAuxMediaOwner(null);
        refreshShellMediaSession();
      }
      return;
    }

    if (Platform.OS === "android" && !notificationPrimeRef.current) {
      notificationPrimeRef.current = true;
      void requestNotificationPermissions();
    }
    ensureShellMediaSceneArtwork();

    let cancelled = false;
    setShellAuxMediaOwner({
      id: VERSE_MEDIA_OWNER_ID,
      pause: async () => {
        clearResumeTimer();
        autoResumeUntilRef.current = 0;
        setPlaying(false);
        playingRef.current = false;
        setShellVerseWantPlaying(false);
        // 与 iOS 一致：真暂停时熄黄标，避免「无声但图标仍黄」。
        onActiveChangeRef.current(false);
        if (Platform.OS === "ios") {
          syncShellMediaSessionExplicit({
            ...buildPayload(false),
            playing: false,
            userPause: true,
          });
          return;
        }
        // Android 原生金句：无 expo-av sound，靠会话 playing=false 暂停 MediaPlayer。
        syncShellMediaSessionExplicit({
          ...buildPayload(false),
          playing: false,
          userPause: true,
        });
      },
      resume: async () => {
        if (!activeRef.current) onActiveChangeRef.current(true);
        syncVerseTransportResume();
      },
      buildPayload: () => {
        const wantPlaying =
          playingRef.current ||
          getShellVerseWantPlaying() ||
          (activeRef.current && Date.now() < autoResumeUntilRef.current);
        if (
          (Platform.OS === "ios" || Platform.OS === "android") &&
          nativeVerseStartedRef.current &&
          wantPlaying
        ) {
          return buildVerseQueueOnlyPayload(wantPlaying);
        }
        return buildPayload(wantPlaying);
      },
    });

    return () => {
      cancelled = true;
      if (getShellAuxMediaOwner()?.id === VERSE_MEDIA_OWNER_ID) {
        setShellAuxMediaOwner(null);
      }
    };
  }, [active, buildPayload, buildVerseQueueOnlyPayload, clearResumeTimer, prefetchNextAssetUris, syncVerseTransportResume, tryResumeCurrentSound]);

  useEffect(() => {
    if (!verseKey || !active) {
      missingAudioSkipRef.current = 0;
      setReady(false);
      void stopFully();
      return;
    }

    // 主播放 effect：verseKey/active 变化即重跑。异步链路较长（解析 URI、可能的整包解压、
    // 原生 userPlay），期间可能被更新的 effect 调用打断；用 generation 计数而非仅 cancelled
    // 标志，防止“旧一代”的 await 恢复后覆盖新一代已经建立的播放状态（典型竞态源）。
    let cancelled = false;
    const generation = ++playGenerationRef.current;
    const isStale = () =>
      cancelled || !activeRef.current || playGenerationRef.current !== generation;
    void (async () => {
      clearResumeTimer();
      clearGapTimer();
      await unloadCurrentSound();
      if (isStale()) return;
      phaseRef.current = "verse";
      verseEndHandledRef.current = false;
      gapEndHandledRef.current = false;
      gapStartedAtRef.current = 0;
      lastPositionMillisRef.current = 0;
      setUriResolving(true);
      try {
        clearShellMediaSessionUserDismissed();
        const keyNorm = (verseKey ?? "").trim().toUpperCase();
        const uriCacheKey = `${audioTranslationId}:${keyNorm}`;
        let playUri = verseUriCacheRef.current.get(uriCacheKey) ?? null;
        if (!playUri) {
          playUri = await resolveGoldenVersePlaybackUri({
            verseKey,
            translationId: audioTranslationId,
            remoteUrl: src,
          });
          if (playUri) verseUriCacheRef.current.set(uriCacheKey, playUri);
        }
        if (!playUri) throw new Error("golden verse audio missing");
        if (isStale()) return;
        missingAudioSkipRef.current = 0;
        srcRef.current = playUri;
        // 仍有安装包 zip 时才后台整包解压；R2 直链模式跳过。
        if (!isGoldenVerseAudioRemoteStreamEnabled()) {
          void ensureBundledGoldenVersePackInstalled(audioTranslationId);
        }

        // iOS / Android：金句走原生轨（关屏可续）；勿再开 expo-av（会双声或后台被掐）。
        if (Platform.OS === "ios" || Platform.OS === "android") {
          const gapAssetUri =
            gapAssetUriRef.current ??
            (await warmBundledModuleUri(GAP_SILENCE_MODULE)) ??
            null;
          const gapSec = Math.max(0, getHomeVerseGapSec());
          if (isStale()) return;
          gapSecRef.current = gapSec;
          gapAssetUriRef.current = gapAssetUri;
          setShellVerseWantPlaying(true);
          // 未点音乐时先钉死原生主轨，避免金句开会话把预加载曲目一起拉起来（双声）。
          if (!getShellMusicWantPlaying()) pauseShellAppMusic();
          if (Platform.OS === "ios") {
            setShellNativeAudioTakeover(true);
          }
          setReady(true);
          setPlaying(true);
          playingRef.current = true;
          iosVerseStartedAtRef.current = Date.now();
          autoResumeUntilRef.current = Date.now() + 8_000;

          const syncQueueOnly = (next: {
            nextAssetUri: string | null;
            nextNextAssetUri: string | null;
            nextAssetUris: string[];
          }) => {
            if (isStale() || !getShellVerseWantPlaying()) return;
            syncShellMediaSessionExplicit({
              ...buildVersePostStartSyncPayload(true),
              gapSec,
              gapAssetUri,
              nextAssetUri: next.nextAssetUri,
              nextNextAssetUri: next.nextNextAssetUri,
              nextAssetUris: next.nextAssetUris,
              playing: true,
            });
          };

          const chainedKey = (iosNativeChainedVerseKeyRef.current ?? "").trim().toUpperCase();
          if (chainedKey && chainedKey === keyNorm) {
            void prefetchNextAssetUris().then(syncQueueOnly);
            if (__DEV__) {
              console.warn("[home-golden-verse] native chained keep", verseKey, playUri);
            }
            return;
          }

          const alreadyNative =
            nativeVerseStartedRef.current?.key === keyNorm && getShellVerseWantPlaying();
          if (alreadyNative) {
            nativeVerseStartedRef.current = { key: keyNorm, uri: playUri };
            void prefetchNextAssetUris().then(syncQueueOnly);
            return;
          }

          // 先开播，再异步补队列（预取勿挡 userPlay，避免竞态晚到 seek 0）。
          nativeVerseStartedRef.current = { key: keyNorm, uri: playUri };
          syncShellMediaSessionExplicit({
            ...buildPayload(true, { durationMillis: 0, positionMillis: 0 }),
            assetUri: playUri,
            gapSec,
            gapAssetUri,
            playing: true,
            userPlay: true,
          });
          void prefetchNextAssetUris().then(syncQueueOnly);
          void import("../read/reading-habit-stats")
            .then(({ recordAnyReadingActivityDay }) => recordAnyReadingActivityDay())
            .catch(() => undefined);
          if (__DEV__) {
            console.warn("[home-golden-verse] native play", verseKey, playUri);
          }
          return;
        }

        await ensureVerseAudioMode();
        const downloadFirst = shellSoundDownloadFirst({ uri: playUri });
        const sound = createAudioPlayer(
          { uri: playUri },
          { updateInterval: 250, downloadFirst },
        );
        sound.volume = 1;
        sound.muted = false;
        const rawStatus = await waitForAudioPlayerLoaded(sound);
        if (isStale()) {
          await safeStopAndUnloadSound(sound);
          return;
        }
        soundRef.current = sound;
        try {
          sound.muted = false;
          sound.volume = 1;
          if (sound.isLoaded && !sound.playing) {
            sound.play();
          }
        } catch {
          /* ignore */
        }
        setShellVerseWantPlaying(true);
        setReady(true);
        setPlaying(true);
        playingRef.current = true;
        autoResumeUntilRef.current = Date.now() + 8_000;
        const legacyStatus = toLegacyPlaybackStatus(rawStatus, sound.volume, sound.muted);
        syncShellMediaSessionExplicit(buildPayload(true, legacyStatus.isLoaded ? legacyStatus : undefined));
        void import("../read/reading-habit-stats")
          .then(({ recordAnyReadingActivityDay }) => recordAnyReadingActivityDay())
          .catch(() => undefined);
        attachStatusHandler(sound, "verse");
        if (__DEV__) {
          console.warn("[home-golden-verse] play ok", verseKey, playUri);
        }
      } catch (err) {
        console.warn("[home-golden-verse] play failed", verseKey, err);
        setReady(false);
        setPlaying(false);
        playingRef.current = false;
        if (activeRef.current) {
          missingAudioSkipRef.current += 1;
          if (missingAudioSkipRef.current <= 12) {
            finishGapAndAdvance();
          }
        }
      } finally {
        if (!cancelled) setUriResolving(false);
      }
    })();

    return () => {
      cancelled = true;
      setUriResolving(false);
    };
  }, [active, audioTranslationId, verseKey]);

  // iOS / Android 原生金句：句终/间隔结束 → 换下一句（勿依赖 expo-av status）。
  useEffect(() => {
    if ((Platform.OS !== "ios" && Platform.OS !== "android") || !active) return;
    const onAdvance = (payload?: { nativeChained?: boolean; assetUri?: string }) => {
      if (!activeRef.current) return;
      if (gapEndHandledRef.current && phaseRef.current === "gap") return;
      // 上一句听完：把墙钟时长计入解锁进度。
      flushListeningTime();
      phaseRef.current = "gap";
      // 原生已接播下一句：仍要 advance 文案/key；play effect 只补预取，不重开播放器。
      if (payload?.nativeChained) {
        gapEndHandledRef.current = false;
        if (payload.assetUri) {
          srcRef.current = payload.assetUri;
          const keyed = parseGoldenVerseKeyFromAudioUri(payload.assetUri);
          iosNativeChainedVerseKeyRef.current = keyed || null;
          if (keyed) {
            nativeVerseStartedRef.current = {
              key: keyed.trim().toUpperCase(),
              uri: payload.assetUri,
            };
          }
        } else {
          iosNativeChainedVerseKeyRef.current = null;
        }
        iosVerseStartedAtRef.current = Date.now();
        phaseRef.current = "verse";
        verseEndHandledRef.current = false;
      }
      finishGapAndAdvance();
      // 仅原生已接播下一句时补队列。非 chained 时 srcRef 仍是旧句，勿再 sync（会把同一句打回去）。
      if (!payload?.nativeChained) return;
      void prefetchNextAssetUris().then(({ nextAssetUri, nextNextAssetUri, nextAssetUris }) => {
        if (!activeRef.current || !getShellVerseWantPlaying()) return;
        syncShellMediaSessionExplicit({
          ...buildVersePostStartSyncPayload(true),
          nextAssetUri,
          nextNextAssetUri,
          nextAssetUris,
          playing: true,
        });
      });
    };
    const sub = DeviceEventEmitter.addListener("ShellMediaNativeVerseAdvance", onAdvance);
    return () => sub.remove();
  }, [active, buildPayload, buildVersePostStartSyncPayload, finishGapAndAdvance, flushListeningTime, prefetchNextAssetUris]);

  // 原生媒体控制中心「重新开始」手势（如长按/双击）触发的事件；仅 iOS/Android 原生金句
  // 会发出此事件，因为非原生路径直接用 expo-av 的 setPositionAsync 重播即可，无需绕原生总线。
  useEffect(() => {
    if (!active) return;
    const onRestart = () => {
      if (!activeRef.current) return;
      if (transportPausedRef.current) return;
      clearShellMediaSessionUserDismissed();
      setShellVerseWantPlaying(true);
      setPlaying(true);
      playingRef.current = true;
      lastPositionSecRef.current = 0;
      lastPositionMillisRef.current = 0;
      phaseRef.current = "verse";
      verseEndHandledRef.current = false;
      gapEndHandledRef.current = false;
      if (Platform.OS === "ios") setShellNativeAudioTakeover(true);
      // 同 URI + userPlay + position 0 → 原生 seek 到头（见 iOS beginOrResumeVerse / Android forceRestart）。
      syncShellMediaSessionExplicit({
        ...buildPayload(true),
        playing: true,
        userPlay: true,
        forceRestart: true,
        positionSec: 0,
      });
      const sound = soundRef.current;
      if (sound) {
        void (async () => {
          try {
            await sound.seekTo(0);
            await safePlaySound(sound);
          } catch {
            /* ignore */
          }
        })();
      }
    };
    const sub = DeviceEventEmitter.addListener("ShellMediaNativeVerseRestart", onRestart);
    return () => sub.remove();
  }, [active, buildPayload]);

  // AppState 监听：iOS/Android 原生金句 和 其他平台（expo-av）走两套完全不同的策略，
  // 因为原生路径的播放器本就在原生层跑，前后台切换不需要 JS 侧介入音频会话。
  useEffect(() => {
    if (!active) return;
    // iOS / Android 原生金句：后台勿重配 AudioMode / 勿 resume expo-av（会掐原生）。
    if (Platform.OS === "ios" || Platform.OS === "android") {
      const sync = (state: AppStateStatus) => {
        if (getShellAudioInterrupted()) return;
        if (state === "active") {
          setPlaying(true);
          playingRef.current = true;
          if (getShellVerseWantPlaying()) iosVerseStartedAtRef.current = Date.now();
          return;
        }
        // 进后台前尽量把 next/nextNext 喂给原生，避免 JS 挂起后队列吃空断播。
        if (state !== "background" && state !== "inactive") return;
        flushListeningTime();
        if (!getShellVerseWantPlaying()) return;
        void prefetchNextAssetUris().then(({ nextAssetUri, nextNextAssetUri, nextAssetUris }) => {
          if (!activeRef.current || !getShellVerseWantPlaying()) return;
          syncShellMediaSessionExplicit({
            ...buildVersePostStartSyncPayload(true),
            nextAssetUri,
            nextNextAssetUri,
            nextAssetUris,
            playing: true,
          });
        });
      };
      const sub = AppState.addEventListener("change", sync);
      return () => sub.remove();
    }
    const sync = (state: AppStateStatus) => {
      if (state === "active" || state === "inactive" || state === "background") {
        if (!getShellVerseWantPlaying()) return;
        void ensureVerseAudioMode();
        void tryResumeCurrentSound();
      }
    };
    sync(AppState.currentState);
    const sub = AppState.addEventListener("change", sync);
    return () => sub.remove();
  }, [active, buildPayload, buildVersePostStartSyncPayload, flushListeningTime, prefetchNextAssetUris]);

  // 非原生平台的心跳轮询：expo-av 状态回调有时会漏（如 App 从后台恢复），用 900ms
  // 轮询兜底纠正 playing 状态并尝试自动续播；iOS/Android 原生金句禁用此轮询见下。
  useEffect(() => {
    if (!active) return;
    // 原生金句：禁 900ms 轮询（后台 CPU / 与 MediaPlayer 抢状态）。
    if (Platform.OS === "ios" || Platform.OS === "android") return;
    const tick = () => {
      if (!activeRef.current || !getShellVerseWantPlaying()) return;
      if (phaseRef.current !== "verse" && phaseRef.current !== "gap") return;
      void (async () => {
        const sound = soundRef.current;
        if (!sound) {
          if (!playingRef.current) void tryResumeCurrentSound();
          return;
        }
        try {
          const st = toLegacyPlaybackStatus(sound.currentStatus, sound.volume, sound.muted);
          if (!st.isLoaded) return;
          if (st.isPlaying) {
            playingRef.current = true;
            autoResumeUntilRef.current = Date.now() + 8_000;
            const aux = getShellAuxMediaOwner();
            if (aux?.id === VERSE_MEDIA_OWNER_ID) {
              const payload = aux.buildPayload();
              if (payload) syncShellMediaSession(payload);
            }
            return;
          }
          playingRef.current = false;
          void tryResumeCurrentSound();
        } catch {
          if (!playingRef.current) void tryResumeCurrentSound();
        }
      })();
    };
    tick();
    const id = setInterval(tick, 900);
    return () => clearInterval(id);
  }, [active, tryResumeCurrentSound]);

  useEffect(() => {
    return () => {
      void stopFully();
    };
  }, [stopFully]);

  // 在线直链：不展示「正在准备金句」；仅本地 zip 抽条/首次解压时才提示。
  const preparing = Boolean(
    active &&
      !playing &&
      uriResolving &&
      !isGoldenVerseAudioRemoteStreamEnabled(),
  );
  const firstAudioPrep =
    preparing && !isBundledGoldenVersePackReady(audioTranslationId);

  return {
    ready,
    playing,
    preparing,
    firstAudioPrep,
    src,
    stopFully,
    pauseTransport,
    resumeTransport,
  };
}
