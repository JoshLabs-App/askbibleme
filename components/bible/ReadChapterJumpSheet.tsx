"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import {
  scriptureBooks,
  testamentForBookNumber,
  type ScriptureTestament,
} from "@/lib/bible/scripture-books";

const jumpBookGroups: { testament: ScriptureTestament; books: typeof scriptureBooks }[] = [
  {
    testament: "old",
    books: scriptureBooks.filter((b) => testamentForBookNumber(b.bookNumber) === "old"),
  },
  {
    testament: "new",
    books: scriptureBooks.filter((b) => testamentForBookNumber(b.bookNumber) === "new"),
  },
];

type FocusSection = "book" | "chapter";

type Props = {
  open: boolean;
  onClose: () => void;
  bookId: string;
  chapter: number;
  focusSection?: FocusSection;
};

function readerChapterHref(bookId: string, chapter: number): string {
  return `/read/${encodeURIComponent(bookId)}/${chapter}`;
}

export function ReadChapterJumpSheet({
  open,
  onClose,
  bookId,
  chapter,
  focusSection = "chapter",
}: Props) {
  const { t } = useLocale();
  const [visible, setVisible] = useState(false);
  const [entered, setEntered] = useState(false);
  const [portalReady, setPortalReady] = useState(false);
  const [draftBookId, setDraftBookId] = useState(bookId);
  const booksRef = useRef<HTMLDivElement>(null);
  const chaptersRef = useRef<HTMLElement>(null);

  const draftBook = scriptureBooks.find((b) => b.bookId === draftBookId) ?? scriptureBooks[0];
  const draftTestament = draftBook ? testamentForBookNumber(draftBook.bookNumber) : "old";

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    setDraftBookId(bookId);
  }, [open, bookId]);

  useLayoutEffect(() => {
    if (!open) {
      setEntered(false);
      return;
    }
    setVisible(true);
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setEntered(true));
    });
    return () => cancelAnimationFrame(id);
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !entered) return;
    const target = focusSection === "book" ? booksRef.current : chaptersRef.current;
    target?.scrollIntoView({ block: "nearest" });
  }, [open, entered, focusSection, draftBookId]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setEntered(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const finishClose = useCallback(() => {
    setEntered(false);
  }, []);

  const onPanelTransitionEnd = useCallback(
    (e: React.TransitionEvent<HTMLDivElement>) => {
      if (e.propertyName !== "transform") return;
      if (!entered) {
        setVisible(false);
        onClose();
      }
    },
    [entered, onClose],
  );

  if (!portalReady || !visible || !draftBook) return null;

  return createPortal(
    <div
      className={`read-chapter-jump-root${entered ? " read-chapter-jump-root--open" : ""}`}
      role="presentation"
    >
      <button
        type="button"
        className="read-chapter-jump-backdrop"
        aria-label={t("pages.read.chapterJumpClose")}
        onClick={finishClose}
      />
      <div
        className="read-chapter-jump-panel read-bible-typography"
        role="dialog"
        aria-modal="true"
        aria-labelledby="read-chapter-jump-title"
        onTransitionEnd={onPanelTransitionEnd}
      >
        <header className="read-chapter-jump-header">
          <h2 id="read-chapter-jump-title" className="read-chapter-jump-title">
            {t("pages.read.chapterJumpTitle")}
          </h2>
          <button
            type="button"
            className="read-chapter-jump-close"
            onClick={finishClose}
            aria-label={t("pages.read.chapterJumpClose")}
          >
            ×
          </button>
        </header>

        <div
          ref={booksRef}
          className="read-chapter-jump-books"
          aria-label={t("pages.read.chapterJumpBooksAria")}
        >
          {jumpBookGroups.map((group) => (
            <div key={group.testament} className="read-chapter-jump-testament-group">
              <p
                className={`read-chapter-jump-testament-label read-chapter-jump-testament-label--${group.testament}`}
              >
                {group.testament === "old"
                  ? t("pages.read.chapterJumpOldTestament")
                  : t("pages.read.chapterJumpNewTestament")}
              </p>
              {group.books.map((book) => {
                const selected = book.bookId === draftBookId;
                const testament = testamentForBookNumber(book.bookNumber);
                return (
                  <button
                    key={book.bookId}
                    type="button"
                    className={`read-chapter-jump-book read-chapter-jump-book--${testament}${selected ? " read-chapter-jump-book--selected" : ""}`}
                    aria-pressed={selected}
                    onClick={() => setDraftBookId(book.bookId)}
                  >
                    <span className="read-chapter-jump-book-num" aria-hidden>
                      {book.bookNumber}
                    </span>
                    <span className="read-chapter-jump-book-name">{book.bookName}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <section
          ref={chaptersRef}
          className={`read-chapter-jump-chapters-wrap read-chapter-jump-chapters-wrap--${draftTestament}`}
          aria-label={t("pages.read.chapterJumpChaptersAria", { bookName: draftBook.bookName })}
        >
          <p className="read-chapter-jump-chapters-label">{draftBook.bookName}</p>
          <nav className="read-chapter-jump-chapters">
            {Array.from({ length: draftBook.chapters }, (_, i) => i + 1).map((ch) => {
              const isCurrent = draftBookId === bookId && ch === chapter;
              return (
                <Link
                  key={ch}
                  href={readerChapterHref(draftBookId, ch)}
                  className={`read-chapter-jump-chapter${isCurrent ? " read-chapter-jump-chapter--current" : ""}`}
                  aria-label={t("pages.read.chapterJumpChapterN", { chapter: String(ch) })}
                  aria-current={isCurrent ? "page" : undefined}
                  onClick={finishClose}
                >
                  {ch}
                </Link>
              );
            })}
          </nav>
        </section>
      </div>
    </div>,
    document.body,
  );
}
