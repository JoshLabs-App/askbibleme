"use client";

import Link from "next/link";
import { useState } from "react";
import { ReadChapterJumpSheet } from "@/components/bible/ReadChapterJumpSheet";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { useReadChapterHref } from "@/hooks/useReadChapterHref";
import type { ReadChapterNeighbor } from "@/lib/bible/read-chapter-neighbors";

type Props = {
  bookId: string;
  bookName: string;
  chapter: number;
  prev: ReadChapterNeighbor | null;
  next: ReadChapterNeighbor | null;
};

function ChevronLeft() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden className="shrink-0 opacity-70">
      <path d="M14.5 6 9 12l5.5 6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden className="shrink-0 opacity-70">
      <path d="M9.5 6 15 12l-5.5 6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ReadChapterEndNav({ bookId, bookName, chapter, prev, next }: Props) {
  const { t, locale } = useLocale();
  const chapterHref = useReadChapterHref();
  const [jumpOpen, setJumpOpen] = useState(false);
  const isEnglish = locale === "en";

  const neighborLabel = (target: ReadChapterNeighbor) =>
    isEnglish ? `Ch. ${target.chapter}` : `第${target.chapter}章`;

  if (!prev && !next) return null;

  return (
    <>
      <nav className="read-chapter-end-nav" aria-label={t("pages.read.chapterEndNavAria")}>
        <div className="read-chapter-end-nav-side read-chapter-end-nav-side--prev">
          {prev ? (
            <Link href={chapterHref(prev.bookId, prev.chapter)} className="read-chapter-end-nav-link">
              <ChevronLeft />
              <span>{neighborLabel(prev)}</span>
            </Link>
          ) : null}
        </div>
        <button
          type="button"
          className="read-chapter-end-nav-center"
          onClick={() => setJumpOpen(true)}
          aria-label={t("pages.read.chapterEndNavPickBook", { bookName })}
        >
          {bookName}
        </button>
        <div className="read-chapter-end-nav-side read-chapter-end-nav-side--next">
          {next ? (
            <Link href={chapterHref(next.bookId, next.chapter)} className="read-chapter-end-nav-link read-chapter-end-nav-link--next">
              <span>{neighborLabel(next)}</span>
              <ChevronRight />
            </Link>
          ) : null}
        </div>
      </nav>

      <ReadChapterJumpSheet
        open={jumpOpen}
        onClose={() => setJumpOpen(false)}
        bookId={bookId}
        chapter={chapter}
        focusSection="book"
      />
    </>
  );
}
