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
import type { AppLocale } from "@/lib/i18n/config";
import { toZhTwText } from "@/lib/i18n/zh-tw-text";
import { useMusicShellPlayback } from "@/components/music/MusicShellPlaybackContext";
import { IconPause, IconPlay } from "@/components/ui/MediaPlaybackIcons";
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

function pickPlanCopy(zh: string, en: string, locale: AppLocale): string {
  if (locale === "en") return en;
  if (locale === "zh-TW") return toZhTwText(zh);
  return zh;
}

const WEEKDAY_LABELS_ZH = ["一", "二", "三", "四", "五", "六", "日"];
const WEEKDAY_LABELS_EN = ["M", "T", "W", "T", "F", "S", "S"];

/** 今日同行页 — 对齐 iOS/Android `PlanPlayView`（7 日温和周条 + 可展开月历 + 连播今日 + 读写分离）。 */
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


  const [cursor, setCursor] = useState(0);
  const resumeStartSecRef = useRef(0);
  const [starting, setStarting] = useState(false);
  const [viewAhead, setViewAhead] = useState(0);
  const [monthExpanded, setMonthExpanded] = useState(false);
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
      // Resume in place rather than delegating to togglePlayScripture(), which re-resolves
      // the translation from the site default and can swap the paused chapter's audio out
      // from under a reader using a non-default translation (see 2af7e63b).
      markViewDateListened();
      resumeStartSecRef.current = currentSec > 0 ? currentSec : 0;
      await playAtIndex(activeIndex);
      return;
    }
    await playAtIndex(activeIndex);
  }, [
    activeIndex,
    currentSec,
    isScripturePlaying,
    markViewDateListened,
    pauseScripturePlayback,
    playAtIndex,
    playingIndex,
    queue.length,
  ]);

  const onNext = useCallback(async () => {
    if (queue.length === 0) return;
    const nextIndex = Math.min(queue.length - 1, activeIndex + 1);
    setCursor(nextIndex);
    if (isScripturePlaying || isPreparing) {
      await playAtIndex(nextIndex);
    }
  }, [activeIndex, isPreparing, isScripturePlaying, playAtIndex, queue.length]);

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

  const weekStrip = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const viewDate = new Date(today);
    viewDate.setDate(today.getDate() + viewAhead);
    const dayOfWeek = (viewDate.getDay() + 6) % 7; // Mon=0 .. Sun=6
    const monday = new Date(viewDate);
    monday.setDate(viewDate.getDate() - dayOfWeek);

    let weekDoneCount = 0;
    const days = Array.from({ length: 7 }, (_, idx) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + idx);
      const diffMs = d.getTime() - today.getTime();
      const ahead = Math.round(diffMs / 86_400_000);
      const key = toLocalDateString(d);
      const listened = listenedDates.has(key);
      if (listened) weekDoneCount += 1;
      return {
        idx,
        ahead,
        dayNum: d.getDate(),
        weekdayLabel: locale === "en" ? WEEKDAY_LABELS_EN[idx]! : WEEKDAY_LABELS_ZH[idx]!,
        isToday: ahead === 0,
        isSelected: ahead === viewAhead,
        listened,
      };
    });

    const monthTitle =
      locale === "en"
        ? viewDate.toLocaleDateString("en-US", { year: "numeric", month: "short" })
        : `${viewDate.getFullYear()}年${viewDate.getMonth() + 1}月`;

    return { days, weekDoneCount, monthTitle };
  }, [listenedDates, locale, viewAhead]);

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
      <div className="read-plan-play-screen__scroll mx-auto w-full max-w-[440px] flex-1 overflow-y-auto px-4 pb-6 pt-[calc(env(safe-area-inset-top,0px)+1rem)]">
        <header className="read-plan-play-screen__top-bar mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-serif text-[26px] font-bold leading-tight tracking-tight text-[#231A12] dark:text-[#EDE2CF]">
              {pickPlanCopy("今日同行", "Today's Walk", locale)}
            </h1>
            <p className="mt-1 truncate text-[13px] text-[#75614B] dark:text-[#A99A84]">
              {planName}
              {dayMeta ? ` · ${dayMeta}` : ""}
            </p>
          </div>
          <Link
            href="/read/plans"
            className="mt-0.5 inline-flex shrink-0 items-center rounded-full border border-[#D8C6AA] bg-[#FAF5EC]/90 px-3 py-1.5 text-[12px] font-semibold text-[#6E563A] no-underline transition hover:bg-[#F3E9D8] dark:border-[#3E3328] dark:bg-[#262019] dark:text-[#D5C3A8]"
          >
            {pickPlanCopy("换计划", "Plans", locale)}
          </Link>
        </header>

        {plan.loading && queue.length === 0 ? (
          <p className="py-12 text-center text-sm text-[var(--bc-read-muted)]">{t("pages.read.todayPlanLoading")}</p>
        ) : !hasQueue ? (
          <p className="py-12 text-center text-sm text-[var(--bc-read-muted)]">{t("pages.read.todayPlanEmpty")}</p>
        ) : (
          <div className="read-plan-play-screen__queue space-y-4">
            {/* 7 日温和周条（点击月份展开完整月历） */}
            <section className="rounded-2xl border border-[#DFD0B8] bg-[#FAF5EC]/88 p-3.5 shadow-sm dark:border-[#3A3026] dark:bg-[#221C16]/90">
              <div className="mb-2.5 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setMonthExpanded((prev) => !prev)}
                  className="inline-flex items-center gap-1 border-0 bg-transparent p-0 text-[13px] font-semibold text-[#3C2E20] dark:text-[#E5D7C1]"
                >
                  <span>{weekStrip.monthTitle}</span>
                  <span className="text-[11px] opacity-70">{monthExpanded ? "▴" : "▾"}</span>
                </button>
                <span className="text-[11.5px] text-[#8B7358] dark:text-[#9E8E78]">
                  {locale === "en"
                    ? `${weekStrip.weekDoneCount} quiet days this week`
                    : pickPlanCopy(`本周相伴 ${weekStrip.weekDoneCount} 天`, "", locale)}
                </span>
              </div>

              <div className="grid grid-cols-7 gap-1">
                {weekStrip.days.map((d) => (
                  <button
                    key={d.ahead}
                    type="button"
                    onClick={() => onSelectCalendarAhead(d.ahead)}
                    className="flex flex-col items-center gap-1 rounded-xl border-0 bg-transparent py-1 transition active:scale-95"
                  >
                    <span className="text-[11px] font-medium text-[#8B7358] dark:text-[#9E8E78]">
                      {d.weekdayLabel}
                    </span>
                    <span
                      className={[
                        "flex h-8 w-8 items-center justify-center rounded-full text-[13px] tabular-nums transition",
                        d.isSelected
                          ? "bg-[#C1660B] font-bold text-[#FFFDF9] shadow-sm dark:bg-[#D9822B] dark:text-[#1A1511]"
                          : d.isToday
                            ? "border border-[#C1660B]/60 font-semibold text-[#231A12] dark:border-[#E2A84B]/60 dark:text-[#EDE2CF]"
                            : "font-medium text-[#3C2E20] dark:text-[#D5C3A8]",
                      ].join(" ")}
                    >
                      {d.dayNum}
                    </span>
                    <span
                      className={[
                        "h-1.5 w-1.5 rounded-full",
                        d.listened
                          ? "bg-[#C1660B] dark:bg-[#E2A84B]"
                          : "bg-transparent",
                      ].join(" ")}
                      aria-hidden
                    />
                  </button>
                ))}
              </div>

              {monthExpanded ? (
                <div className="mt-3 border-t border-[#E6D9C3] pt-3 dark:border-[#362C22]">
                  <ReadPlanPlayMonthCalendar
                    prefs={plan.prefs}
                    dayCount={plan.dayCount ?? plan.prefs.dayCount}
                    viewAhead={viewAhead}
                    onSelectAhead={onSelectCalendarAhead}
                    listenedDates={listenedDates}
                  />
                </div>
              ) : null}
            </section>

            {needsConfirm ? (
              <button
                type="button"
                className="read-plan-play-screen__confirm w-full rounded-xl bg-[#231A12] px-4 py-2.5 text-sm font-semibold text-[#FAF5EC] disabled:opacity-50 dark:bg-[#E2A84B] dark:text-[#1A1511]"
                disabled={confirmBusy}
                onClick={() => void onConfirmDay()}
              >
                {confirmBusy ? t("pages.read.todayPlanLoading") : t("pages.read.planPlayConfirmDay")}
              </button>
            ) : null}

            <div className="flex items-center justify-between gap-2 pt-1">
              <div className="flex items-baseline gap-2">
                <h2 className="font-serif text-[17px] font-semibold text-[#231A12] dark:text-[#EDE2CF]">
                  {t("pages.read.todayPlanTitle")}
                </h2>
                {trackMeta ? (
                  <span className="text-[12px] tabular-nums text-[#8B7358] dark:text-[#9E8E78]">
                    {trackMeta}
                  </span>
                ) : null}
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => void onTogglePlay()}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#C1660B] px-3.5 py-1.5 text-[12.5px] font-semibold text-[#FFFDF9] shadow-sm transition hover:bg-[#A85607] active:scale-[0.98] disabled:opacity-50 dark:bg-[#D9822B] dark:text-[#1A1511]"
              >
                {isScripturePlaying ? (
                  <>
                    <IconPause className="h-3.5 w-3.5" />
                    <span>{pickPlanCopy("正在连播", "Playing", locale)}</span>
                  </>
                ) : (
                  <>
                    <IconPlay className="h-3.5 w-3.5 translate-x-[0.5px]" />
                    <span>{pickPlanCopy("连播今日", "Play All", locale)}</span>
                  </>
                )}
              </button>
            </div>

            {browseLoading && queue.length === 0 ? (
              <p className="py-3 text-center text-sm text-[var(--bc-read-muted)]">{t("pages.read.todayPlanLoading")}</p>
            ) : null}

            <ul className="read-plan-play-screen__list space-y-2">
              {queue.map((item, index) => {
                const active = activeIndex === index;
                const rowPlaying = active && isScripturePlaying;
                return (
                  <li key={`${item.bookId}:${item.chapter}:${index}`}>
                    <div
                      className={[
                        "flex items-center gap-2 rounded-2xl border px-3.5 py-2.5 transition",
                        active
                          ? "border-[#C1660B]/45 bg-[#FBF6EC] shadow-sm dark:border-[#E2A84B]/40 dark:bg-[#282119]"
                          : "border-[#E3D5BE] bg-[#FAF5EC]/75 hover:bg-[#FAF5EC] dark:border-[#362C22] dark:bg-[#211B15]/80",
                      ].join(" ")}
                    >
                      <button
                        type="button"
                        onClick={() => onReadChapter(index)}
                        className="flex min-w-0 flex-1 items-center gap-3 border-0 bg-transparent p-0 text-left"
                      >
                        <span
                          className={[
                            "w-6 shrink-0 text-[12.5px] tabular-nums",
                            active
                              ? "font-bold text-[#C1660B] dark:text-[#E2A84B]"
                              : "text-[#8B7358] dark:text-[#9E8E78]",
                          ].join(" ")}
                        >
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-serif text-[16px] font-semibold text-[#231A12] dark:text-[#EDE2CF]">
                            {item.title}
                          </div>
                          <div className="mt-0.5 text-[11.5px] text-[#8B7358] dark:text-[#9E8E78]">
                            {pickPlanCopy("点按进入经文阅读", "Tap to read chapter", locale)}
                          </div>
                        </div>
                      </button>

                      <button
                        type="button"
                        aria-label={t("pages.read.planPlayPlayChapterAudio")}
                        aria-pressed={rowPlaying}
                        disabled={busy}
                        onClick={() => {
                          if (rowPlaying) {
                            pauseScripturePlayback();
                          } else {
                            void playAtIndex(index);
                          }
                        }}
                        className={[
                          "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition active:scale-95 disabled:opacity-45",
                          rowPlaying
                            ? "border-[#C1660B] bg-[#C1660B] text-[#FFFDF9] dark:border-[#E2A84B] dark:bg-[#E2A84B] dark:text-[#1A1511]"
                            : "border-[#D8C6AA] bg-[#F3E9D8] text-[#4E3B28] hover:bg-[#EADBC3] dark:border-[#3E3328] dark:bg-[#2C241C] dark:text-[#EDE2CF]",
                        ].join(" ")}
                      >
                        {rowPlaying ? (
                          <IconPause className="h-4 w-4" />
                        ) : (
                          <IconPlay className="h-4 w-4 translate-x-[0.5px]" />
                        )}
                      </button>
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
          playing={isScripturePlaying}
          preparing={isPreparing}
          currentSec={currentSec}
          durationSec={durationSec}
          seekRatio={seekRatio}
          scripturePlaybackRate={scripturePlaybackRate}
          loopMode={loopMode}
          onTogglePlay={() => void onTogglePlay()}
          onNext={() => void onNext()}
          onRead={() => router.push("/read/search")}
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
