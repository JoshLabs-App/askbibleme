"use client";

import Link from "next/link";
import { BibleCatalogReadOutline } from "@/components/bible/BibleCatalogReadOutline";
import { useLocale } from "@/components/i18n/LocaleProvider";
import type { ScriptureCanonCatalogSection } from "@/lib/bible/read-scripture-canon-catalog";
import type { ReadingPlanRegistryEntry } from "@/lib/bible/reading-plans/types";
import { ReadTodayPlanPanel } from "@/components/bible/ReadTodayPlanPanel";

type Props = {
  catalogSections: ScriptureCanonCatalogSection[];
  readingPlanRegistry: ReadingPlanRegistryEntry[];
};

/** `/read` 圣经入口：标题 → 今日读经 → 正典目录。 */
export function ReadBibleHomeClient({ catalogSections, readingPlanRegistry }: Props) {
  const { t } = useLocale();
  return (
    <div className="read-bible-home-root flex w-full shrink-0 flex-col">
      <header className="read-bible-home-hero w-full max-w-md shrink-0 self-center px-1 text-center">
        <h1
          className="read-bible-home-title-he text-balance font-semibold leading-[1.06] tracking-tight text-amber-950 dark:text-stone-50"
          dir="rtl"
          lang="he"
          aria-label={`${t("pages.read.title")} · ${t("pages.read.titleEn")} · ${t("pages.read.titleHe")}`}
        >
          {t("pages.read.titleHe")}
        </h1>
        <p className="read-bible-home-title-zh mt-4 text-balance font-semibold leading-[1.1] tracking-tight text-amber-950 dark:text-stone-50">
          {t("pages.read.title")}
        </p>
        <p className="read-bible-home-title-en mt-2.5 font-medium tracking-[0.04em] text-amber-900/82 dark:text-stone-400">
          {t("pages.read.titleEn")}
        </p>
      </header>

      <ReadTodayPlanPanel registryPlans={readingPlanRegistry} />

      <section
        className="read-bible-read-home-catalog mt-6 w-full min-w-0 shrink-0 border-t border-amber-900/10 pt-4 dark:border-stone-500/20 sm:mt-7 sm:pt-5"
        aria-labelledby="read-bible-home-catalog-heading"
      >
        <h2
          id="read-bible-home-catalog-heading"
          className="text-center text-[11px] font-semibold tracking-[0.18em] text-amber-900/72 dark:text-stone-400"
        >
          {t("pages.read.catalogSection")}
        </h2>
        <p className="mt-2 text-center text-[11px]">
          <Link
            href="/read/plans"
            className="font-medium text-amber-900/78 underline decoration-amber-800/25 underline-offset-[0.2em] hover:text-amber-950 hover:decoration-amber-800/45 dark:text-stone-400 dark:decoration-stone-500/35 dark:hover:text-stone-200 dark:hover:decoration-stone-400/55"
          >
            {t("pages.read.plansCta")}
          </Link>
        </p>
        <div className="read-bible-read-home-catalog-scroll mt-3">
          <div className="bible-catalog-page--read bible-catalog-on-parchment mx-auto min-h-0 w-full max-w-none">
            <BibleCatalogReadOutline sections={catalogSections} />
          </div>
        </div>
      </section>
    </div>
  );
}
