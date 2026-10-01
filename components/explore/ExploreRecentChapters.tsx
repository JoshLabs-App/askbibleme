"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { achCopy } from "@/lib/achievements/achievement-copy";
import { getScriptureBookDisplayName } from "@/lib/bible/scripture-book-display-name";
import {
  getReadRecentChapters,
  subscribeReadRecentChapters,
} from "@/lib/read/read-recent-chapters-web";

const EMPTY_RECENT: ReturnType<typeof getReadRecentChapters> = [];
const getServerRecent = () => EMPTY_RECENT;

/** 探索首页：最近浏览的最多 3 章，可点进继续读；没有记录时留一行说明（照安卓）。 */
export function ExploreRecentChapters() {
  const { locale } = useLocale();
  const recent = useSyncExternalStore(subscribeReadRecentChapters, getReadRecentChapters, getServerRecent);
  const heading = achCopy("native.recentReading", locale);

  return (
    <section className="explore-recent-list" aria-label={heading}>
      <h2 className="explore-recent-list-heading">{heading}</h2>
      {recent.map((item) => {
        const bookName = getScriptureBookDisplayName(item.bookId, locale) || item.bookName;
        const label = achCopy("native.chapterUnit", locale, { bookName, chapter: item.chapter });
        const href = `/read/${encodeURIComponent(item.bookId)}/${item.chapter}?from=explore`;
        return (
          <Link key={`${item.bookId}:${item.chapter}`} href={href} className="explore-recent-list-row">
            <span className="explore-recent-list-row-text">{label}</span>
            <span className="explore-recent-list-chevron" aria-hidden>
              ›
            </span>
          </Link>
        );
      })}
      {recent.length === 0 ? (
        <p className="explore-recent-list-empty">{achCopy("native.noReadingRecord", locale)}</p>
      ) : null}
    </section>
  );
}
