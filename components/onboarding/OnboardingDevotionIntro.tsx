"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import type { AppLocale } from "@/lib/i18n/config";
import { toZhTwText } from "@/lib/i18n/zh-tw-text";
import {
  getCompanionNeedOptions,
  getSolutionCards,
  type CompanionNeedOption,
  type SolutionCard,
} from "@/lib/onboarding/onboarding-devotion-data";
import {
  completeOnboardingDevotionIntro,
  readOnboardingNickname,
  type CompanionNeedId,
} from "@/lib/onboarding/onboarding-devotion-prefs";
import { trackTap } from "@/lib/telemetry/tap";

const LOGO_YELLOW = "#ffb101";

type OnboardingDevotionIntroProps = {
  onComplete: () => void;
};

function needIconGlyph(icon: string): string {
  switch (icon) {
    case "leaf":
      return "🍃";
    case "heart":
      return "♡";
    case "calendar":
      return "📅";
    case "question":
      return "?";
    case "sprout":
      return "🌱";
    default:
      return "○";
  }
}

function solutionIconGlyph(icon: string): string {
  switch (icon) {
    case "search":
      return "⌕";
    case "book":
      return "📖";
    case "candle":
      return "🕯";
    default:
      return "○";
  }
}

function OnboardingNeedStep({
  locale,
  onLocaleChange,
  selectedNeeds,
  onToggleNeed,
  options,
}: {
  locale: AppLocale;
  onLocaleChange: (next: AppLocale) => void;
  selectedNeeds: CompanionNeedId[];
  onToggleNeed: (id: CompanionNeedId) => void;
  options: CompanionNeedOption[];
}) {
  const zhText = (text: string) => (locale === "zh-TW" ? toZhTwText(text) : text);

  return (
    <div>
      <div className="mb-3.5 flex justify-center gap-2.5">
        {(["en", "zh-TW", "zh-CN"] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => onLocaleChange(item)}
            aria-pressed={locale === item}
            className={[
              "inline-flex h-9 w-9 items-center justify-center rounded-full border text-[18px] transition",
              locale === item
                ? "border-[rgba(255,177,1,0.72)] bg-[rgba(255,177,1,0.16)]"
                : "border-[rgba(120,53,15,0.18)] bg-white/70",
            ].join(" ")}
          >
            {item === "en" ? "🇺🇸" : item === "zh-TW" ? "🇹🇼" : "🇨🇳"}
          </button>
        ))}
      </div>
      <h2 className="text-center text-[clamp(1.35rem,4vw,1.75rem)] font-bold leading-snug tracking-[0.01em] text-[#2b1d15]">
        {locale === "en" ? "What kind of support do you need most?" : zhText("你最需要哪一种陪伴？")}
      </h2>
      <div className="mt-3.5 space-y-2.5">
        {options.map((option) => {
          const selected = selectedNeeds.includes(option.id);
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onToggleNeed(option.id)}
              className={[
                "flex w-full items-center gap-2.5 rounded-[18px] border px-3 py-3 text-left transition",
                selected
                  ? "border-[rgba(255,177,1,0.55)] bg-[rgba(255,252,245,0.95)]"
                  : "border-[rgba(120,53,15,0.2)] bg-[rgba(255,252,245,0.88)]",
              ].join(" ")}
            >
              <span
                className={[
                  "inline-flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[11px] text-[18px]",
                  selected ? "bg-[rgba(255,177,1,0.22)]" : "bg-[rgba(255,177,1,0.12)]",
                ].join(" ")}
              >
                {needIconGlyph(option.icon)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[16px] font-semibold leading-snug text-ink">{option.title}</span>
                <span className="mt-0.5 block whitespace-pre-line text-[14px] leading-relaxed text-[rgba(43,29,21,0.76)]">
                  {option.description}
                </span>
              </span>
              <span
                className={[
                  "inline-flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full text-[14px] font-bold",
                  selected ? "text-[#ffb101]" : "text-[rgba(138,90,11,0.45)]",
                ].join(" ")}
                aria-hidden
              >
                {selected ? "✓" : "○"}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function OnboardingSolutionStep({ locale, cards }: { locale: AppLocale; cards: SolutionCard[] }) {
  const zhText = (text: string) => (locale === "zh-TW" ? toZhTwText(text) : text);

  return (
    <div>
      <h2 className="text-center text-[clamp(1.35rem,4vw,1.75rem)] font-bold leading-snug tracking-[0.01em] text-[#2b1d15]">
        {locale === "en" ? "What Makes Us Different" : zhText("这里与众不同")}
      </h2>
      <p className="mt-1.5 px-2 text-center text-[14px] leading-relaxed text-[rgba(43,29,21,0.74)]">
        {locale === "en"
          ? "No pressure. No performance. With devotional music and Scripture support, you can always return to God's Word."
          : zhText("不靠压力，不靠打卡；用音乐灵修 + 经文支持，帮你稳定地回到神的话语。")}
      </p>
      <div className="mt-3.5 space-y-2.5">
        {cards.map((card) => (
          <article
            key={card.id}
            className="flex items-center gap-2.5 rounded-[18px] border border-[rgba(120,53,15,0.2)] bg-[rgba(255,252,245,0.88)] px-3 py-3"
          >
            <span className="inline-flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[11px] bg-[rgba(255,177,1,0.16)] text-[18px]">
              {solutionIconGlyph(card.icon)}
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="whitespace-pre-line text-[16px] font-semibold leading-snug text-ink">{card.title}</h3>
              <p className="mt-0.5 whitespace-pre-line text-[14px] leading-relaxed text-[rgba(43,29,21,0.76)]">
                {card.description}
              </p>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

export function OnboardingDevotionIntro({ onComplete }: OnboardingDevotionIntroProps) {
  const { locale, setLocale } = useLocale();
  const zhText = (text: string) => (locale === "zh-TW" ? toZhTwText(text) : text);
  const [step, setStep] = useState<1 | 2>(1);
  const [nickname, setNickname] = useState("");
  const [selectedNeeds, setSelectedNeeds] = useState<CompanionNeedId[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const companionNeedOptions = useMemo(() => getCompanionNeedOptions(locale), [locale]);
  const solutionCards = useMemo(() => getSolutionCards(locale), [locale]);
  const canOpenSpace = nickname.trim().length > 0;
  const isLastStep = step === 2;

  const progressText = useMemo(() => {
    if (locale === "en") return step === 1 ? "Step 1 of 2" : "Step 2 of 2";
    return step === 1 ? zhText("第 1 步（共 2 步）") : zhText("第 2 步（共 2 步）");
  }, [locale, step]);

  const toggleNeed = (id: CompanionNeedId) => {
    setSelectedNeeds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  useEffect(() => {
    let active = true;
    void readOnboardingNickname().then((saved) => {
      if (!active) return;
      if (saved) setNickname(saved);
    });
    return () => {
      active = false;
    };
  }, []);

  const openDevotionCompanionSpace = async () => {
    if (submitting) return;
    setSubmitting(true);
    await completeOnboardingDevotionIntro(selectedNeeds, nickname);
    onComplete();
  };

  const handleSkip = async () => {
    if (submitting) return;
    setSubmitting(true);
    trackTap("intro.skip");
    await completeOnboardingDevotionIntro([], "");
    onComplete();
  };

  const handlePrimaryButtonPress = () => {
    if (step === 1) {
      setStep(2);
      return;
    }
    void openDevotionCompanionSpace();
  };

  return (
    <div className="fixed inset-0 z-[130] overflow-y-auto bg-[#efe1c8]">
      <div className="pointer-events-none absolute -bottom-9 -left-11 h-[148px] w-[148px] rounded-full bg-[rgba(147,111,70,0.09)]" />
      <div className="pointer-events-none absolute -bottom-14 -right-13 h-[180px] w-[180px] rounded-full bg-[rgba(255,177,1,0.1)]" />

      <div className="relative mx-auto flex min-h-full w-full max-w-lg flex-col px-5 pb-6 pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="pt-1.5">
          <div className="flex min-h-6 items-center justify-end">
            <button
              type="button"
              onClick={() => void handleSkip()}
              className="px-1 text-[14px] font-semibold text-[rgba(77,53,34,0.76)]"
            >
              {locale === "en" ? "Skip" : zhText("跳过")}
            </button>
          </div>
          <p className="text-center text-[18px] font-semibold tracking-[0.04em] text-[#4d3522]">AskBible.me</p>
          <div className="mx-auto mt-2 h-px w-[86px] bg-[rgba(255,177,1,0.62)]" />
          <p className="mt-3 text-center text-[13px] text-[rgba(77,53,34,0.76)]">{progressText}</p>
          <div className="mt-2 flex justify-center gap-2">
            <span className="h-[5px] w-6 rounded-full bg-[#ffb101]" />
            <span
              className={[
                "h-[5px] w-6 rounded-full",
                step === 2 ? "bg-[#ffb101]" : "bg-[rgba(255,177,1,0.28)]",
              ].join(" ")}
            />
          </div>
        </div>

        <div className="mt-2 flex-1 pb-4">
          {step === 1 ? (
            <OnboardingNeedStep
              locale={locale}
              onLocaleChange={setLocale}
              selectedNeeds={selectedNeeds}
              onToggleNeed={toggleNeed}
              options={companionNeedOptions}
            />
          ) : (
            <OnboardingSolutionStep locale={locale} cards={solutionCards} />
          )}
        </div>

        <div className="pt-2">
          {step === 2 ? (
            <label className="mb-2.5 block">
              <span className="mb-1.5 block text-[14px] font-semibold text-[rgba(77,53,34,0.9)]">
                {locale === "en" ? "Enter your nickname" : zhText("请输入你的昵称")}
              </span>
              <input
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
                placeholder={locale === "en" ? "Enter your nickname" : zhText("请输入你的昵称")}
                autoCapitalize="off"
                autoCorrect="off"
                maxLength={24}
                className="min-h-[46px] w-full rounded-xl border border-[rgba(120,53,15,0.24)] bg-[rgba(255,252,245,0.92)] px-3.5 py-2.5 text-[16px] font-medium text-[#2b1d15] outline-none focus:border-[rgba(255,177,1,0.55)]"
              />
            </label>
          ) : null}
          <button
            type="button"
            onClick={handlePrimaryButtonPress}
            disabled={submitting || (isLastStep && !canOpenSpace)}
            className={[
              "inline-flex min-h-[54px] w-full items-center justify-center rounded-full px-4 text-[16px] font-bold tracking-[0.02em] text-[#fffdf8] transition",
              (isLastStep && !canOpenSpace) || submitting ? "opacity-45" : "hover:brightness-[0.98] active:scale-[0.99]",
            ].join(" ")}
            style={{ backgroundColor: LOGO_YELLOW }}
          >
            {isLastStep
              ? locale === "en"
                ? "Open my space"
                : zhText("打开我的空间")
              : locale === "en"
                ? "Next"
                : zhText("下一步")}
          </button>
        </div>
      </div>
    </div>
  );
}
