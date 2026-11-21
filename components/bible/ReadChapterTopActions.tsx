"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ReadBibleTypographySettingsControl } from "@/components/bible/ReadBibleTypographySettingsControl";
import { ReadChapterCatalogQuickPicker } from "@/components/bible/ReadChapterCatalogQuickPicker";
import { useReadWideQuickPanels } from "@/components/bible/ReadWideQuickPanels";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { ShellMaterialIcon } from "@/components/shell/ShellMaterialIcon";
import { getScriptureBookDisplayName } from "@/lib/bible/scripture-book-display-name";
import { parseReadChapterPathname } from "@/lib/read/resolve-chapter-page-scripture-play-target";

function IconBack() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M14.5 5 9 12l5.5 7"
        stroke="currentColor"
        strokeWidth="1.85"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const pillIconBtn =
  "inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#D8C6AA] bg-[#FAF5EC]/92 text-[#231A12] shadow-sm backdrop-blur-sm transition hover:bg-[#F3E9D8] active:scale-[0.97] dark:border-[#3E3328] dark:bg-[#262019]/92 dark:text-[#EDE2CF]";

/** 读经章零遮挡顶栏 — 取消右侧竖排 5 球遮字浮条，收纳为顶部温润羊皮纸胶囊（对齐 iOS/Android ChapterView）。 */
export function ReadChapterTopActions() {
  const { t, locale } = useLocale();
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const { isWideScreen, openPanel } = useReadWideQuickPanels();
  const [catalogOpen, setCatalogOpen] = useState(false);
  const route = useMemo(() => parseReadChapterPathname(pathname), [pathname]);
  const currentBookLabel = useMemo(() => {
    if (!route) return "";
    return getScriptureBookDisplayName(route.bookId, locale);
  }, [route, locale]);
  const searchHref = useMemo(() => {
    if (!route) return "/read/search";
    return `/read/search?bookId=${encodeURIComponent(route.bookId)}&chapter=${route.chapter}`;
  }, [route]);

  return (
    <>
      <div
        className="read-chapter-top-actions read-chapter-top-actions--left pointer-events-none absolute left-[max(0.75rem,env(safe-area-inset-left))] top-[calc(env(safe-area-inset-top,0px)+0.55rem)] z-50 flex items-center gap-1.5"
      >
        <button
          type="button"
          className={`${pillIconBtn} pointer-events-auto`}
          aria-label={t("pages.read.chapterChromeBack")}
          onClick={() => {
            if (typeof window !== "undefined" && window.history.length > 1) router.back();
            else router.push("/read");
          }}
        >
          <IconBack />
        </button>

        {route ? (
          <button
            type="button"
            className="pointer-events-auto inline-flex h-9 max-w-[11.5rem] items-center gap-1.5 rounded-full border border-[#D8C6AA] bg-[#FAF5EC]/92 px-3 text-[13px] font-semibold text-[#231A12] shadow-sm backdrop-blur-sm transition hover:bg-[#F3E9D8] active:scale-[0.97] dark:border-[#3E3328] dark:bg-[#262019]/92 dark:text-[#EDE2CF]"
            aria-label={
              locale === "en"
                ? `Switch book or chapter (${currentBookLabel} ${route.chapter})`
                : `切换圣经书卷与章节（${currentBookLabel} ${route.chapter}）`
            }
            onClick={() => setCatalogOpen(true)}
          >
            <span className="truncate">
              {currentBookLabel} {route.chapter}
            </span>
            <span className="text-[10px] font-bold text-[#C1660B] dark:text-[#FFB101]" aria-hidden>
              ▾
            </span>
          </button>
        ) : null}
      </div>

      <div
        className="read-chapter-top-actions read-chapter-top-actions--right pointer-events-none absolute z-50 flex items-center gap-1.5"
        style={{
          top: "calc(env(safe-area-inset-top, 0px) + 0.55rem)",
          right: "max(0.75rem, env(safe-area-inset-right, 0px))",
        }}
      >
        {isWideScreen ? (
          <button
            type="button"
            className={`${pillIconBtn} pointer-events-auto`}
            aria-label={t("pages.read.chapterChromeSearch")}
            onClick={() => openPanel("search")}
          >
            <ShellMaterialIcon name="search" size={18} color="currentColor" />
          </button>
        ) : (
          <Link
            href={searchHref}
            className={`${pillIconBtn} pointer-events-auto no-underline`}
            aria-label={t("pages.read.chapterChromeSearch")}
          >
            <ShellMaterialIcon name="search" size={18} color="currentColor" />
          </Link>
        )}

        {isWideScreen ? (
          <button
            type="button"
            className={`${pillIconBtn} pointer-events-auto`}
            aria-label={t("pages.read.chapterChromeFavorites")}
            onClick={() => openPanel("favorites")}
          >
            <ShellMaterialIcon name="bookmark-border" size={18} color="currentColor" />
          </button>
        ) : (
          <Link
            href="/read/favorites"
            className={`${pillIconBtn} pointer-events-auto no-underline`}
            aria-label={t("pages.read.chapterChromeFavorites")}
          >
            <ShellMaterialIcon name="bookmark-border" size={18} color="currentColor" />
          </Link>
        )}

        <div className="pointer-events-auto">
          <ReadBibleTypographySettingsControl triggerVariant="aaPill" />
        </div>
      </div>

      {route ? (
        <ReadChapterCatalogQuickPicker
          bookId={route.bookId}
          chapter={route.chapter}
          open={catalogOpen}
          onOpenChange={setCatalogOpen}
          initialMode="chapters"
        />
      ) : null}
    </>
  );
}
