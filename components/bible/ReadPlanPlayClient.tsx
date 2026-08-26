"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ReadNtDeepRepeatStagesBelowToday } from "@/components/bible/ReadNtDeepRepeatStagesBelowToday";
import { ReadPlanPlayMonthCalendar } from "@/components/bible/ReadPlanPlayMonthCalendar";
import { ReadScripturePlaybackDock } from "@/components/bible/ReadScripturePlaybackDock";
import { useCuvChapterAudioVoice } from "@/components/bible/CuvChapterAudioVoiceContext";
import { useReadBibleTranslationSettings } from "@/components/bible/ReadBibleTypographyProvider";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { useMusicShellPlayback } from "@/components/music/MusicShellPlaybackContext";
import { ShellMaterialIcon } from "@/components/shell/ShellMaterialIcon";
import { useReadHomeScripturePlaybackReady } from "@/hooks/useReadHomeScripturePlaybackReady";
import { useReadingHabitStats } from "@/hooks/useReadingHabitStats";
import { planTitleKey, useTodayReadingPlan } from "@/hooks/useTodayReadingPlan";
import { getScriptureBookDisplayName } from "@/lib/bible/scripture-book-display-name";
import { isNtDeepRepeatPlanId } from "@/lib/bible/reading-plans/nt-deep-repeat-plan";
import { isPointerReadingPlanId } from "@/lib/bible/reading-plans/pointer-reading-plan";
import { isCuvChapterAudioEffectiveSrc, tryParseCuvChapterAudioEffectiveSrc } from "@/lib/bible/parse-cuv-chapter-audio-src";
import type { ReadingPlanRegistryEntry } from "@/lib/bible/reading-plans/types";
import { setPlanFlowActive } from "@/lib/read/plan-flow-session";
import { resolvePlanPlayContentAhead } from "@/lib/read/plan-play-content-ahead";
import { writeReadingPlanAudioSession } from "@/lib/read/reading-plan-audio-session";
import {
  getEmptyPlanPlayListenedDates,
  getPlanPlayListenedDates,
  markPlanPlayListenedDate,
  subscribePlanPlayListenedDates,
} from "@/lib/read/plan-play-listened-dates-web";
import { buildPlanChapterQueue } from "@/lib/read/read-plan-flow-nav";
import { readAheadDays, setReadingPlanAheadDays } from "@/lib/read/reading-plan-ahead";
import { toLocalDateString } from "@/lib/read/reading-plan-prefs";
import { nextScripturePlaybackRate } from "@/lib/read/scripture-playback-rate-web";
import { warmScriptureSearchWeb } from "@/lib/read/warm-scripture-search-web";
import {
  prefetchTodayReadingPlanQueueAudioWeb,
  prefetchUpcomingPlanFlowChapterAudioWeb,
} from "@/lib/read/prefetch-plan-flow-chapter-audio-web";
import {
  readTodayPlanScriptureResume,
  resolveTodayPlanScriptureStartTargetFromSaved,
} from "@/lib/read/today-plan-scripture-resume";
import { resolveLocalTodayReadingScopeKeyFromPrefs } from "@/lib/read/today-reading-done";
import {
  loadReadingPlanPayloadAtAhead,
  todayReadingPayloadMatchesPrefs,
  type TodayReadingPlanPayload,
} from "@/lib/read/today-reading-plan-payload";

type Props = {
  readingPlanRegistry: ReadingPlanRegistryEntry[];
};

type QueueItem = { bookId: string; chapter: number; title: string };

/** 今日读经计划页 — 对齐 App `ReadPlanPlayScreen`（月历 + 列表 + 内嵌播放坞）。 */
export function ReadPlanPlayClient({ readingPlanRegistry }: Props) {
  const router = useRouter();
  const { t, locale } = useLocale();
  const plan = useTodayReadingPlan(readingPlanRegistry);
  const { translation, chapterAudioTranslationId, translationCatalogReady } =
    useReadBibleTranslationSettings();
  const { effectiveVoiceId } = useCuvChapterAudioVoice();
  const isPointerPlan = isPointerReadingPlanId(plan.prefs.planId);
  const isNtDeepRepeat = isNtDeepRepeatPlanId(plan.prefs.planId);

  useReadHomeScripturePlaybackReady({
    payload: plan.payload,
    defaultTranslationId: translation.primaryTranslationId,
  });

  useEffect(() => {
    if (!translationCatalogReady || !translation.primaryTranslationId) return;
    void warmScriptureSearchWeb(translation.primaryTranslationId);
  }, [translation.primaryTranslationId, translationCatalogReady]);

  const [cursor, setCursor] = useState(0);
  const resumeStartSecRef = useRef(0);
  const [starting, setStarting] = useState(false);
  const [viewAhead, setViewAhead] = useState(0);
  const [browsePayload, setBrowsePayload] = useState<TodayReadingPlanPayload | null>(null);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const browsePayloadRef = useRef<TodayReadingPlanPayload | null>(null);
  browsePayloadRef.current = browsePayload;

  const {
    playing,
    loading,
    effectiveSrc,
    currentSec,
    durationSec,
    seekRatio,
    scripturePlaybackRate,
    setScripturePlaybackRate,
    scriptureAudioRepeatMode,
    setScriptureAudioRepeatMode,
    playScriptureChapter,
    pauseScripturePlayback,
    togglePlayScripture,
  } = useMusicShellPlayback();

  const committedAhead = readAheadDays(plan.prefs);
  const contentAhead = resolvePlanPlayContentAhead(viewAhead, committedAhead);
  const browsingAway = contentAhead !== committedAhead;
  const needsConfirm = browsingAway && viewAhead >= 0;

  useEffect(() => {
    setBrowsePayload((prev) =>
      prev && todayReadingPayloadMatchesPrefs(prev, plan.prefs) ? prev : null,
    );
  }, [plan.prefs.planId]);

  useEffect(() => {
    let cancelled = false;
    if (browsePayloadRef.current == null) setBrowseLoading(true);
    void loadReadingPlanPayloadAtAhead(plan.prefs, contentAhead, {
      dayCount: plan.dayCount ?? plan.prefs.dayCount,
    })
      .then((payload) => {
        if (cancelled) return;
        setBrowsePayload(payload);
        setBrowseLoading(false);
      })
      .catch(() => {
        if (!cancelled) setBrowseLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [contentAhead, plan.calendarEpochDay, plan.dayCount, plan.prefs]);

  const queue = useMemo((): QueueItem[] => {
    const titleFor = (bookId: string, chapter: number) =>
      `${getScriptureBookDisplayName(bookId, locale)} ${chapter}`;
    const readings = browsePayload?.day?.readings ?? plan.payload?.day?.readings ?? [];
    return buildPlanChapterQueue(readings).map((ref) => ({
      bookId: ref.bookId,
      chapter: ref.chapter,
      title: titleFor(ref.bookId, ref.chapter),
    }));
  }, [browsePayload?.day?.readings, locale, plan.payload?.day?.readings]);

  const scriptureActive = isCuvChapterAudioEffectiveSrc(effectiveSrc);
  const isScripturePlaying = playing && scriptureActive;
  const isPreparing = loading && scriptureActive;

  const parsedPlaying = scriptureActive ? tryParseCuvChapterAudioEffectiveSrc(effectiveSrc.trim()) : null;
  const playingIndex =
    parsedPlaying != null
      ? queue.findIndex(
          (item) =>
            item.bookId === parsedPlaying.bookId && item.chapter === parsedPlaying.chapter,
        )
      : -1;
  const activeIndex = playingIndex >= 0 ? playingIndex : cursor;

  useEffect(() => {
    if (queue.length === 0) {
      setCursor(0);
      return;
    }
    setCursor((prev) => Math.max(0, Math.min(prev, queue.length - 1)));
  }, [queue.length]);

  useEffect(() => {
    if (playingIndex >= 0) setCursor(playingIndex);
  }, [playingIndex]);

  useEffect(() => {
    if (playingIndex >= 0 || queue.length === 0) return;
    const scopeKey = resolveLocalTodayReadingScopeKeyFromPrefs(plan.prefs);
    const saved = readTodayPlanScriptureResume();
    const start = resolveTodayPlanScriptureStartTargetFromSaved(queue, scopeKey, saved);
    if (!start) return;
    const idx = queue.findIndex(
      (item) => item.bookId === start.target.bookId && item.chapter === start.target.chapter,
    );
    if (idx >= 0) {
      setCursor(idx);
      resumeStartSecRef.current = start.startAtSec;
    }
  }, [plan.prefs, playingIndex, queue]);

  useEffect(() => {
    if (!translationCatalogReady || queue.length === 0) return;
    const first = queue[0];
    if (!first) return;
    const run = () => {
      void prefetchTodayReadingPlanQueueAudioWeb(
        [{ bookId: first.bookId, chapter: first.chapter }],
        {
          translationId: chapterAudioTranslationId,
          voiceId: effectiveVoiceId(first.bookId),
          awaitFirst: false,
        },
      );
    };
    if (typeof window !== "undefined" && typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(run, { timeout: 4000 });
      return () => window.cancelIdleCallback(id);
    }
    const timer = window.setTimeout(run, 1200);
    return () => window.clearTimeout(timer);
  }, [chapterAudioTranslationId, effectiveVoiceId, queue, translationCatalogReady]);

  const planName = useMemo(() => {
    const key = planTitleKey(plan.prefs.planId);
    const localized = t(key);
    if (localized !== key) return localized;
    return plan.payload?.name?.trim() || t("pages.read.planPlayTitle");
  }, [plan.payload?.name, plan.prefs.planId, t]);

  const planDayNumber = useMemo(() => {
    if (isPointerPlan) {
      return Math.max(1, plan.calendarEpochDay + contentAhead);
    }
    if (plan.dayIndex != null) {
      return plan.dayIndex + 1 + contentAhead;
    }
    return null;
  }, [contentAhead, isPointerPlan, plan.calendarEpochDay, plan.dayIndex]);

  const dayMeta =
    planDayNumber != null
      ? t("pages.read.todayPlanDayMeta").replace("{{n}}", String(planDayNumber))
      : null;

  const planPlayListenedDates = useSyncExternalStore(
    subscribePlanPlayListenedDates,
    getPlanPlayListenedDates,
    getEmptyPlanPlayListenedDates,
  );
  const { completedDates: habitCompletedDates } = useReadingHabitStats();
  const listenedDates = useMemo(() => {
    const merged = new Set<string>(planPlayListenedDates);
    for (const date of habitCompletedDates) merged.add(date);
    return merged;
  }, [habitCompletedDates, planPlayListenedDates]);

  const markViewDateListened = useCallback(() => {
    const viewDate = new Date();
    viewDate.setDate(viewDate.getDate() + viewAhead);
    markPlanPlayListenedDate(toLocalDateString(viewDate));
  }, [viewAhead]);

  const syncPlanPlayAudioSession = useCallback(() => {
    if (queue.length === 0) return;
    const dayIndex =
      browsePayload?.dayIndex ??
      plan.effectiveDayIndex ??
      plan.dayIndex ??
      0;
    writeReadingPlanAudioSession({
      version: 1,
      planId: plan.prefs.planId,
      dayIndex,
      queue: queue.map((q) => ({ bookId: q.bookId, chapter: q.chapter })),
    });
    setPlanFlowActive(true);
  }, [
    browsePayload?.dayIndex,
    plan.dayIndex,
    plan.effectiveDayIndex,
    plan.prefs.planId,
    queue,
  ]);

  const playAtIndex = useCallback(
    async (index: number) => {
      const target = queue[index];
      if (!target) return false;
      setStarting(true);
      try {
        markViewDateListened();
        const startAtSec = resumeStartSecRef.current > 0 ? resumeStartSecRef.current : undefined;
        resumeStartSecRef.current = 0;
        await playScriptureChapter({
          bookId: target.bookId,
          chapter: target.chapter,
          bookName: getScriptureBookDisplayName(target.bookId, locale),
          translationId: chapterAudioTranslationId,
          startAtSec,
        });
        syncPlanPlayAudioSession();
        setCursor(index);
        window.setTimeout(() => {
          prefetchUpcomingPlanFlowChapterAudioWeb(
            queue.map((item) => ({ bookId: item.bookId, chapter: item.chapter })),
            { bookId: target.bookId, chapter: target.chapter },
            {
              translationId: chapterAudioTranslationId,
              voiceId: effectiveVoiceId(target.bookId),
              ahead: 2,
            },
          );
        }, 4_000);
        return true;
      } finally {
        setStarting(false);
      }
    },
    [
      chapterAudioTranslationId,
      effectiveVoiceId,
      locale,
      markViewDateListened,
      playScriptureChapter,
      queue,
      syncPlanPlayAudioSession,
    ],
  );

  const onTogglePlay = useCallback(async () => {
    if (isScripturePlaying) {
      pauseScripturePlayback();
      return;
    }
    if (queue.length === 0) return;
    if (playingIndex >= 0 && !isScripturePlaying) {
      markViewDateListened();
      togglePlayScripture();
      return;
    }
    await playAtIndex(activeIndex);
  }, [
    activeIndex,
    isScripturePlaying,
    markViewDateListened,
    pauseScripturePlayback,
    playAtIndex,
    playingIndex,
    queue.length,
    togglePlayScripture,
  ]);

  const onNext = useCallback(async () => {
    if (queue.length === 0) return;
    const nextIndex = Math.min(queue.length - 1, activeIndex + 1);
    setCursor(nextIndex);
    if (isScripturePlaying || isPreparing) {
      await playAtIndex(nextIndex);
    }
  }, [activeIndex, isPreparing, isScripturePlaying, playAtIndex, queue.length]);

  const onOpenSearch = useCallback(() => {
    const target = queue[activeIndex];
    const q = target ? `?bookId=${encodeURIComponent(target.bookId)}&chapter=${target.chapter}` : "";
    router.push(`/read/search${q}`);
  }, [activeIndex, queue, router]);

  const onSelectCalendarAhead = useCallback((ahead: number) => {
    setViewAhead(ahead);
    setCursor(0);
  }, []);

  const onConfirmDay = useCallback(async () => {
    if (!needsConfirm || confirmBusy) return;
    setConfirmBusy(true);
    try {
      setReadingPlanAheadDays(contentAhead);
      setViewAhead(0);
    } finally {
      setConfirmBusy(false);
    }
  }, [confirmBusy, contentAhead, needsConfirm]);

  const onReadChapter = useCallback(
    (index: number) => {
      const target = queue[index];
      if (!target) return;
      router.push(`/read/${encodeURIComponent(target.bookId)}/${target.chapter}`);
    },
    [queue, router],
  );

  const rowTapRef = useRef<{ index: number; at: number } | null>(null);
  const onRowPress = useCallback(
    (index: number) => {
      const now = Date.now();
      const last = rowTapRef.current;
      if (last && last.index === index && now - last.at < 320) {
        rowTapRef.current = null;
        onReadChapter(index);
        return;
      }
      rowTapRef.current = { index, at: now };
      void playAtIndex(index);
    },
    [onReadChapter, playAtIndex],
  );

  const trackMeta =
    queue.length > 0
      ? t("pages.read.planPlayTrackMeta")
          .replace("{{current}}", String(activeIndex + 1))
          .replace("{{total}}", String(queue.length))
      : null;

  const busy = starting || isPreparing;
  const hasQueue = queue.length > 0;

  const loopMode =
    scriptureAudioRepeatMode === "chapter"
      ? "chapter"
      : scriptureAudioRepeatMode === "book"
        ? "book"
        : "off";

  return (
    <div className="read-plan-play-screen relative flex min-h-0 flex-1 flex-col">
      <div className="read-plan-play-screen__scroll mx-auto w-full max-w-[380px] flex-1 overflow-y-auto px-3 pb-4 pt-[calc(env(safe-area-inset-top,0px)+0.75rem)]">
        <header className="read-plan-play-screen__top-bar relative mb-3 flex min-h-10 items-center justify-center">
          <h1 className="read-plan-play-screen__plan-title px-10 text-center text-[20px] font-bold leading-tight text-[var(--bc-read-book)]">
            {planName}
          </h1>
          <Link
            href="/read/plans"
            className="read-plan-play-screen__settings absolute right-0 top-1/2 inline-flex -translate-y-1/2 p-1 text-[var(--bc-read-muted)]"
            aria-label={t("pages.read.todayPlanChange")}
          >
            <ShellMaterialIcon name="settings" size={22} color="currentColor" />
          </Link>
        </header>

        {plan.loading && queue.length === 0 ? (
          <p className="py-12 text-center text-sm text-[var(--bc-read-muted)]">{t("pages.read.todayPlanLoading")}</p>
        ) : !hasQueue ? (
          <p className="py-12 text-center text-sm text-[var(--bc-read-muted)]">{t("pages.read.todayPlanEmpty")}</p>
        ) : (
          <div className="read-plan-play-screen__queue">
            <ReadPlanPlayMonthCalendar
              prefs={plan.prefs}
              dayCount={plan.dayCount ?? plan.prefs.dayCount}
              viewAhead={viewAhead}
              onSelectAhead={onSelectCalendarAhead}
              listenedDates={listenedDates}
            />

            {needsConfirm ? (
              <button
                type="button"
                className="read-plan-play-screen__confirm mb-3 w-full rounded-xl bg-[var(--bc-read-book)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                disabled={confirmBusy}
                onClick={() => void onConfirmDay()}
              >
                {confirmBusy ? t("pages.read.todayPlanLoading") : t("pages.read.planPlayConfirmDay")}
              </button>
            ) : null}

            <div className="read-plan-play-screen__queue-header mb-2 grid grid-cols-[1fr_auto_1fr] items-end gap-1">
              <p className="text-[12px] text-[var(--bc-read-muted)]">{dayMeta ?? " "}</p>
              <h2 className="text-center text-[15px] font-semibold text-[var(--bc-read-book)]">
                {t("pages.read.todayPlanTitle")}
              </h2>
              <p className="text-right text-[12px] tabular-nums text-[var(--bc-read-muted)]">{trackMeta ?? " "}</p>
            </div>

            {browseLoading && queue.length === 0 ? (
              <p className="py-3 text-center text-sm text-[var(--bc-read-muted)]">{t("pages.read.todayPlanLoading")}</p>
            ) : null}

            <ul className="read-plan-play-screen__list space-y-1">
              {queue.map((item, index) => {
                const active = activeIndex === index;
                return (
                  <li key={`${item.bookId}:${item.chapter}:${index}`}>
                    <div
                      role="button"
                      tabIndex={0}
                      className={[
                        "read-plan-play-screen__row flex items-center gap-2 rounded-lg px-2 py-2.5",
                        active ? "read-plan-play-screen__row--active" : "",
                        busy ? "opacity-60" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      onClick={() => !busy && onRowPress(index)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          if (!busy) onRowPress(index);
                        }
                      }}
                    >
                      <span
                        className={[
                          "w-7 shrink-0 text-[13px] tabular-nums",
                          active ? "font-bold text-[var(--bc-read-book)]" : "text-[var(--bc-read-muted)]",
                        ].join(" ")}
                      >
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span
                        className={[
                          "min-w-0 flex-1 truncate text-[15px]",
                          active ? "font-semibold text-[var(--bc-read-book)]" : "text-[var(--bc-read-book)]",
                        ].join(" ")}
                      >
                        {item.title}
                      </span>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          className="read-plan-play-screen__row-action inline-flex h-9 w-9 items-center justify-center rounded-full text-[var(--bc-read-muted)]"
                          aria-label={t("pages.read.planPlayReadChapter")}
                          onClick={(e) => {
                            e.stopPropagation();
                            onReadChapter(index);
                          }}
                        >
                          <ShellMaterialIcon name="menu-book" size={20} color="currentColor" />
                        </button>
                        <button
                          type="button"
                          className="read-plan-play-screen__row-action inline-flex h-9 w-9 items-center justify-center rounded-full text-[var(--bc-read-muted)] disabled:opacity-40"
                          aria-label={t("pages.read.planPlayPlayChapterAudio")}
                          aria-pressed={active && isScripturePlaying}
                          disabled={busy}
                          onClick={(e) => {
                            e.stopPropagation();
                            void playAtIndex(index);
                          }}
                        >
                          <ShellMaterialIcon
                            name={active && isScripturePlaying ? "graphic-eq" : "volume-up"}
                            size={20}
                            color="currentColor"
                          />
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {isNtDeepRepeat ? (
          <ReadNtDeepRepeatStagesBelowToday
            onStageSet={() => {
              setViewAhead(0);
              setCursor(0);
            }}
          />
        ) : null}
      </div>

      <div className="read-plan-play-screen__dock pointer-events-none sticky bottom-0 z-20 flex justify-center px-3">
        <ReadScripturePlaybackDock
          visible={hasQueue}
          busy={busy}
          disabled={!hasQueue}
          className="pointer-events-auto bg-[var(--bc-read-surface,rgba(250,246,238,0.96))] backdrop-blur-sm"
          playing={isScripturePlaying}
          preparing={isPreparing}
          currentSec={currentSec}
          durationSec={durationSec}
          seekRatio={seekRatio}
          scripturePlaybackRate={scripturePlaybackRate}
          loopMode={loopMode}
          onTogglePlay={() => void onTogglePlay()}
          onNext={() => void onNext()}
          onRead={onOpenSearch}
          readIconName="search"
          readAccessibilityLabel={t("pages.read.chapterChromeSearch")}
          onCycleRate={() => setScripturePlaybackRate(nextScripturePlaybackRate(scripturePlaybackRate))}
          onCycleLoop={() => {
            const next =
              scriptureAudioRepeatMode === "off"
                ? "chapter"
                : scriptureAudioRepeatMode === "chapter"
                  ? "book"
                  : "off";
            setScriptureAudioRepeatMode(next);
          }}
        />
      </div>
    </div>
  );
}
