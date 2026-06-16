"use client";

import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { BibleCatalogReadOutline } from "@/components/bible/BibleCatalogReadOutline";
import { BibleChapterPickerPanel } from "@/components/bible/BibleChapterPickerPanel";
import { JumpCatalogWideGrid } from "@/components/bible/JumpCatalogWideGrid";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { getScriptureCanonCatalogSectionsClient } from "@/lib/bible/scripture-canon-catalog-client";
import type { ScriptureCanonCatalogBook } from "@/lib/bible/read-scripture-canon-catalog";

type Props = {
  bookId: string;
  chapter: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/** 宽屏三栏：旧约 | 新约 | 章次（与 iPad 横屏目录一致） */
const JUMP_CATALOG_WIDE_MEDIA = "(min-width: 768px)";

function chapterHref(bookId: string, chapter: number) {
  return `/read/${encodeURIComponent(bookId)}/${chapter}`;
}

function bookNameFromSections(
  sections: ReturnType<typeof getScriptureCanonCatalogSectionsClient>,
  bookId: string,
): string | null {
  for (const section of sections) {
    const book = section.books.find((b) => b.bookId === bookId);
    if (book) return book.bookName;
  }
  return null;
}

function useJumpCatalogWideLayout(): boolean {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(JUMP_CATALOG_WIDE_MEDIA);
    const sync = () => setWide(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return wide;
}

/** 章页底栏「读经」：正典十段双列目录 + 选章（对齐 iOS ReadChapterScreen jump sheet） */
export function ReadChapterCatalogQuickPicker({ bookId, chapter, open, onOpenChange }: Props) {
  const router = useRouter();
  const { t, locale } = useLocale();
  const sections = useMemo(() => getScriptureCanonCatalogSectionsClient(locale), [locale]);
  const isWideLayout = useJumpCatalogWideLayout();
  const [portalReady, setPortalReady] = useState(false);
  const [visible, setVisible] = useState(false);
  const [entered, setEntered] = useState(false);
  const [pickerBookId, setPickerBookId] = useState<string | null>(null);
  const [pickerBookName, setPickerBookName] = useState("");

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    if (!open) {
      setPickerBookId(null);
      setPickerBookName("");
      return;
    }
    if (isWideLayout) {
      const name = bookNameFromSections(sections, bookId);
      setPickerBookId(bookId);
      setPickerBookName(name ?? "");
      return;
    }
    setPickerBookId(null);
    setPickerBookName("");
  }, [open, isWideLayout, bookId, sections]);

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

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (!isWideLayout && pickerBookId) {
        setPickerBookId(null);
        setPickerBookName("");
        return;
      }
      setEntered(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, pickerBookId, isWideLayout]);

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
        onOpenChange(false);
      }
    },
    [entered, onOpenChange],
  );

  const navigateChapter = useCallback(
    (nextBookId: string, nextChapter: number) => {
      finishClose();
      router.push(chapterHref(nextBookId, nextChapter));
    },
    [finishClose, router],
  );

  const onJumpBookPress = useCallback((book: ScriptureCanonCatalogBook) => {
    setPickerBookId(book.bookId);
    setPickerBookName(book.bookName);
  }, []);

  const selectedBookId = pickerBookId ?? bookId;
  const selectedBookName =
    pickerBookName || bookNameFromSections(sections, selectedBookId) || t("pages.read.chapterJumpTitle");

  const headerTitle =
    !isWideLayout && pickerBookId != null ? selectedBookName : t("pages.read.chapterJumpTitle");

  const onHeaderBack = useCallback(() => {
    if (!isWideLayout && pickerBookId) {
      setPickerBookId(null);
      setPickerBookName("");
      return;
    }
    finishClose();
    router.push("/read");
  }, [finishClose, isWideLayout, pickerBookId, router]);

  const catalogOutlineProps = {
    sections,
    activeBookId: bookId,
    jumpCatalog: true as const,
    jumpHighlightedBookId: selectedBookId,
    onJumpBookPress,
    onChapterNavigate: navigateChapter,
  };

  const chapterColumn = selectedBookId ? (
    <BibleChapterPickerPanel
      bookId={selectedBookId}
      bookName={selectedBookName}
      activeChapter={selectedBookId === bookId ? chapter : undefined}
      onPickChapter={(ch) => navigateChapter(selectedBookId, ch)}
    />
  ) : null;

  if (!portalReady || !visible) return null;

  return createPortal(
    <div
      className={[
        "read-chapter-jump-root read-chapter-jump-root--catalog",
        entered ? "read-chapter-jump-root--open" : "",
        isWideLayout ? "read-chapter-jump-root--catalog-wide" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      role="presentation"
    >
      <button
        type="button"
        className="read-chapter-jump-backdrop"
        aria-label={t("pages.read.chapterJumpClose")}
        onClick={finishClose}
      />
      <div
        className={[
          "read-chapter-jump-panel read-chapter-jump-panel--catalog read-bible-typography",
          isWideLayout ? "read-chapter-jump-panel--catalog-wide" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        role="dialog"
        aria-modal="true"
        aria-labelledby="read-chapter-catalog-title"
        onTransitionEnd={onPanelTransitionEnd}
      >
        <header className="read-chapter-jump-header read-chapter-jump-header--catalog">
          <button
            type="button"
            className="read-chapter-jump-back"
            aria-label={
              !isWideLayout && pickerBookId
                ? t("pages.read.backToJumpBooks")
                : t("pages.read.backToBibleHome")
            }
            onClick={onHeaderBack}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden>
              <path
                d="M14.5 6 9 12l5.5 6"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <h2 id="read-chapter-catalog-title" className="read-chapter-jump-title">
            {headerTitle}
          </h2>
          <span className="read-chapter-jump-header-spacer" aria-hidden />
        </header>

        <div
          className={[
            "read-chapter-jump-catalog-scroll",
            isWideLayout ? "read-chapter-jump-catalog-scroll--wide" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {isWideLayout ? (
            <JumpCatalogWideGrid
              sections={sections}
              highlightedBookId={selectedBookId}
              onBookPress={onJumpBookPress}
              chapterColumn={
                <>
                  <p className="read-jump-catalog-chapters-heading">{selectedBookName}</p>
                  {chapterColumn}
                </>
              }
            />
          ) : pickerBookId ? (
            chapterColumn
          ) : (
            <BibleCatalogReadOutline {...catalogOutlineProps} />
          )}
        </div>

        <button type="button" className="read-chapter-jump-footer-close" onClick={finishClose}>
          {t("pages.read.chapterJumpClose")}
        </button>
      </div>
    </div>,
    document.body,
  );
}
