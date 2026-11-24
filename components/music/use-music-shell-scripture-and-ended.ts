import {
  useCallback,
  useEffect,
  type Dispatch,
  type MutableRefObject,
  type RefObject,
  type SetStateAction,
} from "react";
import { flushSync } from "react-dom";
import {
  voiceSupportsBook,
  type CuvChapterAudioVoiceId,
} from "@/lib/bible/cuv-chapter-audio-voices";
import {
  getNextScriptureChapter,
  getNextScriptureChapterInBook,
} from "@/lib/bible/next-scripture-chapter";
import {
  isCuvChapterAudioEffectiveSrc,
  tryParseCuvChapterAudioEffectiveSrc,
  type ParsedCuvChapterAudioSrc,
} from "@/lib/bible/parse-cuv-chapter-audio-src";
import {
  resolveChapterAudioPlayableSrc,
  translationSupportsChapterAudio,
} from "@/lib/bible/read-chapter-audio";
import { scriptureBooks } from "@/lib/bible/scripture-books";
import { translationUsesWebChapterAudio } from "@/lib/bible/web-chapter-audio";
import {
  devotionalAudioUrl,
  devotionalAvailable,
  devotionalPlanIsToday,
  isDevotionalAudio,
  loadDevotional,
  readDevotionalAuto,
  shouldHandoffDevotional,
} from "@/lib/devotional/solid-joys";
import type { AppLocale } from "@/lib/i18n/config";
import type { MusicAlbumRepeatMode } from "@/lib/music/album-playback";
import { resolveShellMusicEndedAction } from "@/lib/music/shell-music-advance";
import {
  getShellDefaultAudioSrc,
  pickRandomShellAudioTrackSrc,
} from "@/lib/music-companion/shell-default-audio-src";
import {
  shellPlaybackUrlsEqual,
  shouldRestoreShellPlaybackSrc,
} from "@/lib/music-companion/shell-playback-storage";
import type { MusicCompanionStore } from "@/lib/music-companion/types";
import { flushTodayPlanScriptureResume } from "@/lib/read/flush-today-plan-scripture-resume";
import { readPlanFlowActive, setPlanFlowActive } from "@/lib/read/plan-flow-session";
import { prefetchUpcomingPlanFlowChapterAudioWeb } from "@/lib/read/prefetch-plan-flow-chapter-audio-web";
import { prepareReadingPlanAudioSessionForChapter } from "@/lib/read/prepare-reading-plan-audio-session";
import { isReadBibleHomePath } from "@/lib/read/read-bible-home-route";
import {
  readReadingPlanAudioSession,
  writeReadingPlanAudioSession,
} from "@/lib/read/reading-plan-audio-session";
import { indexInReadingPlanQueue } from "@/lib/read/reading-plan-chapter-queue";
import { resolveTodayPlanLoopNextTarget } from "@/lib/read/resolve-today-plan-loop-next-target";
import { prepareTodayReadingAudioSessionFromStart } from "@/lib/read/today-reading-audio-start";
import {
  audioUrlEquals,
  fetchDefaultTranslationIdCached,
  isMusicShellPath,
  parseReadChapterPath,
  type DevicePlaybackCell,
  type ScriptureAudioRepeatMode,
  type ScriptureListenTarget,
  type ShellPlaybackRestorePlan,
} from "./music-shell-playback-types";

export function useMusicShellScriptureAndEnded({
  audioRef,
  loading,
  pathname,
  router,
  playing,
  setPlaying,
  setPlaybackSrc,
  attemptShellPlay,
  effectiveVoiceId,
  setShellAudioHomePrimed,
  setScriptureAudioRepeatMode,
  scriptureAudioRepeatRef,
  musicAlbumRepeatModeOverrideRef,
  storeRef,
  effectiveSrcRef,
  playbackOverrideRef,
  devicePlaybackRef,
  playAfterNextBindRef,
  shellPlaybackRestoreRef,
  shellPlaybackPersistEnabledRef,
  scriptureListenTargetRef,
  devotionalAccessRef,
}: {
  audioRef: RefObject<HTMLAudioElement | null>;
  loading: boolean;
  pathname: string;
  router: { push: (href: string) => void };
  playing: boolean;
  setPlaying: Dispatch<SetStateAction<boolean>>;
  setPlaybackSrc: (src: string | null, opts?: { autoPlay?: boolean }) => void;
  attemptShellPlay: (a: HTMLAudioElement) => void;
  effectiveVoiceId: (bookId: string) => CuvChapterAudioVoiceId;
  setShellAudioHomePrimed: Dispatch<SetStateAction<boolean>>;
  setScriptureAudioRepeatMode: (mode: ScriptureAudioRepeatMode, opts?: { persist?: boolean }) => void;
  scriptureAudioRepeatRef: MutableRefObject<ScriptureAudioRepeatMode>;
  musicAlbumRepeatModeOverrideRef: MutableRefObject<MusicAlbumRepeatMode | null>;
  storeRef: MutableRefObject<MusicCompanionStore | null>;
  effectiveSrcRef: MutableRefObject<string>;
  playbackOverrideRef: MutableRefObject<string | null>;
  devicePlaybackRef: MutableRefObject<DevicePlaybackCell | null>;
  playAfterNextBindRef: MutableRefObject<boolean>;
  shellPlaybackRestoreRef: MutableRefObject<ShellPlaybackRestorePlan | null>;
  shellPlaybackPersistEnabledRef: MutableRefObject<boolean>;
  scriptureListenTargetRef: MutableRefObject<ScriptureListenTarget | null>;
  devotionalAccessRef: MutableRefObject<{ locale: AppLocale; isAdmin: boolean }>;
}) {
  /** 自动下一首 / 单轨循环（与曲库 `audioTracks` 顺序一致，末首后回到第一首） */
  useEffect(() => {
    const a = audioRef.current;
    if (!a || loading) return;

    const advanceScriptureChapter = async (
      parsed: ParsedCuvChapterAudioSrc,
      target: { bookId: string; chapter: number } | null,
      opts?: { planFlow?: boolean },
    ) => {
      if (!target) {
        setPlaying(false);
        return;
      }
      if (
        !parsed.webAudio &&
        parsed.voiceId === "teochew-nt" &&
        !voiceSupportsBook("teochew-nt", target.bookId)
      ) {
        setPlaying(false);
        return;
      }
      const meta = scriptureBooks.find((b) => b.bookId === target.bookId);
      if (!meta) {
        setPlaying(false);
        return;
      }
      const tid = await fetchDefaultTranslationIdCached();
      if (!tid || !translationSupportsChapterAudio(tid)) {
        setPlaying(false);
        return;
      }
      const audioTranslationId =
        parsed.audioTranslationId ??
        (parsed.webAudio && !translationUsesWebChapterAudio(tid) ? "web-en" : tid);
      const resolved = await resolveChapterAudioPlayableSrc({
        translationId: audioTranslationId,
        bookName: meta.bookName,
        bookId: target.bookId,
        chapter: target.chapter,
        voiceId: parsed.voiceId,
      });
      if (!resolved.ok) {
        setPlaying(false);
        return;
      }
      const planQuery = opts?.planFlow || readPlanFlowActive() ? "?planFlow=1" : "";
      router.push(`/read/${target.bookId}/${target.chapter}${planQuery}`);
      playAfterNextBindRef.current = true;
      setPlaybackSrc(resolved.src.trim());
      if (opts?.planFlow || readPlanFlowActive()) {
        const planSession = readReadingPlanAudioSession();
        if (planSession?.queue.length) {
          prefetchUpcomingPlanFlowChapterAudioWeb(
            planSession.queue,
            { bookId: target.bookId, chapter: target.chapter },
            {
              translationId: audioTranslationId,
              voiceId: parsed.voiceId,
              ahead: 3,
            },
          );
        }
      }
    };

    const onEndedAdvance = () => {
      if (devicePlaybackRef.current) {
        a.currentTime = 0;
        void attemptShellPlay(a);
        return;
      }
      const cur = effectiveSrcRef.current.trim();
      if (isDevotionalAudio(cur)) {
        setPlaying(false);
        return;
      }
      const parsedEarly = cur ? tryParseCuvChapterAudioEffectiveSrc(cur) : null;
      if (parsedEarly && readPlanFlowActive()) {
        void (async () => {
          const access = devotionalAccessRef.current;
          const session = readReadingPlanAudioSession();
          if (
            readDevotionalAuto() &&
            devotionalPlanIsToday() &&
            devotionalAvailable(access.locale, access.isAdmin) &&
            session &&
            shouldHandoffDevotional(session.queue, parsedEarly)
          ) {
            try {
              const day = await loadDevotional(access.locale);
              const src = day && devotionalAudioUrl(day);
              const currentAccess = devotionalAccessRef.current;
              if (
                src &&
                effectiveSrcRef.current.trim() === cur &&
                readDevotionalAuto() &&
                devotionalPlanIsToday() &&
                devotionalAvailable(currentAccess.locale, currentAccess.isAdmin)
              ) {
                setPlanFlowActive(false);
                writeReadingPlanAudioSession(null);
                setPlaybackSrc(src, { autoPlay: true });
                return;
              }
            } catch {
              /* Keep existing plan playback available if devotional cannot load. */
            }
          }
          if (effectiveSrcRef.current.trim() !== cur) return;
          const next = await resolveTodayPlanLoopNextTarget(parsedEarly.bookId, parsedEarly.chapter);
          if (next) {
            await advanceScriptureChapter(parsedEarly, next, { planFlow: true });
            return;
          }
          setPlaying(false);
        })();
        return;
      }
      const planSession = readReadingPlanAudioSession();
      const planParsed = planSession && cur ? tryParseCuvChapterAudioEffectiveSrc(cur) : null;
      if (planSession && planParsed) {
        const idx = indexInReadingPlanQueue(planSession.queue, planParsed.bookId, planParsed.chapter);
        if (idx >= 0) {
          const nextIdx = idx + 1;
          if (nextIdx < planSession.queue.length) {
            const next = planSession.queue[nextIdx]!;
            void advanceScriptureChapter(planParsed, {
              bookId: next.bookId,
              chapter: next.chapter,
            });
            return;
          }
          writeReadingPlanAudioSession(null);
          setPlaying(false);
          return;
        }
      }
      const mode = scriptureAudioRepeatRef.current;
      const parsed = parsedEarly ?? tryParseCuvChapterAudioEffectiveSrc(cur);
      if (parsed) {
        if (mode === "chapter") {
          a.currentTime = 0;
          void attemptShellPlay(a);
          return;
        }
        const nextRef =
          mode === "book"
            ? getNextScriptureChapterInBook(parsed.bookId, parsed.chapter)
            : getNextScriptureChapter(parsed.bookId, parsed.chapter);
        void advanceScriptureChapter(parsed, nextRef);
        return;
      }
      const st = storeRef.current;
      if (st && cur && !shouldRestoreShellPlaybackSrc(st, cur)) {
        setPlaying(false);
        return;
      }
      if (!st && cur && typeof navigator !== "undefined" && navigator.onLine) {
        setPlaying(false);
        return;
      }
      if (!st) return;

      const ended = resolveShellMusicEndedAction({
        store: st,
        currentSrc: cur,
        repeatModeOverride: musicAlbumRepeatModeOverrideRef.current,
      });
      if (ended.kind === "stop") {
        setPlaying(false);
        return;
      }
      if (ended.kind === "loop_same") {
        a.currentTime = 0;
        void attemptShellPlay(a);
        return;
      }
      playAfterNextBindRef.current = true;
      setPlaybackSrc(ended.src);
    };

    a.addEventListener("ended", onEndedAdvance);
    return () => a.removeEventListener("ended", onEndedAdvance);
  }, [
    audioRef,
    loading,
    setPlaybackSrc,
    router,
    attemptShellPlay,
    devicePlaybackRef,
    devotionalAccessRef,
    effectiveSrcRef,
    musicAlbumRepeatModeOverrideRef,
    playAfterNextBindRef,
    scriptureAudioRepeatRef,
    setPlaying,
    storeRef,
  ]);

  const pauseScripturePlayback = useCallback(() => {
    const a = audioRef.current;
    if (!a || a.paused) return;
    if (readPlanFlowActive() && isCuvChapterAudioEffectiveSrc(effectiveSrcRef.current)) {
      const parsed = tryParseCuvChapterAudioEffectiveSrc(effectiveSrcRef.current.trim());
      if (parsed) {
        flushTodayPlanScriptureResume({
          bookId: parsed.bookId,
          chapter: parsed.chapter,
          positionSec: a.currentTime,
          durationSec: Number.isFinite(a.duration) ? a.duration : undefined,
        });
      }
    }
    a.pause();
    setPlaying(false);
  }, [audioRef, effectiveSrcRef, setPlaying]);

  const playScriptureChapter = useCallback(
    async (target: {
      bookId: string;
      chapter: number;
      bookName?: string;
      translationId?: string;
      startAtSec?: number;
    }) => {
      flushSync(() => {
        setShellAudioHomePrimed(true);
      });
      const a = audioRef.current;
      if (!a || loading) return;

      const bookId = target.bookId.trim().toUpperCase();
      const chapter = target.chapter;
      if (!bookId || !Number.isInteger(chapter) || chapter < 1) return;

      const meta = scriptureBooks.find((b) => b.bookId === bookId);
      if (!meta) return;

      const tid = target.translationId?.trim() || (await fetchDefaultTranslationIdCached());
      if (!tid || !translationSupportsChapterAudio(tid)) return;

      const planSession = await prepareReadingPlanAudioSessionForChapter(bookId, chapter);
      if (planSession || readPlanFlowActive()) {
        setScriptureAudioRepeatMode("off", { persist: false });
      }

      const playVoice = effectiveVoiceId(bookId);
      const resolved = await resolveChapterAudioPlayableSrc({
        translationId: tid,
        bookName: target.bookName?.trim() || meta.bookName,
        bookId,
        chapter,
        voiceId: playVoice,
      });
      if (!resolved.ok) return;

      const want = resolved.src.trim();
      scriptureListenTargetRef.current = { bookId, chapter, src: want };
      const prefetchPlanQueueAfterChapter = () => {
        if (!readPlanFlowActive()) return;
        const session = readReadingPlanAudioSession();
        if (!session?.queue.length) return;
        prefetchUpcomingPlanFlowChapterAudioWeb(
          session.queue,
          { bookId, chapter },
          { translationId: tid, voiceId: playVoice, ahead: 3 },
        );
      };
      const route = parseReadChapterPath(pathname);
      if (!route || route.bookId !== bookId || route.chapter !== chapter) {
        const planQuery = readPlanFlowActive() ? "?planFlow=1" : "";
        router.push(`/read/${bookId}/${chapter}${planQuery}`);
      }

      const ov = playbackOverrideRef.current?.trim() ?? "";
      const already = audioUrlEquals(a, want) || (Boolean(ov) && shellPlaybackUrlsEqual(ov, want));
      const startAtSec =
        typeof target.startAtSec === "number" && target.startAtSec > 0 ? target.startAtSec : 0;
      if (!already) {
        if (startAtSec > 0) {
          shellPlaybackRestoreRef.current = {
            targetSrc: want,
            timeSec: startAtSec,
            tryPlay: true,
          };
          shellPlaybackPersistEnabledRef.current = false;
        } else {
          playAfterNextBindRef.current = true;
        }
        setPlaybackSrc(want);
        prefetchPlanQueueAfterChapter();
        return;
      }
      if (!a.paused) return;
      if (startAtSec > 0) {
        shellPlaybackRestoreRef.current = {
          targetSrc: want,
          timeSec: startAtSec,
          tryPlay: true,
        };
        shellPlaybackPersistEnabledRef.current = false;
        prefetchPlanQueueAfterChapter();
        return;
      }
      await attemptShellPlay(a);
      prefetchPlanQueueAfterChapter();
    },
    [
      audioRef,
      attemptShellPlay,
      effectiveVoiceId,
      loading,
      pathname,
      playAfterNextBindRef,
      playbackOverrideRef,
      router,
      scriptureListenTargetRef,
      setPlaybackSrc,
      setScriptureAudioRepeatMode,
      setShellAudioHomePrimed,
      shellPlaybackPersistEnabledRef,
      shellPlaybackRestoreRef,
    ],
  );

  const skipScriptureNext = useCallback(async () => {
    const cur = effectiveSrcRef.current.trim();
    const parsed = cur ? tryParseCuvChapterAudioEffectiveSrc(cur) : null;
    const route = parseReadChapterPath(pathname);
    const bookId = parsed?.bookId ?? route?.bookId;
    const chapter = parsed?.chapter ?? route?.chapter;
    if (!bookId || !chapter) return;
    const next = getNextScriptureChapter(bookId, chapter);
    if (!next) return;
    await playScriptureChapter({ bookId: next.bookId, chapter: next.chapter });
  }, [effectiveSrcRef, pathname, playScriptureChapter]);

  const togglePlayScripture = useCallback(async () => {
    flushSync(() => {
      setShellAudioHomePrimed(true);
    });
    const a = audioRef.current;
    if (!a || loading) return;

    let readCh = parseReadChapterPath(pathname);
    if (!readCh && isReadBibleHomePath(pathname)) {
      const eff = effectiveSrcRef.current.trim();
      if (playing && eff && isCuvChapterAudioEffectiveSrc(eff)) {
        a.pause();
        setPlaying(false);
        return;
      }
      const start = await prepareTodayReadingAudioSessionFromStart();
      if (!start) return;
      const tid = await fetchDefaultTranslationIdCached();
      if (!tid || !translationSupportsChapterAudio(tid)) return;
      setPlanFlowActive(true);
      setScriptureAudioRepeatMode("off", { persist: false });
      readCh = start.first;
      router.push(`/read/${readCh.bookId}/${readCh.chapter}?planFlow=1`);
    }
    if (!readCh) return;

    const tid = await fetchDefaultTranslationIdCached();
    if (!tid || !translationSupportsChapterAudio(tid)) return;

    const bookMeta = scriptureBooks.find((b) => b.bookId === readCh!.bookId);
    if (!bookMeta) return;

    const planSession = await prepareReadingPlanAudioSessionForChapter(readCh.bookId, readCh.chapter);
    if (planSession || readPlanFlowActive()) {
      setScriptureAudioRepeatMode("off", { persist: false });
    }
    const playVoice = effectiveVoiceId(readCh.bookId);
    const resolved = await resolveChapterAudioPlayableSrc({
      translationId: tid,
      bookName: bookMeta.bookName,
      bookId: readCh.bookId,
      chapter: readCh.chapter,
      voiceId: playVoice,
    });
    if (!resolved.ok) return;

    const want = resolved.src.trim();
    const ov = playbackOverrideRef.current?.trim() ?? "";
    const already = audioUrlEquals(a, want) || (Boolean(ov) && shellPlaybackUrlsEqual(ov, want));
    if (!already) {
      playAfterNextBindRef.current = true;
      setPlaybackSrc(want);
      return;
    }
    if (!a.paused) {
      a.pause();
      setPlaying(false);
      return;
    }
    await attemptShellPlay(a);
  }, [
    audioRef,
    attemptShellPlay,
    effectiveSrcRef,
    effectiveVoiceId,
    loading,
    pathname,
    playAfterNextBindRef,
    playbackOverrideRef,
    playing,
    router,
    setPlaybackSrc,
    setPlaying,
    setScriptureAudioRepeatMode,
    setShellAudioHomePrimed,
  ]);

  const togglePlayMusic = useCallback(() => {
    const a = audioRef.current;
    if (!a || loading) return;
    if (!isMusicShellPath(pathname)) {
      flushSync(() => {
        setShellAudioHomePrimed(true);
      });
    }

    const st = storeRef.current;
    const eff = effectiveSrcRef.current.trim();

    if (eff && isCuvChapterAudioEffectiveSrc(eff)) {
      if (!a.paused) {
        a.pause();
        setPlaying(false);
      }
      setScriptureAudioRepeatMode("off", { persist: false });
      if (st) {
        const avoid = eff;
        const pick =
          pickRandomShellAudioTrackSrc(st, avoid)?.trim() || getShellDefaultAudioSrc(st)?.trim() || "";
        if (pick) {
          playAfterNextBindRef.current = true;
          const def = getShellDefaultAudioSrc(st)?.trim() ?? "";
          if (def && shellPlaybackUrlsEqual(pick, def)) setPlaybackSrc(null);
          else setPlaybackSrc(pick);
        }
      }
      return;
    }

    if (!eff) {
      if (st) {
        const boot = getShellDefaultAudioSrc(st)?.trim() ?? "";
        if (boot) {
          playAfterNextBindRef.current = true;
          setPlaybackSrc(boot);
        }
      }
      return;
    }

    if (!a.paused) {
      a.pause();
      setPlaying(false);
      return;
    }

    void attemptShellPlay(a);
  }, [
    audioRef,
    attemptShellPlay,
    effectiveSrcRef,
    loading,
    pathname,
    playAfterNextBindRef,
    setPlaybackSrc,
    setPlaying,
    setScriptureAudioRepeatMode,
    setShellAudioHomePrimed,
    storeRef,
  ]);

  return {
    pauseScripturePlayback,
    playScriptureChapter,
    skipScriptureNext,
    togglePlayScripture,
    togglePlayMusic,
  };
}
