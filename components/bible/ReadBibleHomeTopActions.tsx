"use client";

import { useLocale } from "@/components/i18n/LocaleProvider";
import Link from "next/link";
import { useReadWideQuickPanels } from "@/components/bible/ReadWideQuickPanels";
import { ReadBibleTypographySettingsControl } from "@/components/bible/ReadBibleTypographySettingsControl";
import { ShellMaterialIcon } from "@/components/shell/ShellMaterialIcon";

const btnClass =
  "read-bible-home-top-action inline-flex h-[52px] w-[52px] items-center justify-center text-white transition active:scale-[0.97] [filter:drop-shadow(0_1px_6px_rgba(0,0,0,0.55))_drop-shadow(0_0_1px_rgba(0,0,0,0.8))]";

/** Floating search + favorites on `/read` home (iOS ReadCatalogScreen). */
export function ReadBibleHomeTopActions() {
  const { t } = useLocale();
  const { isWideScreen, openPanel } = useReadWideQuickPanels();

  return (
    <div
      className="read-bible-home-top-actions pointer-events-none absolute right-[max(1rem,env(safe-area-inset-right))] top-[calc(env(safe-area-inset-top,0px)+0.5rem)] z-50 flex flex-col items-center gap-1"
    >
      <div className="pointer-events-auto">
        <ReadBibleTypographySettingsControl buttonSize={52} iconSize={28} />
      </div>
      {isWideScreen ? (
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
          href="/read/search"
          className={`${btnClass} pointer-events-auto`}
          aria-label={t("pages.read.chapterChromeSearch")}
        >
          <ShellMaterialIcon name="search" size={28} color="#fff" />
        </Link>
      )}
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
    </div>
  );
}
