"use client";

import Link from "next/link";
import { useLocale } from "@/components/i18n/LocaleProvider";
import type { ReadChapterNeighbor } from "@/lib/bible/read-chapter-neighbors";

type Props = {
  bookName: string;
  chapter: number;
  prev: ReadChapterNeighbor | null;
  next: ReadChapterNeighbor | null;
};

const sideLinkClass =
  "inline-block max-w-[min(7.5rem,32vw)] shrink-0 py-1.5 text-center text-[13px] font-medium text-amber-900/78 underline decoration-amber-800/25 underline-offset-[0.22em] transition hover:text-amber-950 hover:decoration-amber-800/45 dark:text-stone-400 dark:decoration-stone-500/35 dark:hover:text-stone-200 dark:hover:decoration-stone-400/55";

export function ReadChapterEndNav({ bookName, chapter, prev, next }: Props) {
  const { t } = useLocale();
  if (!prev && !next) return null;

  const centerLabel = t("pages.read.chapterEndNavTarget", {
    bookName,
    chapter: String(chapter),
  });

  return (
    <nav
      className="read-chapter-end-nav mt-10 grid grid-cols-[1fr_auto_1fr] items-center gap-x-2 pb-1"
      aria-label={t("pages.read.chapterEndNavAria")}
    >
      <div className="min-w-0 justify-self-start text-start">
        {prev ? (
          <Link href={`/read/${prev.bookId}/${prev.chapter}`} className={sideLinkClass}>
            {t("pages.read.chapterEndNavPrev")}
          </Link>
        ) : null}
      </div>
      <div
        className="max-w-[min(14rem,52vw)] text-balance text-center text-[0.98rem] font-semibold leading-snug text-amber-950/92 dark:text-stone-100/95"
        aria-current="page"
      >
        {centerLabel}
      </div>
      <div className="min-w-0 justify-self-end text-end">
        {next ? (
          <Link href={`/read/${next.bookId}/${next.chapter}`} className={sideLinkClass}>
            {t("pages.read.chapterEndNavNext")}
          </Link>
        ) : null}
      </div>
    </nav>
  );
}
