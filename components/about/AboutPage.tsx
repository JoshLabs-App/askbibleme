"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo } from "react";
import { StaticParchmentPageFooter } from "@/components/shell/StaticParchmentPageFooter";
import { useLocale } from "@/components/i18n/LocaleProvider";
import {
  ABOUT_PAGE_COPY,
  type AboutHighlight,
  type AboutPrinciple,
} from "@/components/about/about-page-copy";
import { toZhTwText } from "@/lib/i18n/zh-tw-text";
import {
  getSolutionCards,
  type SolutionCard,
} from "@/lib/onboarding/onboarding-devotion-data";
import { ASKBIBLE_PRODUCT_NAME } from "@/lib/askbible-product-name";

const LOGO_GOLD = "#ffb101";

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

function CoreValueCard({ card }: { card: SolutionCard }) {
  return (
    <article className="flex items-start gap-2.5 rounded-[18px] border border-[rgba(120,53,15,0.2)] bg-[rgba(255,252,245,0.92)] px-3.5 py-3.5">
      <span className="inline-flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[11px] bg-[rgba(255,177,1,0.16)] text-[18px]">
        {solutionIconGlyph(card.icon)}
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="whitespace-pre-line text-[16px] font-semibold leading-snug text-[#2b1d15]">
          {card.title}
        </h3>
        <p className="mt-1 whitespace-pre-line text-[14px] leading-relaxed text-[rgba(43,29,21,0.76)]">
          {card.description}
        </p>
      </div>
    </article>
  );
}

function PrincipleRow({ item }: { item: AboutPrinciple }) {
  return (
    <div className="rounded-[14px] border border-[rgba(120,53,15,0.14)] bg-[rgba(255,252,245,0.55)] px-4 py-3">
      <p className="text-[15px] font-semibold leading-snug text-[#2b1d15]">{item.title}</p>
      <p className="mt-1 text-[14px] leading-relaxed text-[rgba(43,29,21,0.72)]">{item.body}</p>
    </div>
  );
}

function HighlightCard({ item }: { item: AboutHighlight }) {
  return (
    <section className="rounded-[18px] border border-[rgba(120,53,15,0.18)] bg-[rgba(255,252,245,0.88)] px-4 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[rgba(77,53,34,0.55)]">
        {item.eyebrow}
      </p>
      <h3 className="mt-1.5 text-[16px] font-semibold leading-snug text-[#2b1d15]">{item.title}</h3>
      <p className="mt-2 text-[14px] leading-relaxed text-[rgba(43,29,21,0.74)]">{item.body}</p>
    </section>
  );
}

export function AboutPage() {
  const { locale } = useLocale();
  const isEn = locale === "en";
  const base = isEn ? ABOUT_PAGE_COPY.en : ABOUT_PAGE_COPY["zh-CN"];
  const zhText = (text: string) => (locale === "zh-TW" ? toZhTwText(text) : text);
  const copy = useMemo(
    () =>
      isEn
        ? base
        : {
            ...base,
            eyebrow: zhText(base.eyebrow),
            tagline: zhText(base.tagline),
            lead: zhText(base.lead),
            coreValuesHeading: zhText(base.coreValuesHeading),
            coreValuesIntro: zhText(base.coreValuesIntro),
            principlesHeading: zhText(base.principlesHeading),
            principles: base.principles.map((item) => ({
              title: zhText(item.title),
              body: zhText(item.body),
            })),
            highlightsHeading: zhText(base.highlightsHeading),
            highlights: base.highlights.map((item) => ({
              ...item,
              eyebrow: zhText(item.eyebrow),
              title: zhText(item.title),
              body: zhText(item.body),
            })),
            notHeading: zhText(base.notHeading),
            notIntro: zhText(base.notIntro),
            notItems: base.notItems.map(zhText),
            closing: zhText(base.closing),
            ctaEnter: zhText(base.ctaEnter),
            ctaInstall: zhText(base.ctaInstall),
            footerFeedback: zhText(base.footerFeedback),
            footerPrivacy: zhText(base.footerPrivacy),
            footerInstall: zhText(base.footerInstall),
            footerHome: zhText(base.footerHome),
          },
    [base, isEn, locale],
  );
  const coreValues = useMemo(() => getSolutionCards(locale), [locale]);

  return (
    <div className="narrow-parchment-root select-text">
        <header className="text-center">
          <div
            className="mx-auto flex h-[72px] w-[72px] items-center justify-center overflow-hidden rounded-[18px] border border-[rgba(120,53,15,0.14)] shadow-[0_8px_24px_-12px_rgba(15,40,60,0.14)]"
            style={{ backgroundColor: LOGO_GOLD }}
          >
            <Image
              src="/branding/app-icon.png"
              alt={ASKBIBLE_PRODUCT_NAME}
              width={72}
              height={72}
              className="h-full w-full object-cover"
              priority
            />
          </div>
          <p className="mt-5 text-[12px] font-semibold uppercase tracking-[0.14em] text-[rgba(77,53,34,0.62)]">
            {copy.eyebrow}
          </p>
          <p className="mt-3 text-[18px] font-semibold tracking-[0.04em] text-[#4d3522]">
            {ASKBIBLE_PRODUCT_NAME}
          </p>
          <div className="mx-auto mt-2 h-px w-[86px]" style={{ backgroundColor: "rgba(255,177,1,0.62)" }} />
          <h1 className="mt-4 font-serif text-[clamp(1.35rem,4.5vw,1.75rem)] font-medium leading-snug tracking-[0.02em] text-[#2b1d15]">
            {copy.tagline}
          </h1>
          <p className="mx-auto mt-4 max-w-md text-[15px] leading-[1.75] text-[rgba(43,29,21,0.76)]">
            {copy.lead}
          </p>
        </header>

        <section className="mt-10" aria-labelledby="about-core-values-heading">
          <h2
            id="about-core-values-heading"
            className="text-center text-[1.05rem] font-bold tracking-[0.01em] text-[#2b1d15]"
          >
            {copy.coreValuesHeading}
          </h2>
          <p className="mt-2 px-1 text-center text-[14px] leading-relaxed text-[rgba(43,29,21,0.72)]">
            {copy.coreValuesIntro}
          </p>
          <div className="mt-4 space-y-2.5">
            {coreValues.map((card) => (
              <CoreValueCard key={card.id} card={card} />
            ))}
          </div>
        </section>

        <section className="mt-10" aria-labelledby="about-principles-heading">
          <h2
            id="about-principles-heading"
            className="text-center text-[1.05rem] font-bold tracking-[0.01em] text-[#2b1d15]"
          >
            {copy.principlesHeading}
          </h2>
          <div className="mt-4 space-y-2.5">
            {copy.principles.map((item) => (
              <PrincipleRow key={item.title} item={item} />
            ))}
          </div>
        </section>

        <section className="mt-10" aria-labelledby="about-highlights-heading">
          <h2
            id="about-highlights-heading"
            className="text-center text-[1.05rem] font-bold tracking-[0.01em] text-[#2b1d15]"
          >
            {copy.highlightsHeading}
          </h2>
          <div className="mt-4 space-y-2.5">
            {copy.highlights.map((item) => (
              <HighlightCard key={item.eyebrow} item={item} />
            ))}
          </div>
        </section>

        <section
          className="mt-10 rounded-[18px] border border-[rgba(120,53,15,0.14)] bg-[rgba(255,252,245,0.45)] px-4 py-5"
          aria-labelledby="about-not-heading"
        >
          <h2
            id="about-not-heading"
            className="text-[15px] font-semibold tracking-[0.01em] text-[#2b1d15]"
          >
            {copy.notHeading}
          </h2>
          <p className="mt-2 text-[14px] leading-relaxed text-[rgba(43,29,21,0.68)]">{copy.notIntro}</p>
          <ul className="mt-3 space-y-2 text-[14px] leading-relaxed text-[rgba(43,29,21,0.74)]">
            {copy.notItems.map((item) => (
              <li key={item} className="flex gap-2.5">
                <span className="mt-[0.55rem] h-1 w-1 shrink-0 rounded-full bg-[rgba(77,53,34,0.35)]" aria-hidden />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        <p className="mt-10 text-center text-[15px] leading-[1.8] text-[rgba(43,29,21,0.78)]">{copy.closing}</p>

        <div className="mt-8 flex flex-col items-stretch gap-3">
          <Link
            href="/"
            className="inline-flex min-h-[50px] items-center justify-center rounded-full px-5 text-[15px] font-bold tracking-[0.02em] text-[#fffdf8] transition hover:brightness-[0.98] active:scale-[0.99]"
            style={{ backgroundColor: LOGO_GOLD }}
          >
            {copy.ctaEnter}
          </Link>
          <Link
            href="/install"
            className="inline-flex min-h-[50px] items-center justify-center rounded-full border border-[rgba(120,53,15,0.22)] bg-[rgba(255,252,245,0.88)] px-5 text-[15px] font-semibold text-[#2b1d15] transition hover:border-[rgba(120,53,15,0.32)] active:scale-[0.99]"
          >
            {copy.ctaInstall}
          </Link>
        </div>

        <StaticParchmentPageFooter />
    </div>
  );
}
