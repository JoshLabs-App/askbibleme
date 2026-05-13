"use client";

import Link from "next/link";
import { useLocale } from "@/components/i18n/LocaleProvider";

export function ExploreHomeContent() {
  const { t } = useLocale();

  return (
    <div className="mx-auto w-full max-w-xl flex-1 px-5 pb-24 pt-6 text-ink sm:max-w-2xl md:px-8">
      <header className="text-center">
        <h1 className="font-serif text-[clamp(1.35rem,4vw,1.85rem)] font-medium leading-snug tracking-[0.03em] text-ink/90">
          {t("pages.explore.title")}
        </h1>
        <div className="mx-auto mt-5 h-px w-10 bg-border/55" aria-hidden />
        <p className="mt-5 text-[14px] font-normal leading-relaxed text-ink/78 sm:text-[15px]">{t("pages.explore.lead")}</p>
        <p className="mt-4 text-[13px] leading-[1.65] text-muted sm:text-[14px]">{t("pages.explore.body")}</p>
      </header>

      <section className="mt-14 border-t border-ink/10 pt-10">
        <h2 className="text-center font-serif text-[1.05rem] font-medium text-ink/88">{t("pages.explore.availableHeading")}</h2>
        <p className="mx-auto mt-2 max-w-md text-center text-[12px] leading-relaxed text-muted">{t("pages.explore.availableHint")}</p>

        <ul className="mx-auto mt-8 max-w-md space-y-3">
          <li>
            <Link
              href="/prayer"
              className="flex flex-col rounded-2xl border border-ink/10 bg-canvas/60 px-5 py-4 text-left transition hover:border-ink/18 hover:bg-canvas/80"
            >
              <span className="font-serif text-[1.08rem] font-medium text-ink/90">{t("pages.explore.prayerCardTitle")}</span>
              <span className="mt-2 text-[13px] leading-relaxed text-ink/72">{t("pages.explore.prayerCardLead")}</span>
              <span className="mt-3 text-[13px] font-medium text-ink/80 underline decoration-ink/25 underline-offset-[0.2em]">
                {t("pages.explore.prayerCardCta")}
              </span>
            </Link>
          </li>
        </ul>
      </section>
    </div>
  );
}
