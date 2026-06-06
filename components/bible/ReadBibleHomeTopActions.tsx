"use client";

import { useLocale } from "@/components/i18n/LocaleProvider";
import Link from "next/link";
import { READ_PARCHMENT_INK } from "@/lib/read/read-parchment-accents";
import { useReadWideQuickPanels } from "@/components/bible/ReadWideQuickPanels";

function IconSearch() {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.75" />
      <path d="M16 16l4.5 4.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function IconBookmark() {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7 4.5h10a1 1 0 0 1 1 1v14.5l-6-3.5-6 3.5V5.5a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const btnClass =
  "read-bible-home-top-action inline-flex h-11 w-11 items-center justify-center opacity-50 transition hover:opacity-[0.68]";

/** Floating search + favorites on `/read` home (iOS ReadCatalogScreen). */
export function ReadBibleHomeTopActions() {
  const { t } = useLocale();
  const { isWideScreen, openPanel } = useReadWideQuickPanels();

  return (
    <div
      className="read-bible-home-top-actions pointer-events-none absolute right-[max(0.5rem,env(safe-area-inset-right))] top-[calc(env(safe-area-inset-top,0px)+3.125rem)] z-50 flex flex-col gap-1"
    >
      {isWideScreen ? (
        <button
          type="button"
          className={`${btnClass} pointer-events-auto`}
          style={{ color: READ_PARCHMENT_INK }}
          aria-label={t("pages.read.chapterChromeSearch")}
          onClick={() => openPanel("search")}
        >
          <IconSearch />
        </button>
      ) : (
        <Link
          href="/read/search"
          className={`${btnClass} pointer-events-auto`}
          style={{ color: READ_PARCHMENT_INK }}
          aria-label={t("pages.read.chapterChromeSearch")}
        >
          <IconSearch />
        </Link>
      )}
      {isWideScreen ? (
        <button
          type="button"
          className={`${btnClass} pointer-events-auto`}
          style={{ color: READ_PARCHMENT_INK }}
          aria-label={t("pages.read.chapterChromeFavorites")}
          onClick={() => openPanel("favorites")}
        >
          <IconBookmark />
        </button>
      ) : (
        <Link
          href="/read/favorites"
          className={`${btnClass} pointer-events-auto`}
          style={{ color: READ_PARCHMENT_INK }}
          aria-label={t("pages.read.chapterChromeFavorites")}
        >
          <IconBookmark />
        </Link>
      )}
    </div>
  );
}
