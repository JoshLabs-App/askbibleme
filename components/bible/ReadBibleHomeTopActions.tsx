"use client";

import { useEffect, useState } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useReadWideQuickPanels } from "@/components/bible/ReadWideQuickPanels";
import { ReadBibleTypographySettingsControl } from "@/components/bible/ReadBibleTypographySettingsControl";
import { useReadBibleTypography } from "@/components/bible/ReadBibleTypographyProvider";
import { ShellMaterialIcon } from "@/components/shell/ShellMaterialIcon";
import { readLastReadPosition, type ReadLastPosition } from "@/lib/read/read-last-position";
import { toZhTwText } from "@/lib/i18n/zh-tw-text";

const btnClass =
  "read-bible-home-top-action inline-flex h-[52px] w-[52px] items-center justify-center text-white transition active:scale-[0.97] [filter:drop-shadow(0_1px_6px_rgba(0,0,0,0.55))_drop-shadow(0_0_1px_rgba(0,0,0,0.8))]";

function lastReadHref(pos: ReadLastPosition): string {
  return `/read/${encodeURIComponent(pos.bookId)}/${pos.chapter}`;
}

function lastReadA11yLabel(pos: ReadLastPosition | null, locale: string): string {
  if (!pos) {
    return locale === "en" ? "Continue last read" : locale === "zh-TW" ? toZhTwText("继续上次阅读") : "继续上次阅读";
  }
  if (locale === "en") return `Continue ${pos.bookName} ${pos.chapter}`;
  if (locale === "zh-TW") return toZhTwText(`继续阅读 ${pos.bookName} 第 ${pos.chapter} 章`);
  return `继续阅读 ${pos.bookName} 第 ${pos.chapter} 章`;
}

const sizeBtnClass =
  `${btnClass} pointer-events-auto text-[22px] font-semibold leading-none tabular-nums disabled:opacity-40`;

/** Floating settings / search / favorites / 字号 / 上次阅读 on `/read` home (iOS ReadCatalogScreen). */
export function ReadBibleHomeTopActions() {
  const router = useRouter();
  const { t, locale } = useLocale();
  const { isWideScreen, openPanel } = useReadWideQuickPanels();
  const { sizeAtMin, sizeAtMax, bumpSize } = useReadBibleTypography();
  const [lastRead, setLastRead] = useState<ReadLastPosition | null>(null);

  useEffect(() => {
    setLastRead(readLastReadPosition());
  }, []);

  const lastReadDisabled = !lastRead;
  const lastReadLabel = lastReadA11yLabel(lastRead, locale);

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
      <button
        type="button"
        className={`${btnClass} pointer-events-auto ${lastReadDisabled ? "opacity-40" : ""}`}
        aria-label={lastReadLabel}
        aria-disabled={lastReadDisabled}
        disabled={lastReadDisabled}
        onClick={() => {
          if (!lastRead) return;
          router.push(lastReadHref(lastRead));
        }}
      >
        <ShellMaterialIcon name="history" size={28} color="#fff" />
      </button>
    </div>
  );
}
