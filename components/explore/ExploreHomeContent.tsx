"use client";

import Link from "next/link";
import { EXPLORE_ENTRIES, SCRIPTURE_ANTHOLOGY_IDS } from "@/lib/explore/exploreEntries";
import { useLocale } from "@/components/i18n/LocaleProvider";

export function ExploreHomeContent() {
  const { t, locale } = useLocale();

  const scriptureAnthologyEntries = SCRIPTURE_ANTHOLOGY_IDS.map((id) =>
    EXPLORE_ENTRIES.find((entry) => entry.id === id),
  ).filter((entry): entry is (typeof EXPLORE_ENTRIES)[number] => Boolean(entry));

  const topEntries = EXPLORE_ENTRIES.filter(
    (entry) => !SCRIPTURE_ANTHOLOGY_IDS.includes(entry.id as (typeof SCRIPTURE_ANTHOLOGY_IDS)[number]),
  );

  const anthologyHeading =
    locale === "en" ? "Scripture Anthology" : locale === "zh-TW" ? "經文彙編" : "经文汇编";

  return (
    <div className="mx-auto w-full max-w-md flex-1 px-5 pb-24 pt-6 text-ink md:px-8">
      <header className="text-center">
        <h1 className="font-serif text-[clamp(1.35rem,4vw,1.85rem)] font-medium leading-snug tracking-[0.03em] text-ink/90">
          {t("pages.explore.title")}
        </h1>
        <div className="mx-auto mt-5 h-px w-10 bg-border/55" aria-hidden />
        <p className="mt-5 text-[14px] font-normal leading-relaxed text-ink/78 sm:text-[15px]">
          {t("pages.explore.lead")}
        </p>
      </header>

      <section className="mt-12">
        <div className="grid grid-cols-3 gap-2.5">
          {topEntries.map((entry) => (
            <Link
              key={entry.id}
              href={entry.href}
              className="flex flex-col items-center rounded-2xl border border-ink/10 bg-canvas/60 px-2 py-4 text-center transition hover:border-ink/18 hover:bg-canvas/85"
            >
              <span
                aria-hidden
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-ink/10 bg-canvas/80 text-[1.35rem]"
              >
                {entry.icon}
              </span>
              <span className="mt-2.5 line-clamp-2 text-[12px] font-medium leading-snug text-ink/82">
                {t(entry.labelKey)}
              </span>
            </Link>
          ))}
        </div>

        <div className="my-8 h-px bg-border/50" aria-hidden />

        <p className="text-center text-[12px] font-medium tracking-[0.06em] text-muted uppercase">
          {anthologyHeading}
        </p>

        <div className="mt-4 grid grid-cols-3 gap-2.5">
          {scriptureAnthologyEntries.map((entry) => (
            <Link
              key={entry.id}
              href={entry.href}
              className="flex flex-col items-center rounded-2xl border border-ink/10 bg-canvas/60 px-2 py-4 text-center transition hover:border-ink/18 hover:bg-canvas/85"
            >
              <span
                aria-hidden
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-ink/10 bg-canvas/80 text-[1.35rem]"
              >
                {entry.icon}
              </span>
              <span className="mt-2.5 line-clamp-2 text-[12px] font-medium leading-snug text-ink/82">
                {t(entry.labelKey)}
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
