"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { useReadChapterHref } from "@/hooks/useReadChapterHref";
import { useMusicShellPlayback } from "@/components/music/MusicShellPlaybackContext";
import type { AppLocale } from "@/lib/i18n/config";
import { toZhTwText } from "@/lib/i18n/zh-tw-text";
import { resolveReadChapterNeighbors } from "@/lib/bible/read-chapter-neighbors";
import { tryParseCuvChapterAudioEffectiveSrc } from "@/lib/bible/parse-cuv-chapter-audio-src";
import {
  formatReadingPlanRange,
  readingPlanChapterHref,
} from "@/lib/bible/reading-plans/format-reading-range";
import { isTripleLoopPlanId } from "@/lib/bible/reading-plans/triple-loop-plan";
import type { ReadingPlanRange } from "@/lib/bible/reading-plans/types";
import { readOnboardingNicknameSync } from "@/lib/onboarding/onboarding-devotion-prefs";
import { getReadingPlanDaySinceEpoch } from "@/lib/read/reading-plan-epoch";
import {
  isReadChapterCompleted,
  markReadChapterCompleted,
  readCompletedChapterKeySet,
  subscribeReadChapterCompletion,
} from "@/lib/read/read-chapter-completion";
import { isTodayReadingPlanItemComplete } from "@/lib/read/today-reading-chapter-fraction";
import {
  getEffectiveReadingPlanPrefsSnapshot,
  getEffectiveReadingPlanPrefsServerSnapshot,
  resolveReadingPlanDayIndex,
  subscribeReadingPlanPrefs,
} from "@/lib/read/reading-plan-prefs";
import { loadTodayReadingPlanPayload } from "@/lib/read/today-reading-plan-payload";
import {
  buildTodayReadingScopeKey,
  markTodayReadingChapterVisit,
  readTodayReadingDoneKeys,
  setTodayReadingItemDone,
  subscribeTodayReadingDone,
  todayReadingItemKey,
} from "@/lib/read/today-reading-done";
import {
  getTripleLoopProgressServerSnapshot,
  getTripleLoopProgressSnapshot,
  subscribeTripleLoopProgress,
} from "@/lib/read/triple-loop-progress";

type Props = {
  bookId: string;
  chapter: number;
};

type ChapterRef = { bookId: string; chapter: number };

const TODAY_COMPLETE_CELEBRATION_SHOWN_KEY_PREFIX = "askbible-today-complete-celebration-shown-v1";
const LOGO_YELLOW = "#ffb101";

function formatDisplayNickname(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function sameChapter(a: ChapterRef, b: ChapterRef): boolean {
  return a.bookId === b.bookId && a.chapter === b.chapter;
}

function ReadChapterCompletionPlanPanel({
  bookId,
  chapter,
  displayLocale,
}: {
  bookId: string;
  chapter: number;
  displayLocale: AppLocale;
}) {
  const chapterHref = useReadChapterHref();
  const prefs = useSyncExternalStore(
    subscribeReadingPlanPrefs,
    getEffectiveReadingPlanPrefsSnapshot,
    getEffectiveReadingPlanPrefsServerSnapshot,
  );
  const isTripleLoop = isTripleLoopPlanId(prefs.planId);
  const tripleProgress = useSyncExternalStore(
    subscribeTripleLoopProgress,
    getTripleLoopProgressSnapshot,
    getTripleLoopProgressServerSnapshot,
  );
  const tripleProgressKey = isTripleLoop
    ? `${tripleProgress.ot.bookId}:${tripleProgress.ot.chapter}|${tripleProgress.nt.bookId}:${tripleProgress.nt.chapter}|${tripleProgress.wisdom.bookId}:${tripleProgress.wisdom.chapter}`
    : "";

  const [readings, setReadings] = useState<ReadingPlanRange[]>([]);
  const [loading, setLoading] = useState(true);
  const [doneKeys, setDoneKeys] = useState<Set<string>>(new Set());
  const [completedChapterKeys, setCompletedChapterKeys] = useState<Set<string>>(new Set());
  const [celebrateVisible, setCelebrateVisible] = useState(false);
  const [scopeKey, setScopeKey] = useState<string | null>(null);
  const [nickname, setNickname] = useState("");
  const [hasShownCelebrateForScope, setHasShownCelebrateForScope] = useState<boolean | null>(null);

  const isEnglishDisplay = displayLocale === "en";
  const localeZhText = useCallback(
    (text: string) => (displayLocale === "zh-TW" ? toZhTwText(text) : text),
    [displayLocale],
  );

  useEffect(() => {
    setNickname(readOnboardingNicknameSync());
  }, []);

  useEffect(() => {
    if (!scopeKey) {
      setHasShownCelebrateForScope(null);
      return;
    }
    try {
      const key = `${TODAY_COMPLETE_CELEBRATION_SHOWN_KEY_PREFIX}:${scopeKey}`;
      setHasShownCelebrateForScope(localStorage.getItem(key) === "1");
    } catch {
      setHasShownCelebrateForScope(false);
    }
  }, [scopeKey]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const dayCount = prefs.dayCount ?? 365;
        const payload = await loadTodayReadingPlanPayload(prefs, { dayCount });
        if (cancelled) return;
        const key = buildTodayReadingScopeKey({
          planId: prefs.planId,
          isTripleLoop,
          epochDay: getReadingPlanDaySinceEpoch(),
          dayIndex: isTripleLoop ? null : resolveReadingPlanDayIndex(prefs, dayCount),
        });
        setReadings(payload?.day?.readings ?? []);
        setScopeKey(key);
      } catch {
        if (cancelled) return;
        setReadings([]);
        setScopeKey(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [prefs, isTripleLoop, tripleProgressKey]);

  const reloadDoneKeys = useCallback(() => {
    if (!scopeKey) {
      setDoneKeys(new Set());
      return;
    }
    setDoneKeys(readTodayReadingDoneKeys(scopeKey));
  }, [scopeKey]);

  useEffect(() => {
    reloadDoneKeys();
  }, [reloadDoneKeys]);

  useEffect(() => subscribeTodayReadingDone(reloadDoneKeys), [reloadDoneKeys]);

  const reloadCompletedChapterKeys = useCallback(() => {
    setCompletedChapterKeys(readCompletedChapterKeySet());
  }, []);

  useEffect(() => {
    reloadCompletedChapterKeys();
  }, [reloadCompletedChapterKeys]);

  useEffect(() => subscribeReadChapterCompletion(reloadCompletedChapterKeys), [reloadCompletedChapterKeys]);

  const isReadingDone = useCallback(
    (r: ReadingPlanRange) =>
      isTodayReadingPlanItemComplete(r, {
        itemKey: todayReadingItemKey(r, prefs.planId),
        doneKeys,
        completedChapterKeys,
      }),
    [completedChapterKeys, doneKeys, prefs.planId],
  );

  const chapterQueue = useMemo(
    () =>
      readings.flatMap((r) => {
        const refs: ChapterRef[] = [];
        for (let ch = r.startChapter; ch <= r.endChapter; ch += 1) {
          refs.push({ bookId: r.bookId, chapter: ch });
        }
        return refs;
      }),
    [readings],
  );
  const currentChapter = useMemo<ChapterRef>(() => ({ bookId, chapter }), [bookId, chapter]);
  const currentQueueIndex = useMemo(
    () => chapterQueue.findIndex((ref) => sameChapter(ref, currentChapter)),
    [chapterQueue, currentChapter],
  );
  const neighbors = useMemo(() => resolveReadChapterNeighbors(bookId, chapter), [bookId, chapter]);
  const nextTarget =
    currentQueueIndex >= 0 && chapterQueue.length > 0
      ? chapterQueue[(currentQueueIndex + 1) % chapterQueue.length]
      : null;
  const displayName = formatDisplayNickname(nickname);

  const allDone = useMemo(() => {
    if (!readings.length) return false;
    return readings.every((r) => isReadingDone(r));
  }, [readings, isReadingDone]);

  useEffect(() => {
    if (!allDone || !scopeKey || hasShownCelebrateForScope !== false) return;
    setCelebrateVisible(true);
    setHasShownCelebrateForScope(true);
    try {
      localStorage.setItem(`${TODAY_COMPLETE_CELEBRATION_SHOWN_KEY_PREFIX}:${scopeKey}`, "1");
    } catch {
      /* ignore */
    }
    try {
      const audio = new Audio("/audio/today-plan-complete.mp3");
      audio.volume = 1;
      void audio.play();
    } catch {
      /* ignore */
    }
  }, [allDone, hasShownCelebrateForScope, scopeKey]);

  const toggleDone = useCallback(
    (r: ReadingPlanRange) => {
      if (!scopeKey) return;
      const key = todayReadingItemKey(r, prefs.planId);
      const done = !isReadingDone(r);
      const next = setTodayReadingItemDone(scopeKey, key, done);
      setDoneKeys(next);
    },
    [scopeKey, isReadingDone, prefs.planId],
  );

  if (loading || !readings.length) return null;

  return (
    <>
      <section className="read-chapter-completion-plan mx-auto mt-10 w-full max-w-[360px] rounded-2xl border border-[rgba(113,84,53,0.34)] bg-[rgba(249,240,222,0.95)] px-4 py-4 text-center shadow-[0_5px_14px_rgba(58,39,24,0.14)] dark:border-stone-600/35 dark:bg-stone-900/90">
        <p className="text-[clamp(1.75rem,5vw,2.125rem)] font-bold leading-tight text-[#2A170A] dark:text-stone-50">
          {displayName || (isEnglishDisplay ? "Friend" : localeZhText("你"))}
        </p>
        <p className="mt-0.5 text-[clamp(1.25rem,3.5vw,1.5rem)] font-bold leading-snug text-[#2A170A] dark:text-stone-100">
          {isEnglishDisplay ? "🎉 Great job! This chapter is complete." : localeZhText("🎉 非常好！本章已完成")}
        </p>

        <ul className="mt-2.5 space-y-2 text-left">
          {readings.map((r) => {
            const key = todayReadingItemKey(r, prefs.planId);
            const done = isReadingDone(r);
            const label = formatReadingPlanRange(r, displayLocale);
            return (
              <li key={key} className="flex min-h-[42px] items-center gap-2">
                <button
                  type="button"
                  aria-checked={done}
                  role="checkbox"
                  className="inline-flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-md text-[16px] text-amber-950/80"
                  onClick={() => toggleDone(r)}
                >
                  {done ? "☑" : "☐"}
                </button>
                <Link
                  href={readingPlanChapterHref(r.bookId, r.startChapter, true)}
                  className={[
                    "flex min-h-[38px] flex-1 items-center justify-between gap-2 py-1 text-[18px] font-medium leading-snug",
                    done
                      ? "text-[#6A5B49] line-through dark:text-stone-500"
                      : "text-[#2F2014] dark:text-stone-100",
                  ].join(" ")}
                >
                  <span>{label}</span>
                  <span aria-hidden className="text-[#6A543B] dark:text-stone-400">
                    ›
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="mt-3.5 border-t border-[rgba(113,84,53,0.25)] pt-3 dark:border-stone-600/40">
          {nextTarget ? (
            <Link
              href={readingPlanChapterHref(nextTarget.bookId, nextTarget.chapter, true)}
              className="inline-flex min-h-[54px] w-full items-center justify-center rounded-[14px] border border-[rgba(181,124,0,0.9)] px-3 py-3 text-[18px] font-semibold text-[#2C1B0F]"
              style={{ backgroundColor: LOGO_YELLOW }}
            >
              {isEnglishDisplay ? "Continue Plan..." : localeZhText("继续计划……")}
            </Link>
          ) : (
            <Link
              href="/read"
              className="inline-flex min-h-[54px] w-full items-center justify-center rounded-[14px] border border-[rgba(116,87,57,0.28)] bg-[rgba(255,251,242,0.9)] px-3 py-3 text-[18px] font-semibold text-[#2C1E12] dark:border-stone-600/40 dark:bg-stone-800/80 dark:text-stone-100"
            >
              {isEnglishDisplay ? "Back to Read Home" : localeZhText("回到读经首页")}
            </Link>
          )}
        </div>
      </section>

      <nav
        className="mx-auto mt-1 flex w-full max-w-[360px] items-center justify-between"
        aria-label={isEnglishDisplay ? "Chapter navigation" : localeZhText("章节导航")}
      >
        {neighbors.prev ? (
          <Link
            href={chapterHref(neighbors.prev.bookId, neighbors.prev.chapter)}
            className="inline-flex min-h-8 min-w-8 items-center justify-center text-[26px] leading-none text-[#6A543B] dark:text-stone-400"
            aria-label={isEnglishDisplay ? "Previous chapter" : localeZhText("上一章")}
          >
            {"<"}
          </Link>
        ) : (
          <span className="inline-flex min-h-8 min-w-8 items-center justify-center text-[26px] opacity-20">{"<"}</span>
        )}
        <Link
          href="/read"
          className="px-2 py-1 text-[17px] font-medium text-[#6A543B] dark:text-stone-400"
        >
          {isEnglishDisplay ? "Back Home" : localeZhText("返回主页")}
        </Link>
        {neighbors.next ? (
          <Link
            href={chapterHref(neighbors.next.bookId, neighbors.next.chapter)}
            className="inline-flex min-h-8 min-w-8 items-center justify-center text-[26px] leading-none text-[#6A543B] dark:text-stone-400"
            aria-label={isEnglishDisplay ? "Next chapter" : localeZhText("下一章")}
          >
            {">"}
          </Link>
        ) : (
          <span className="inline-flex min-h-8 min-w-8 items-center justify-center text-[26px] opacity-20">{">"}</span>
        )}
      </nav>

      {celebrateVisible ? (
        <div className="fixed inset-0 z-[125] flex items-center justify-center bg-[rgba(15,11,8,0.45)] p-5">
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-[360px] rounded-2xl border border-amber-900/15 bg-[rgba(255,252,245,0.98)] px-4 py-5 text-center shadow-xl dark:border-stone-600/30 dark:bg-stone-900/98"
          >
            <p className="text-[16px] tracking-[0.3em] text-amber-900/70">✨ 🎉 ✨</p>
            <p className="mt-2 text-[34px]">🎉</p>
            <h2 className="mt-2 text-[22px] font-semibold text-amber-950 dark:text-stone-50">
              {isEnglishDisplay ? "Great Job!" : localeZhText("恭喜你，今天完成了！")}
            </h2>
            <p className="mt-2 text-[13px] leading-relaxed text-amber-900/68 dark:text-stone-400">
              {isEnglishDisplay
                ? "You completed all today's readings. Keep this quiet rhythm tomorrow."
                : localeZhText("你已完成今天所有读经计划。愿你把这份安静带进下一天。")}
            </p>
            <div className="mt-3.5 space-y-2">
              <button
                type="button"
                onClick={() => setCelebrateVisible(false)}
                className="inline-flex min-h-[54px] w-full items-center justify-center rounded-[14px] border border-[rgba(116,87,57,0.28)] bg-[rgba(255,251,242,0.9)] px-3 py-3 text-[18px] font-semibold text-[#2C1E12] dark:border-stone-600/40 dark:bg-stone-800/80 dark:text-stone-100"
              >
                {isEnglishDisplay ? "Keep Reading" : localeZhText("继续阅读")}
              </button>
              <Link
                href="/read"
                onClick={() => setCelebrateVisible(false)}
                className="inline-flex min-h-[54px] w-full items-center justify-center rounded-[14px] border border-[rgba(181,124,0,0.9)] px-3 py-3 text-[18px] font-semibold text-[#2C1B0F]"
                style={{ backgroundColor: LOGO_YELLOW }}
              >
                {isEnglishDisplay ? "Back to Home" : localeZhText("回到读经首页")}
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function ReadChapterCompletionSection({ bookId, chapter }: Props) {
  const { locale } = useLocale();
  const { currentSec, durationSec, playing, effectiveSrc } = useMusicShellPlayback();
  const [completed, setCompleted] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const markedRef = useRef(false);
  const scrollIntentRef = useRef(false);

  useEffect(() => {
    markedRef.current = false;
    scrollIntentRef.current = false;
    setCompleted(isReadChapterCompleted(bookId, chapter));
    if (isReadChapterCompleted(bookId, chapter)) markedRef.current = true;
  }, [bookId, chapter]);

  const markChapterDone = useCallback(() => {
    if (markedRef.current) return;
    markedRef.current = true;
    setCompleted(true);
    markReadChapterCompleted(bookId, chapter);
    void markTodayReadingChapterVisit(bookId, chapter);
  }, [bookId, chapter]);

  useEffect(() => {
    if (completed) return;

    const onScroll = () => {
      const el = sentinelRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (window.scrollY > 12) scrollIntentRef.current = true;
      if (!scrollIntentRef.current) return;
      if (rect.top <= window.innerHeight + 48) {
        markChapterDone();
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [completed, markChapterDone]);

  useEffect(() => {
    if (completed || !playing) return;
    const parsed = tryParseCuvChapterAudioEffectiveSrc(effectiveSrc);
    if (!parsed || parsed.bookId !== bookId || parsed.chapter !== chapter) return;
    if (durationSec <= 0) return;
    if (currentSec >= Math.max(0, durationSec - 1.2)) {
      markChapterDone();
    }
  }, [completed, playing, effectiveSrc, currentSec, durationSec, bookId, chapter, markChapterDone]);

  const isEnglish = locale === "en";
  const completedLabel = isEnglish ? "Completed" : locale === "zh-TW" ? toZhTwText("已完成读经") : "已完成读经";

  return (
    <div className="read-chapter-completion-section">
      {completed ? (
        <>
          <div className="mx-auto mt-8 flex max-w-[360px] items-center justify-center gap-2 text-[#6E835E]">
            <span aria-hidden className="text-[20px]">
              ✓
            </span>
            <span className="text-[15px] font-semibold tracking-[0.02em]">{completedLabel}</span>
          </div>
          <ReadChapterCompletionPlanPanel bookId={bookId} chapter={chapter} displayLocale={locale} />
        </>
      ) : null}
      <div ref={sentinelRef} className="pointer-events-none h-px w-full" aria-hidden />
    </div>
  );
}
