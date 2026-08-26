"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { getScriptureBookDisplayName } from "@/lib/bible/scripture-book-display-name";
import {
  getReadRecentChapters,
  subscribeReadRecentChapters,
} from "@/lib/read/read-recent-chapters-web";
import { toZhTwText } from "@/lib/i18n/zh-tw-text";

/** 探索首页：最近浏览的最多 3 章，可点进继续读。 */
export function ExploreRecentChapters() {
  const { locale } = useLocale();
  const recent = useSyncExternalStore(subscribeReadRecentChapters, getReadRecentChapters, () => []);

  if (recent.length === 0) return null;

  const heading =
    locale === "en" ? "Continue reading" : locale === "zh-TW" ? toZhTwText("最近阅读") : "最近阅读";

  return (
    <section className="explore-recent-list" aria-label={heading}>
      <h2 className="explore-recent-list-heading">{heading}</h2>
      {recent.map((item) => {
        const bookName = getScriptureBookDisplayName(item.bookId, locale) || item.bookName;
        const label = locale === "en" ? `${bookName} ${item.chapter}` : `${bookName} ${item.chapter}章`;
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
    </section>
  );
}
