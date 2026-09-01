"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { ReadingPlannerDirectionStep } from "@/components/explore/reading-planner/ReadingPlannerDirectionStep";
import { ReadingPlannerPlanStep } from "@/components/explore/reading-planner/ReadingPlannerPlanStep";
import type { ReadingPlanRegistryEntry } from "@/lib/bible/reading-plans/types";
import {
  activateReadingPlanFromPlanner,
  isReadingPlannerChoiceActive,
  readCurrentPlannerChoice,
  readingPlannerChoiceMaxStartDay,
  readingPlannerChoiceSupportsStartDay,
  type ReadingPlannerPlanChoice,
} from "@/lib/explore/reading-planner/activate-reading-plan-from-planner";
import { getReadingPlannerDirectionCards } from "@/lib/explore/reading-planner/reading-planner-data";
import {
  getReadingPlanPrefsServerSnapshot,
  getReadingPlanPrefsSnapshot,
  resolveEffectiveReadingPlanPrefs,
  subscribeReadingPlanPrefs,
} from "@/lib/read/reading-plan-prefs";
import { readPlanPlayHref } from "@/lib/read/read-plan-play-route";
import { toZhTwText } from "@/lib/i18n/zh-tw-text";
import "@/components/explore/reading-planner/reading-planner.css";

const LOGO_YELLOW = "#ffb101";
const STEP_COUNT = 2;

export type UnifiedReadingWelcomeFlowProps = {
  entry: "welcome" | "explore";
  onComplete?: () => void;
  registryPlans: ReadingPlanRegistryEntry[];
};

/** 对齐 App `UnifiedReadingWelcomeFlow`：轻松读经向导（探索 / 欢迎共用结构）。 */
export function UnifiedReadingWelcomeFlow({ entry, onComplete, registryPlans }: UnifiedReadingWelcomeFlowProps) {
  const router = useRouter();
  const { locale } = useLocale();
  const zhText = (text: string) => (locale === "zh-TW" ? toZhTwText(text) : text);

  const stored = useSyncExternalStore(
    subscribeReadingPlanPrefs,
    getReadingPlanPrefsSnapshot,
    getReadingPlanPrefsServerSnapshot,
  );
  const prefs = useMemo(() => resolveEffectiveReadingPlanPrefs(stored), [stored]);

  const [step, setStep] = useState<1 | 2>(1);
  const [choice, setChoice] = useState<ReadingPlannerPlanChoice>({ type: "triple-loop" });
  const [startDay, setStartDay] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [prefsHydrated, setPrefsHydrated] = useState(false);

  const directionCards = useMemo(() => getReadingPlannerDirectionCards(locale), [locale]);

  useEffect(() => {
    const current = readCurrentPlannerChoice();
    if (current) setChoice(current);
    setPrefsHydrated(true);
  }, []);

  const progressText = useMemo(() => {
    if (locale === "en") return `Step ${step} of ${STEP_COUNT}`;
    return zhText(`第 ${step} 步（共 ${STEP_COUNT} 步）`);
  }, [locale, step, zhText]);

  const brandLabel =
    entry === "welcome"
      ? "AskBible.me"
      : locale === "en"
        ? "Easy reading"
        : zhText("轻松读经");

  const isActiveChoice = isReadingPlannerChoiceActive(choice, prefs);

  const handleChoiceChange = (next: ReadingPlannerPlanChoice) => {
    setChoice(next);
    const max = readingPlannerChoiceMaxStartDay(next);
    setStartDay((prev) => Math.min(Math.max(1, prev), max));
  };

  const handleStartDayChange = (next: number) => {
    const max = readingPlannerChoiceMaxStartDay(choice);
    setStartDay(Math.min(max, Math.max(1, Math.floor(next))));
  };

  const handleSkip = () => {
    if (submitting) return;
    if (entry === "explore") {
      router.push("/explore");
      return;
    }
    onComplete?.();
  };

  const goBack = () => {
    if (step === 1) {
      if (entry === "explore") router.back();
      return;
    }
    setStep(1);
  };

  const goSetPlan = () => {
    if (submitting) return;
    setStep(2);
  };

  const confirmPlan = () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const supportsStartDay = readingPlannerChoiceSupportsStartDay(choice);
      const startDayToApply = supportsStartDay ? startDay : 1;
      if (step === 2) {
        activateReadingPlanFromPlanner(choice, { startDay: startDayToApply });
      }
      if (entry === "explore") {
        router.replace(readPlanPlayHref());
        return;
      }
      onComplete?.();
    } finally {
      setSubmitting(false);
    }
  };

  const goPrimary = () => {
    if (step === 1 && entry === "explore") {
      goSetPlan();
      return;
    }
    if (step === 1 && entry === "welcome") {
      onComplete?.();
      return;
    }
    confirmPlan();
  };

  const primaryLabel = useMemo(() => {
    if (step === 1) {
      if (entry === "explore") {
        return locale === "en" ? "Next" : zhText("下一页");
      }
      return locale === "en" ? "Start" : zhText("开始");
    }
    const supportsStartDay = readingPlannerChoiceSupportsStartDay(choice);
    if (supportsStartDay && startDay > 1) {
      return locale === "en" ? `Start from day ${startDay}` : zhText(`从第 ${startDay} 天开始`);
    }
    if (isActiveChoice) {
      return locale === "en" ? "Start today's reading" : zhText("开始今日读经");
    }
    return locale === "en" ? "Enable this plan" : zhText("启用这个计划");
  }, [step, entry, locale, isActiveChoice, choice, startDay, zhText]);

  const setPlanLabel = locale === "en" ? "Set up reading plan" : zhText("设置读经计划");
  const skipLabel = locale === "en" ? "Skip" : zhText("略过");
  const showBack = step > 1 || entry === "explore";

  return (
    <div className="reading-planner-flow">
      <div className="reading-planner-flow__inner">
        <header className="reading-planner-flow__header">
          <div className="reading-planner-flow__top-actions">
            {showBack ? (
              <button type="button" className="reading-planner-flow__back" onClick={goBack} disabled={submitting}>
                ←
              </button>
            ) : (
              <span className="reading-planner-flow__top-side" aria-hidden />
            )}
            <button type="button" className="reading-planner-flow__skip" onClick={handleSkip} disabled={submitting}>
              {skipLabel}
            </button>
          </div>
          <p className="reading-planner-flow__brand">{brandLabel}</p>
          <div className="reading-planner-flow__brand-line" />
          <p className="reading-planner-flow__progress">{progressText}</p>
          <div className="reading-planner-flow__dots" aria-hidden>
            {[1, 2].map((dot) => (
              <span
                key={dot}
                className={[
                  "reading-planner-flow__dot",
                  step >= dot ? "reading-planner-flow__dot--active" : "",
                ].join(" ")}
              />
            ))}
          </div>
        </header>

        <div className="reading-planner-flow__content">
          {step === 1 ? <ReadingPlannerDirectionStep locale={locale} cards={directionCards} /> : null}
          {step === 2 && prefsHydrated ? (
            <ReadingPlannerPlanStep
              locale={locale}
              choice={choice}
              onChange={handleChoiceChange}
              startDay={startDay}
              onStartDayChange={handleStartDayChange}
              registryPlans={registryPlans}
            />
          ) : null}
        </div>

        <footer className="reading-planner-flow__footer">
          <button
            type="button"
            disabled={submitting || (step === 2 && !prefsHydrated)}
            className="reading-planner-flow__primary"
            style={{ backgroundColor: LOGO_YELLOW }}
            onClick={goPrimary}
          >
            {primaryLabel}
          </button>
          {step === 1 && entry === "welcome" ? (
            <button type="button" className="reading-planner-flow__secondary" onClick={goSetPlan} disabled={submitting}>
              {setPlanLabel}
            </button>
          ) : null}
          {entry === "explore" && step === 2 ? (
            <Link href="/explore" className="reading-planner-flow__secondary">
              {locale === "en" ? "Back to Explore" : zhText("返回探索页")}
            </Link>
          ) : null}
        </footer>
      </div>
    </div>
  );
}
