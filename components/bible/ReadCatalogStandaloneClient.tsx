"use client";

import { useEffect, useState } from "react";
import { BibleCatalogReadOutline } from "@/components/bible/BibleCatalogReadOutline";
import { useLocale } from "@/components/i18n/LocaleProvider";
import type { ScriptureCanonCatalogSection } from "@/lib/bible/read-scripture-canon-catalog";
import { readLastReadPosition } from "@/lib/read/read-last-position";

type Props = {
  catalogSections: ScriptureCanonCatalogSection[];
};

/** 独立目录页 — 对齐 iOS `ReadCatalogScreen`（homeMode=false）。 */
export function ReadCatalogStandaloneClient({ catalogSections }: Props) {
  const { t } = useLocale();
  const [lastReadBookId, setLastReadBookId] = useState<string | undefined>();
  const hasCatalog = catalogSections.length > 0;

  useEffect(() => {
    const pos = readLastReadPosition();
    setLastReadBookId(pos?.bookId);
  }, []);

  return (
    <div className="read-bible-catalog-standalone relative flex w-full shrink-0 flex-col">
      <section className="read-bible-read-home-catalog mt-2 w-full min-w-0 shrink-0">
        <div className="read-bible-read-home-catalog-scroll mx-auto w-full max-w-[380px]">
          {hasCatalog ? (
            <div className="bible-catalog-page--read bible-catalog-on-parchment min-h-0 w-full">
              <BibleCatalogReadOutline
                sections={catalogSections}
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
    </div>
  );
}
