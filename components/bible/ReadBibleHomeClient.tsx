"use client";

import { useEffect, useState } from "react";
import { BibleCatalogReadOutline } from "@/components/bible/BibleCatalogReadOutline";
import { ReadBibleHomeTopActions } from "@/components/bible/ReadBibleHomeTopActions";
import { ReadBibleHomeVerseRotator } from "@/components/bible/ReadBibleHomeVerseRotator";
import {
  ReadTodayPlanFooter,
  ReadTodayPlanReadings,
} from "@/components/bible/ReadTodayPlanPanel";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { useTodayReadingPlan } from "@/hooks/useTodayReadingPlan";
import type { ScriptureCanonCatalogSection } from "@/lib/bible/read-scripture-canon-catalog";
import type { ReadingPlanRegistryEntry } from "@/lib/bible/reading-plans/types";
import type { ReadHomeVerseItem } from "@/lib/read/read-home-verse-rotation";
import { readLastReadPosition } from "@/lib/read/read-last-position";

type Props = {
  catalogSections: ScriptureCanonCatalogSection[];
  readingPlanRegistry: ReadingPlanRegistryEntry[];
  homeVerses: ReadHomeVerseItem[];
};

/** `/read` 首页 — 对齐 iOS `ReadCatalogScreen`（homeMode）。 */
export function ReadBibleHomeClient({ catalogSections, readingPlanRegistry, homeVerses }: Props) {
  const { t } = useLocale();
  const plan = useTodayReadingPlan(readingPlanRegistry);
  const [lastReadBookId, setLastReadBookId] = useState<string | undefined>();

  useEffect(() => {
    const pos = readLastReadPosition();
    setLastReadBookId(pos?.bookId);
  }, []);

  const hasCatalog = catalogSections.length > 0;

  return (
    <div className="read-bible-home-root relative flex w-full shrink-0 flex-col">
      <ReadBibleHomeTopActions />

      <div className="read-bible-home-top-stack w-full">
        <header className="read-bible-home-hero w-full shrink-0 self-center px-1 text-center">
          <h1 className="read-bible-home-title-zh mt-0.5 text-balance">
            {t("pages.read.title")}
          </h1>
        </header>

        <div className="w-full">
          <ReadTodayPlanReadings plan={plan} />
        </div>
      </div>

      <section className="read-bible-read-home-catalog mt-2 w-full min-w-0 shrink-0">
        <div className="read-bible-read-home-catalog-scroll mx-auto w-full max-w-[380px]">
          {hasCatalog ? (
            <div className="bible-catalog-page--read bible-catalog-on-parchment min-h-0 w-full">
              <BibleCatalogReadOutline
                sections={catalogSections}
                paginateByTestament
                showBookSummary
                activeBookId={lastReadBookId}
              />
            </div>
          ) : (
            <p className="mt-3 text-center text-[14px] leading-relaxed text-amber-900/62 dark:text-stone-500">
              {t("pages.read.catalogOutlineCta")}
            </p>
          )}
        </div>
      </section>

      <ReadTodayPlanFooter plan={plan} variant="home" />
      <ReadBibleHomeVerseRotator verses={homeVerses} />
    </div>
  );
}
