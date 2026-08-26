"use client";

import Link from "next/link";
import { useCallback, useMemo, useSyncExternalStore } from "react";
import { useReadBibleTranslationSettings } from "@/components/bible/ReadBibleTypographyProvider";
import { useLocale } from "@/components/i18n/LocaleProvider";
import type { AppLocale } from "@/lib/i18n/config";
import { toZhTwText } from "@/lib/i18n/zh-tw-text";
import {
  getScriptureVerseBookmarkStoreServerSnapshot,
  getScriptureVerseBookmarkStoreSnapshot,
  subscribeScriptureVerseBookmarks,
  toggleScriptureVerseBookmark,
} from "@/lib/bible/scripture-verse-bookmarks-client";
import { listScriptureVerseBookmarks } from "@/lib/bible/scripture-verse-bookmarks";

function translationOptionLabel(
  tr: { labelZh: string; labelEn: string },
  locale: AppLocale,
): string {
  if (locale === "en") return tr.labelEn;
  if (locale === "zh-TW") return toZhTwText(tr.labelZh);
  return tr.labelZh;
}

export function ReadFavoritesClient() {
  const { t, locale } = useLocale();
  const { translationCatalog } = useReadBibleTranslationSettings();
  const store = useSyncExternalStore(
    subscribeScriptureVerseBookmarks,
    getScriptureVerseBookmarkStoreSnapshot,
    getScriptureVerseBookmarkStoreServerSnapshot,
  );
  const items = listScriptureVerseBookmarks(store);

  const translationLabel = useCallback(
    (translationId: string) => {
      const meta = translationCatalog.find((tr) => tr.id === translationId);
      if (!meta) return translationId;
      return translationOptionLabel(meta, locale);
    },
    [locale, translationCatalog],
  );

  const bookmarkHref = useMemo(
    () => (bookId: string, chapter: number, verse: number) =>
      `/read/${encodeURIComponent(bookId)}/${chapter}?verse=${verse}`,
    [],
  );

  return (
    <section className="mx-auto w-full max-w-2xl px-4 pb-24 pt-6 sm:px-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-amber-950 dark:text-stone-50">
          {t("pages.read.favoritesTitle")}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-amber-900/80 dark:text-stone-300">
          {t("pages.read.favoritesLead")}
        </p>
      </header>

      {items.length === 0 ? (
        <p className="rounded-xl border border-amber-900/15 bg-white/45 px-4 py-4 text-sm text-amber-900/75 dark:border-stone-200/15 dark:bg-stone-900/30 dark:text-stone-300">
          {t("pages.read.favoritesEmpty")}
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li
              key={`${item.translationId}:${item.bookId}:${item.chapter}:${item.verse}`}
              className="rounded-xl border border-amber-900/15 bg-white/60 p-4 dark:border-stone-200/15 dark:bg-stone-900/35"
            >
              <div className="flex items-start justify-between gap-3">
                <Link
                  href={bookmarkHref(item.bookId, item.chapter, item.verse)}
                  className="text-sm font-medium text-amber-950 underline decoration-amber-900/25 underline-offset-4 dark:text-stone-100 dark:decoration-stone-400/30"
                >
                  {item.bookName} {item.chapter}:{item.verse}
                  <span className="font-normal text-amber-900/60 dark:text-stone-400">
                    {" "}
                    · {translationLabel(item.translationId)}
                  </span>
                </Link>
                <button
                  type="button"
                  className="text-xs text-amber-900/80 hover:text-amber-950 dark:text-stone-300 dark:hover:text-stone-100"
                  aria-label={t("pages.read.favoritesRemoveA11y")}
                  onClick={() => void toggleScriptureVerseBookmark(item)}
                >
                  {t("pages.read.favoritesRemoveA11y")}
                </button>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-amber-900/85 dark:text-stone-200/90">{item.text}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
