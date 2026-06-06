"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ReadBibleTypographySettingsControl } from "@/components/bible/ReadBibleTypographySettingsControl";
import { useReadWideQuickPanels } from "@/components/bible/ReadWideQuickPanels";
import { useLocale } from "@/components/i18n/LocaleProvider";

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

function IconSearch() {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="6.5" stroke="#fff" strokeWidth="1.75" />
      <path d="M16 16l4.5 4.5" stroke="#fff" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function IconBookmark() {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7 4.5h10a1 1 0 0 1 1 1v14.5l-6-3.5-6 3.5V5.5a1 1 0 0 1 1-1Z"
        stroke="#fff"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconHighlight() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7 15.5 14.5 8l2.5 2.5L9.5 18H7v-2.5Zm7.5-7.5 1.75-1.75a1 1 0 0 1 1.42 0l1.28 1.28a1 1 0 0 1 0 1.42L17.2 10.7"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const btnClass =
  "read-chapter-top-action inline-flex h-11 w-11 items-center justify-center text-white transition active:scale-[0.97] [filter:drop-shadow(0_1px_1px_rgba(0,0,0,0.28))_drop-shadow(0_0_2px_rgba(0,0,0,0.1))]";
const pillBtnClass =
  "read-chapter-top-action inline-flex h-11 w-11 items-center justify-center rounded-full text-white transition active:scale-[0.97] [filter:drop-shadow(0_1px_1px_rgba(0,0,0,0.28))_drop-shadow(0_0_2px_rgba(0,0,0,0.1))]";

/** 读经章顶栏浮动操作 — 对齐 iOS ReadChapterScreen */
export function ReadChapterTopActions() {
  const { t } = useLocale();
  const router = useRouter();
  const { isWideScreen, openPanel } = useReadWideQuickPanels();

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
        className="read-chapter-top-actions read-chapter-top-actions--right pointer-events-none absolute top-[calc(env(safe-area-inset-top,0px)+2.75rem)] z-50 flex flex-col items-end gap-px"
        style={{
          top: "calc(env(safe-area-inset-top, 0px) + 3.25rem)",
          right: "max(1rem, calc(env(safe-area-inset-right, 0px) + 0.4rem))",
        }}
      >
        <div className="pointer-events-auto self-end">
          <ReadBibleTypographySettingsControl />
        </div>
        {isWideScreen ? (
          <button
            type="button"
            className={`${btnClass} pointer-events-auto`}
            aria-label={t("pages.read.chapterChromeSearch")}
            onClick={() => openPanel("search")}
          >
            <IconSearch />
          </button>
        ) : (
          <Link
            href="/read/search"
            className={`${btnClass} pointer-events-auto`}
            aria-label={t("pages.read.chapterChromeSearch")}
          >
            <IconSearch />
          </Link>
        )}
        {isWideScreen ? (
          <button
            type="button"
            className={`${btnClass} pointer-events-auto`}
            aria-label={t("pages.read.chapterChromeFavorites")}
            onClick={() => openPanel("favorites")}
          >
            <IconBookmark />
          </button>
        ) : (
          <Link
            href="/read/favorites"
            className={`${btnClass} pointer-events-auto`}
            aria-label={t("pages.read.chapterChromeFavorites")}
          >
            <IconBookmark />
          </Link>
        )}
        {isWideScreen ? (
          <button
            type="button"
            className={`${pillBtnClass} pointer-events-auto mt-1 bg-[rgba(255,248,237,0.18)] hover:bg-[rgba(255,248,237,0.26)]`}
            aria-label={t("pages.read.verseHighlightAction")}
            onClick={() => {
              window.dispatchEvent(new CustomEvent("askbible:read-open-highlight"));
            }}
            title={t("pages.read.verseHighlightAction")}
          >
            <IconHighlight />
          </button>
        ) : null}
      </div>
    </>
  );
}
