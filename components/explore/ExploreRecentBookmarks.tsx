"use client";

import Link from "next/link";
import { useMemo, useSyncExternalStore } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { achCopy } from "@/lib/achievements/achievement-copy";
import { getScriptureBookDisplayName } from "@/lib/bible/scripture-book-display-name";
import { listScriptureVerseBookmarks } from "@/lib/bible/scripture-verse-bookmarks";
import {
  getScriptureVerseBookmarkStoreServerSnapshot,
  getScriptureVerseBookmarkStoreSnapshot,
  subscribeScriptureVerseBookmarks,
} from "@/lib/bible/scripture-verse-bookmarks-client";

const MAX_RECENT = 3;

/** 探索首页：收藏的前 3 处经文 + 「更多」进收藏页；没有收藏时留一行说明（照安卓）。 */
export function ExploreRecentBookmarks() {
  const { locale, t } = useLocale();
  const store = useSyncExternalStore(
    subscribeScriptureVerseBookmarks,
    getScriptureVerseBookmarkStoreSnapshot,
    getScriptureVerseBookmarkStoreServerSnapshot,
  );
  const all = useMemo(() => listScriptureVerseBookmarks(store), [store]);
  const recent = all.slice(0, MAX_RECENT);
  const heading = t("pages.read.favoritesTitle");

  return (
    <section className="explore-recent-list explore-recent-list--favorites" aria-label={heading}>
      <div className="explore-recent-list-head">
        <h2 className="explore-recent-list-heading">{heading}</h2>
        {all.length > MAX_RECENT ? (
          <Link href="/read/favorites" className="explore-recent-list-more">
            {achCopy("native.favoritesMore", locale)}
          </Link>
        ) : null}
      </div>
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
      {recent.length === 0 ? (
        <p className="explore-recent-list-empty">{achCopy("native.noFavorites", locale)}</p>
      ) : null}
    </section>
  );
}
