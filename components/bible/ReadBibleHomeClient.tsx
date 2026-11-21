"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BibleCatalogReadOutline } from "@/components/bible/BibleCatalogReadOutline";
import { ReadBibleHomeVerseRotator } from "@/components/bible/ReadBibleHomeVerseRotator";
import { ReadBibleTypographySettingsControl } from "@/components/bible/ReadBibleTypographySettingsControl";
import { useReadWideQuickPanels } from "@/components/bible/ReadWideQuickPanels";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { ShellMaterialIcon } from "@/components/shell/ShellMaterialIcon";
import { useTodayReadingPlan } from "@/hooks/useTodayReadingPlan";
import { useReadHomeScripturePlaybackReady } from "@/hooks/useReadHomeScripturePlaybackReady";
import { useReadBibleTranslationSettings } from "@/components/bible/ReadBibleTypographyProvider";
import { getScriptureCanonCatalogSectionsClient } from "@/lib/bible/scripture-canon-catalog-client";
import type { ReadingPlanRegistryEntry } from "@/lib/bible/reading-plans/types";
import type { AppLocale } from "@/lib/i18n/config";
import { toZhTwText } from "@/lib/i18n/zh-tw-text";
import type { ReadHomeVerseItem } from "@/lib/read/read-home-verse-rotation";
import { readLastReadPosition, type ReadLastPosition } from "@/lib/read/read-last-position";

type Props = {
  readingPlanRegistry: ReadingPlanRegistryEntry[];
  homeVerses: ReadHomeVerseItem[];
};

function pickCopy(zh: string, en: string, locale: AppLocale): string {
  if (locale === "en") return en;
  if (locale === "zh-TW") return toZhTwText(zh);
  return zh;
}

/** `/read` 圣经目录 — 零遮挡顶栏 + 直达搜索框 + 继续阅读书签条 + 双列典籍目录（对齐 iOS/Android CatalogView）。 */
export function ReadBibleHomeClient({ readingPlanRegistry, homeVerses }: Props) {
  const { locale, t } = useLocale();
  const { isWideScreen, openPanel } = useReadWideQuickPanels();
  const catalogSections = useMemo(
    () => getScriptureCanonCatalogSectionsClient(locale),
    [locale],
  );
  const plan = useTodayReadingPlan(readingPlanRegistry);
  const { translation } = useReadBibleTranslationSettings();
  useReadHomeScripturePlaybackReady({
    payload: plan.payload,
    defaultTranslationId: translation.primaryTranslationId,
  });
  const [lastRead, setLastRead] = useState<ReadLastPosition | null>(null);

  useEffect(() => {
    setLastRead(readLastReadPosition());
  }, []);

  const hasCatalog = catalogSections.length > 0;

  return (
    <div className="read-bible-home-root relative mx-auto flex w-full max-w-[420px] shrink-0 flex-col">
      {/* 顶栏：圣经 + 译本排版胶囊 + 书签/笔记 */}
      <header className="mb-3 flex items-center justify-between gap-2">
        <h1 className="font-serif text-[28px] font-bold leading-tight tracking-tight text-[#231A12] dark:text-[#EDE2CF]">
          {t("pages.read.title")}
        </h1>
        <div className="flex items-center gap-2">
          <ReadBibleTypographySettingsControl triggerVariant="translationPill" />
          {isWideScreen ? (
            <button
              type="button"
              aria-label={t("pages.read.chapterChromeFavorites")}
              onClick={() => openPanel("favorites")}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#D8C6AA] bg-[#FAF5EC]/92 text-[#3C2E20] shadow-sm transition hover:bg-[#F3E9D8] dark:border-[#3E3328] dark:bg-[#262019]/92 dark:text-[#EDE2CF]"
            >
              <ShellMaterialIcon name="bookmark-border" size={19} color="currentColor" />
            </button>
          ) : (
            <Link
              href="/read/favorites"
              aria-label={t("pages.read.chapterChromeFavorites")}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#D8C6AA] bg-[#FAF5EC]/92 text-[#3C2E20] no-underline shadow-sm transition hover:bg-[#F3E9D8] dark:border-[#3E3328] dark:bg-[#262019]/92 dark:text-[#EDE2CF]"
            >
              <ShellMaterialIcon name="bookmark-border" size={19} color="currentColor" />
            </Link>
          )}
        </div>
      </header>

      {/* 搜索框（支持经文引用直达，如 约 3:16） */}
      {isWideScreen ? (
        <button
          type="button"
          onClick={() => openPanel("search")}
          className="mb-3 flex w-full items-center gap-2.5 rounded-2xl border border-[#DFD0B8] bg-[#FAF5EC]/88 px-3.5 py-2.5 text-left text-[13.5px] text-[#8B7358] shadow-sm transition hover:bg-[#FAF5EC] dark:border-[#3A3026] dark:bg-[#221C16]/90 dark:text-[#9E8E78]"
        >
          <ShellMaterialIcon name="search" size={18} color="currentColor" />
          <span className="truncate">
            {pickCopy("搜索经文，或输入如 约 3:16 直达…", "Search verses or jump e.g. John 3:16…", locale)}
          </span>
        </button>
      ) : (
        <Link
          href="/read/search"
          className="mb-3 flex w-full items-center gap-2.5 rounded-2xl border border-[#DFD0B8] bg-[#FAF5EC]/88 px-3.5 py-2.5 text-[13.5px] text-[#8B7358] no-underline shadow-sm transition hover:bg-[#FAF5EC] dark:border-[#3A3026] dark:bg-[#221C16]/90 dark:text-[#9E8E78]"
        >
          <ShellMaterialIcon name="search" size={18} color="currentColor" />
          <span className="truncate">
            {pickCopy("搜索经文，或输入如 约 3:16 直达…", "Search verses or jump e.g. John 3:16…", locale)}
          </span>
        </Link>
      )}

      {/* 继续上次阅读书签条 */}
      {lastRead ? (
        <Link
          href={`/read/${encodeURIComponent(lastRead.bookId)}/${lastRead.chapter}`}
          className="mb-3 flex items-center justify-between gap-2 rounded-2xl border border-[#C1660B]/30 bg-[#FBF4E4]/95 px-3.5 py-2.5 no-underline shadow-sm transition hover:border-[#C1660B]/55 dark:border-[#E2A84B]/30 dark:bg-[#2A2218]"
        >
          <div className="flex min-w-0 items-center gap-2">
            <span className="text-[13px] text-[#C1660B] dark:text-[#E2A84B]">✦</span>
            <span className="truncate text-[13px] font-semibold text-[#3C2E20] dark:text-[#EDE2CF]">
              {locale === "en"
                ? `Continue: ${lastRead.bookName} ${lastRead.chapter}`
                : pickCopy(`继续上次阅读：${lastRead.bookName} 第 ${lastRead.chapter} 章`, "", locale)}
            </span>
          </div>
          <span className="shrink-0 text-[13px] font-semibold text-[#C1660B] dark:text-[#E2A84B]">›</span>
        </Link>
      ) : null}

      <section className="read-bible-read-home-catalog mt-1 w-full min-w-0 shrink-0">
        <div className="read-bible-read-home-catalog-scroll w-full">
          {hasCatalog ? (
            <div className="bible-catalog-page--read bible-catalog-on-parchment min-h-0 w-full">
              <BibleCatalogReadOutline
                sections={catalogSections}
                homeMode
                activeBookId={lastRead?.bookId}
              />
            </div>
          ) : (
            <p className="mt-3 text-center text-[14px] leading-relaxed text-amber-900/62 dark:text-stone-500">
              {t("pages.read.catalogOutlineCta")}
            </p>
          )}
        </div>
      </section>

      <ReadBibleHomeVerseRotator verses={homeVerses} />
    </div>
  );
}
