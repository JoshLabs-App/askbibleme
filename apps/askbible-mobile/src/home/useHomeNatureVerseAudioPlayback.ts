import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { AppState, DeviceEventEmitter, Platform, type AppStateStatus } from "react-native";
import { Audio } from "expo-av";
import { buildGoldenVerseAudioRelativePath } from "@/lib/bible/golden-verse-audio";
import { toAbsoluteUrl } from "../config/askbibleBaseUrl";
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

const VERSE_MEDIA_OWNER_ID = "home-golden-verse";

/** iOS 音乐在播时勿切 scripture AudioMode，否则会打断原生音乐；金句叠在同一 playback 会话上。 */
async function ensureVerseAudioMode(): Promise<void> {
  if (Platform.OS === "ios" && getShellMusicWantPlaying()) {
    await configureShellAudioMode();
    return;
  }
  await configureScriptureShellAudioMode();
}
/** 安卓关屏后 JS 易被冻；原生队列要一次喂够，继续从金句池取，而不是只循环已播过的。 */
const VERSE_END_SLACK_MS = 350;
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

function resolveGoldenVerseAudioUrl(
  baseUrl: string,
  verseKey: string | null,
  translationId: "cuv-simp" | "web-en",
): string | null {
  if (!verseKey) return null;
  // TEMP：包体过大时默认 R2 直链；禁止回落 askbible.me / Render。
  if (isGoldenVerseAudioRemoteStreamEnabled()) {
    return buildGoldenVerseAudioRemoteUrl(verseKey, translationId);
  }
  // Stream off：仅允许显式非 askbible.me 基址（本地调试 / 自建），否则失败关闭。
  const relative = buildGoldenVerseAudioRelativePath(verseKey, translationId);
  if (!relative) return null;
  const base = baseUrl.trim();
  if (!base) return null;
  if (/askbible\.me/i.test(base)) return null;
  return toAbsoluteUrl(base, `/audio/${relative}`);
}

function isNearNaturalEnd(status: {
  durationMillis?: number | null;
  positionMillis?: number;
}): boolean {
  const duration = status.durationMillis ?? 0;
  const position = status.positionMillis ?? 0;
  return duration > 400 && position >= duration - VERSE_END_SLACK_MS;
}

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
  const soundRef = useRef<Audio.Sound | null>(null);
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
      const st = await sound.getStatusAsync();
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

  const attachStatusHandler = useCallback(
    (sound: Audio.Sound, phase: "verse" | "gap") => {
      sound.setOnPlaybackStatusUpdate((status) => {
        if (!status.isLoaded) return;
        if (phaseRef.current !== phase) return;

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

      const created = await Audio.Sound.createAsync(GAP_SILENCE_MODULE, {
        shouldPlay: true,
        progressUpdateIntervalMillis: 200,
        // 略提高音量，避免部分 Android 把近静音轨当成“可忽略”而立刻结束。
        volume: 0.05,
        isMuted: false,
      });
      if (!activeRef.current || phaseRef.current !== "gap") {
        await safeStopAndUnloadSound(created.sound);
        return;
      }
      soundRef.current = created.sound;
      setPlaying(true);
      playingRef.current = true;
      autoResumeUntilRef.current = Date.now() + Math.max(8_000, gapMs + 2_000);
      syncShellMediaSessionExplicit(
        buildPayload(true, {
          durationMillis: gapMs,
          positionMillis: 0,
        }),
      );
      attachStatusHandler(created.sound, "gap");
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
        const created = await Audio.Sound.createAsync(
          { uri: playUri },
          {
            shouldPlay: true,
            progressUpdateIntervalMillis: 250,
            volume: 1,
            isMuted: false,
          },
          undefined,
          downloadFirst,
        );
        if (isStale()) {
          await safeStopAndUnloadSound(created.sound);
          return;
        }
        soundRef.current = created.sound;
        try {
          await created.sound.setIsMutedAsync(false);
          await created.sound.setVolumeAsync(1);
          const st = await created.sound.getStatusAsync();
          if (st.isLoaded && !st.isPlaying) {
            await created.sound.playAsync();
          }
        } catch {
          /* ignore */
        }
        setShellVerseWantPlaying(true);
        setReady(true);
        setPlaying(true);
        playingRef.current = true;
        autoResumeUntilRef.current = Date.now() + 8_000;
        syncShellMediaSessionExplicit(buildPayload(true, created.status.isLoaded ? created.status : undefined));
        void import("../read/reading-habit-stats")
          .then(({ recordAnyReadingActivityDay }) => recordAnyReadingActivityDay())
          .catch(() => undefined);
        attachStatusHandler(created.sound, "verse");
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
            await sound.setPositionAsync(0);
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
          const st = await sound.getStatusAsync();
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
