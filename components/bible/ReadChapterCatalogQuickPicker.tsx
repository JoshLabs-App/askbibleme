"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import { useEffect, useMemo, useState } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { scriptureBooks, testamentForBookNumber } from "@/lib/bible/scripture-books";

type Props = {
  chapter: number;
};

function IconCatalog(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 18" fill="none" className={props.className} aria-hidden>
      <path d="M1 1.25h22M1 9h22M1 16.75h22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function chapterHref(bookId: string, chapter: number) {
  return `/read/${encodeURIComponent(bookId)}/${chapter}`;
}

export function ReadChapterCatalogQuickPicker({ chapter }: Props) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const [portalReady, setPortalReady] = useState(false);

  const oldBooks = useMemo(
    () => scriptureBooks.filter((book) => testamentForBookNumber(book.bookNumber) === "old"),
    [],
  );
  const newBooks = useMemo(
    () => scriptureBooks.filter((book) => testamentForBookNumber(book.bookNumber) === "new"),
    [],
  );

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="read-chapter-catalog-trigger"
        aria-label={t("pages.read.chapterNavCatalog")}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <IconCatalog className="h-3.5 w-4" />
      </button>

      {portalReady && open
        ? createPortal(
            <div className="read-chapter-catalog-popover-root" role="presentation">
              <button
                type="button"
                className="read-chapter-catalog-popover-backdrop"
                aria-label={t("pages.read.chapterJumpClose")}
                onClick={() => setOpen(false)}
              />

              <section
                className="read-chapter-catalog-popover read-bible-typography"
                role="dialog"
                aria-modal="true"
                aria-label={t("pages.read.chapterNavCatalog")}
              >
                <header className="read-chapter-catalog-popover-header">
                  <h2 className="read-chapter-catalog-popover-title">{t("pages.read.chapterNavCatalog")}</h2>
                  <button
                    type="button"
                    className="read-chapter-catalog-popover-close"
                    aria-label={t("pages.read.chapterJumpClose")}
                    onClick={() => setOpen(false)}
                  >
                    ×
                  </button>
                </header>

                <div className="read-chapter-catalog-popover-scroll">
                  <section className="read-chapter-catalog-section" aria-label={t("pages.read.chapterJumpOldTestament")}>
                    <p className="read-chapter-catalog-section-title read-chapter-catalog-section-title--old">
                      {t("pages.read.chapterJumpOldTestament")}
                    </p>
                    <div className="read-chapter-catalog-grid">
                      {oldBooks.map((book) => (
                        <Link
                          key={book.bookId}
                          href={chapterHref(book.bookId, Math.min(chapter, book.chapters))}
                          className="read-chapter-catalog-link read-chapter-catalog-link--old"
                          onClick={() => setOpen(false)}
                        >
                          {book.bookName}
                        </Link>
                      ))}
                    </div>
                  </section>

                  <section className="read-chapter-catalog-section" aria-label={t("pages.read.chapterJumpNewTestament")}>
                    <p className="read-chapter-catalog-section-title read-chapter-catalog-section-title--new">
                      {t("pages.read.chapterJumpNewTestament")}
                    </p>
                    <div className="read-chapter-catalog-grid">
                      {newBooks.map((book) => (
                        <Link
                          key={book.bookId}
                          href={chapterHref(book.bookId, Math.min(chapter, book.chapters))}
                          className="read-chapter-catalog-link read-chapter-catalog-link--new"
                          onClick={() => setOpen(false)}
                        >
                          {book.bookName}
                        </Link>
                      ))}
                    </div>
                  </section>
                </div>
              </section>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
