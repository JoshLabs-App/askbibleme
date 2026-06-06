"use client";

import Link from "next/link";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { ENCOURAGING_WORDS_SECTIONS } from "@/lib/explore/encouraging-words-content";
import type { AppLocale } from "@/lib/i18n/config";

function sectionTitle(titleZh: string, titleEn: string, locale: AppLocale): string {
  return locale === "en" ? titleEn : titleZh;
}

export function ExploreEncouragingWordsContent() {
  const { t, locale } = useLocale();

  return (
    <div className="mx-auto w-full max-w-md flex-1 px-5 pb-24 pt-2 text-ink md:px-8">
      <p className="text-[13px]">
        <Link
          href="/explore"
          className="font-medium text-ink/72 underline decoration-ink/20 underline-offset-[0.2em] hover:text-ink/90"
        >
          {t("pages.explore.encouragingWordsBack")}
        </Link>
      </p>

      <header className="mt-4 text-center">
        <h1 className="font-serif text-[clamp(1.5rem,4.5vw,2rem)] font-semibold leading-snug tracking-[0.02em] text-ink/92">
          {t("pages.explore.encouragingWordsTitle")}
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-ink/68">{t("pages.explore.encouragingWordsSubtitle")}</p>
      </header>

      <div className="mt-6 space-y-3">
        {ENCOURAGING_WORDS_SECTIONS.map((section) => (
          <section
            key={section.titleEn}
            className="rounded-[14px] border border-ink/10 bg-canvas/70 px-3.5 py-3.5"
          >
            <h2 className="text-[16px] font-semibold text-[#65775C]">
              {sectionTitle(section.titleZh, section.titleEn, locale)}
            </h2>
            <ul className="mt-2.5 space-y-3">
              {section.quotes.map((quote) => (
                <li key={quote.id} className="space-y-0.5">
                  <p className="text-[14px] font-semibold leading-snug text-ink/90">
                    {quote.id}. {quote.en}
                  </p>
                  <p className="text-[14px] leading-snug text-ink/72">{quote.zh}</p>
                  {quote.ref ? (
                    <p className="text-[12px] font-medium text-ink/48">— {quote.ref}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
