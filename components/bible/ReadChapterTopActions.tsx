"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo } from "react";
import { ReadBibleTypographySettingsControl } from "@/components/bible/ReadBibleTypographySettingsControl";
import { useReadBibleTypography } from "@/components/bible/ReadBibleTypographyProvider";
import { useReadWideQuickPanels } from "@/components/bible/ReadWideQuickPanels";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { ShellMaterialIcon } from "@/components/shell/ShellMaterialIcon";
import { useReadChapterPageAudioAvailable } from "@/hooks/useReadChapterPageAudioAvailable";
import { parseReadChapterPathname } from "@/lib/read/resolve-chapter-page-scripture-play-target";

function IconBack() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M14.5 5 9 12l5.5 7"
        stroke="#fff"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const btnClass =
  "read-chapter-top-action inline-flex h-[52px] w-[52px] items-center justify-center rounded-full text-white transition active:scale-[0.97] [filter:drop-shadow(0_1px_6px_rgba(0,0,0,0.55))_drop-shadow(0_0_1px_rgba(0,0,0,0.8))]";

const sizeBtnClass = `${btnClass} pointer-events-auto text-[22px] font-semibold leading-none tabular-nums disabled:opacity-40`;

/** 读经章顶栏浮动操作 — 对齐 iOS ReadChapterScreen */
export function ReadChapterTopActions() {
  const { t } = useLocale();
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const { isWideScreen, openPanel } = useReadWideQuickPanels();
  const { sizeAtMin, sizeAtMax, bumpSize } = useReadBibleTypography();
  const readChapterAudioAvailable = useReadChapterPageAudioAvailable();
  const onChapterPage = parseReadChapterPathname(pathname) !== null;
  const hideTopSearch = onChapterPage && readChapterAudioAvailable;
  const searchHref = useMemo(() => {
    const route = parseReadChapterPathname(pathname);
    if (!route) return "/read/search";
    return `/read/search?bookId=${encodeURIComponent(route.bookId)}&chapter=${route.chapter}`;
  }, [pathname]);

  return (
    <>
      <div
        className="read-chapter-top-actions read-chapter-top-actions--left pointer-events-none absolute left-[max(0.5rem,env(safe-area-inset-left))] top-[calc(env(safe-area-inset-top,0px)+0.375rem)] z-50"
      >
        <button
          type="button"
          className={`${btnClass} pointer-events-auto`}
          aria-label={t("pages.read.chapterChromeBack")}
          onClick={() => {
            if (typeof window !== "undefined" && window.history.length > 1) router.back();
            else router.push("/read");
          }}
        >
          <IconBack />
        </button>
      </div>
      <div
        className="read-chapter-top-actions read-chapter-top-actions--right pointer-events-none absolute z-50 flex flex-col items-center gap-0.5"
        style={{
          top: "calc(env(safe-area-inset-top, 0px) + 0.375rem)",
          right: "max(0.625rem, env(safe-area-inset-right, 0px))",
        }}
      >
        <div className="pointer-events-auto self-end">
          <ReadBibleTypographySettingsControl buttonSize={52} iconSize={28} />
        </div>
        {!hideTopSearch ? (
          isWideScreen ? (
            <button
              type="button"
              className={`${btnClass} pointer-events-auto`}
              aria-label={t("pages.read.chapterChromeSearch")}
              onClick={() => openPanel("search")}
            >
              <ShellMaterialIcon name="search" size={28} color="#fff" />
            </button>
          ) : (
            <Link
              href={searchHref}
              className={`${btnClass} pointer-events-auto`}
              aria-label={t("pages.read.chapterChromeSearch")}
            >
              <ShellMaterialIcon name="search" size={28} color="#fff" />
            </Link>
          )
        ) : null}
        {isWideScreen ? (
          <button
            type="button"
            className={`${btnClass} pointer-events-auto`}
            aria-label={t("pages.read.chapterChromeFavorites")}
            onClick={() => openPanel("favorites")}
          >
            <ShellMaterialIcon name="bookmark-border" size={28} color="#fff" />
          </button>
        ) : (
          <Link
            href="/read/favorites"
            className={`${btnClass} pointer-events-auto`}
            aria-label={t("pages.read.chapterChromeFavorites")}
          >
            <ShellMaterialIcon name="bookmark-border" size={28} color="#fff" />
          </Link>
        )}
        <button
          type="button"
          className={sizeBtnClass}
          aria-label={t("pages.read.typography.sizeSmallerAria")}
          disabled={sizeAtMin}
          onClick={() => bumpSize(-1)}
        >
          −
        </button>
        <button
          type="button"
          className={sizeBtnClass}
          aria-label={t("pages.read.typography.sizeLargerAria")}
          disabled={sizeAtMax}
          onClick={() => bumpSize(1)}
        >
          +
        </button>
      </div>
    </>
  );
}
