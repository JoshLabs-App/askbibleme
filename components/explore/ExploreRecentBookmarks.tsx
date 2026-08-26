"use client";

import Link from "next/link";
import { useMemo, useSyncExternalStore } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { getScriptureBookDisplayName } from "@/lib/bible/scripture-book-display-name";
import { listScriptureVerseBookmarks } from "@/lib/bible/scripture-verse-bookmarks";
import {
  getScriptureVerseBookmarkStoreSnapshot,
  subscribeScriptureVerseBookmarks,
} from "@/lib/bible/scripture-verse-bookmarks-client";
import { toZhTwText } from "@/lib/i18n/zh-tw-text";

const MAX_RECENT = 3;

/** 探索首页：最近收藏的最多 3 处经文，可点进继续读。 */
export function ExploreRecentBookmarks() {
  const { locale } = useLocale();
  const store = useSyncExternalStore(
    subscribeScriptureVerseBookmarks,
    getScriptureVerseBookmarkStoreSnapshot,
    () => ({}),
  );
  const recent = useMemo(() => listScriptureVerseBookmarks(store).slice(0, MAX_RECENT), [store]);

  if (recent.length === 0) return null;

  const heading =
    locale === "en" ? "Recent favorites" : locale === "zh-TW" ? toZhTwText("最近收藏") : "最近收藏";

  return (
    <section className="explore-recent-list" aria-label={heading}>
      <h2 className="explore-recent-list-heading">{heading}</h2>
      {recent.map((item) => {
        const bookName = getScriptureBookDisplayName(item.bookId, locale) || item.bookName;
        const refLabel = `${bookName} ${item.chapter}:${item.verse}`;
        const href = `/read/${encodeURIComponent(item.bookId)}/${item.chapter}?verse=${item.verse}&from=explore`;
        return (
          <Link key={`${item.translationId}:${item.bookId}:${item.chapter}:${item.verse}`} href={href} className="explore-recent-list-row">
            <span className="explore-recent-list-row-body">
              <span className="explore-recent-list-row-text">{refLabel}</span>
              {item.text.trim() ? <span className="explore-recent-list-verse-preview">{item.text.trim()}</span> : null}
            </span>
            <span className="explore-recent-list-chevron" aria-hidden>
              ›
            </span>
          </Link>
        );
      })}
    </section>
  );
}
