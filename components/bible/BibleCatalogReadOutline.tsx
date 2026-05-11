"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import {
  formatBibleBookHistoryEraAriaZh,
  formatBibleBookHistoryEraCompact,
} from "@/lib/bible/bible-book-history-era";
import { scriptureBooks } from "@/lib/bible/scripture-books";
import type { ScriptureCanonCatalogBook, ScriptureCanonCatalogSection } from "@/lib/bible/read-scripture-canon-catalog";

type Props = {
  sections: ScriptureCanonCatalogSection[];
};

type SheetModel = {
  bookId: string;
  bookName: string;
  chapters: number;
  anchorTop: number;
  anchorBottom: number;
  anchorLeft: number;
  anchorWidth: number;
};

type PanelLayout = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
};

const chaptersByBookId = new Map(scriptureBooks.map((b) => [b.bookId, b.chapters]));

function readerChapterHref(bookId: string, chapter: number): string {
  return `/read/${encodeURIComponent(bookId)}/${chapter}`;
}

function computePanelLayout(s: SheetModel): PanelLayout {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const pad = 12;
  const panelW = Math.min(344, vw - pad * 2);
  const idealLeft = s.anchorLeft + s.anchorWidth / 2 - panelW / 2;
  const left = Math.max(pad, Math.min(idealLeft, vw - panelW - pad));
  const gap = 6;
  let top = s.anchorBottom + gap;
  let maxH = vh - top - pad;
  if (maxH < 200) {
    const tryTop = Math.max(pad, s.anchorTop - Math.min(340, s.anchorTop - pad - gap));
    const tryMax = s.anchorTop - tryTop - gap;
    if (tryMax > maxH) {
      top = tryTop;
      maxH = Math.max(160, tryMax);
    }
  }
  maxH = Math.max(160, Math.min(maxH, vh - top - pad));
  return { top, left, width: panelW, maxHeight: maxH };
}

const OLD_TESTAMENT_MAX_BOOK_NUMBER = 39;

function testamentForSection(section: ScriptureCanonCatalogSection): "old" | "new" {
  const n = section.books[0]?.bookNumber;
  if (typeof n !== "number") return "old";
  return n <= OLD_TESTAMENT_MAX_BOOK_NUMBER ? "old" : "new";
}

function groupSectionsByTestament(sections: ScriptureCanonCatalogSection[]) {
  type Group = { testament: "old" | "new"; sections: ScriptureCanonCatalogSection[] };
  const groups: Group[] = [];
  for (const sec of sections) {
    const t = testamentForSection(sec);
    const prev = groups[groups.length - 1];
    if (prev && prev.testament === t) {
      prev.sections.push(sec);
    } else {
      groups.push({ testament: t, sections: [sec] });
    }
  }
  return groups;
}

/** 旧约 / 新约分组；点卷名在点击位置附近滑出选章 */
export function BibleCatalogReadOutline({ sections }: Props) {
  const groups = groupSectionsByTestament(sections);
  const [sheet, setSheet] = useState<SheetModel | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [portalReady, setPortalReady] = useState(false);
  const [layoutTick, setLayoutTick] = useState(0);

  const panelLayout = useMemo(() => {
    void layoutTick;
    return sheet ? computePanelLayout(sheet) : null;
  }, [sheet, layoutTick]);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useLayoutEffect(() => {
    if (!sheet) {
      setSheetOpen(false);
      return;
    }
    const id = requestAnimationFrame(() => setSheetOpen(true));
    return () => cancelAnimationFrame(id);
  }, [sheet]);

  useEffect(() => {
    if (!sheet) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSheetOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sheet]);

  useEffect(() => {
    if (!sheet) return;
    const onScroll = () => setSheetOpen(false);
    window.addEventListener("scroll", onScroll, true);
    return () => window.removeEventListener("scroll", onScroll, true);
  }, [sheet]);

  useEffect(() => {
    if (!sheet) return;
    const bump = () => setLayoutTick((n) => n + 1);
    window.addEventListener("resize", bump);
    window.addEventListener("orientationchange", bump);
    return () => {
      window.removeEventListener("resize", bump);
      window.removeEventListener("orientationchange", bump);
    };
  }, [sheet]);

  const closeSheet = useCallback(() => setSheetOpen(false), []);

  const onPanelTransitionEnd = useCallback(
    (e: React.TransitionEvent<HTMLDivElement>) => {
      if (e.propertyName !== "transform") return;
      if (!sheetOpen) setSheet(null);
    },
    [sheetOpen],
  );

  const openSheet = useCallback((book: ScriptureCanonCatalogBook, el: HTMLElement) => {
    const n = chaptersByBookId.get(book.bookId);
    if (typeof n !== "number" || n < 1) return;
    const r = el.getBoundingClientRect();
    setSheet({
      bookId: book.bookId,
      bookName: book.bookName,
      chapters: n,
      anchorTop: r.top,
      anchorBottom: r.bottom,
      anchorLeft: r.left,
      anchorWidth: r.width,
    });
  }, []);

  const sheetNode =
    portalReady &&
    sheet &&
    panelLayout &&
    createPortal(
      <div
        className={`bc-sheet-root bible-catalog-page--read${sheetOpen ? " bc-sheet-root--open" : ""}`}
        role="presentation"
      >
        <button type="button" className="bc-sheet-backdrop" aria-label="关闭选章" onClick={closeSheet} />
        <div
          className="bc-sheet-panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="bc-sheet-title"
          style={{
            top: panelLayout.top,
            left: panelLayout.left,
            width: panelLayout.width,
            maxHeight: panelLayout.maxHeight,
          }}
          onTransitionEnd={onPanelTransitionEnd}
        >
          <div className="bc-sheet-panel-inner">
            <header className="bc-sheet-header">
              <div>
                <h2 id="bc-sheet-title" className="bc-sheet-title">
                  {sheet.bookName}
                </h2>
                <p className="bc-sheet-sub" aria-hidden="true">
                  1–{sheet.chapters}
                </p>
              </div>
              <button type="button" className="bc-sheet-close" onClick={closeSheet} aria-label="关闭">
                ×
              </button>
            </header>
            <nav className="bible-catalog-chapters-grid bc-sheet-chapters" aria-label={`${sheet.bookName} 章次`}>
              {Array.from({ length: sheet.chapters }, (_, i) => i + 1).map((ch) => (
                <Link
                  key={ch}
                  href={readerChapterHref(sheet.bookId, ch)}
                  className="bible-catalog-chapter-cell"
                  aria-label={`第 ${ch} 章`}
                >
                  {ch}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </div>,
      document.body,
    );

  return (
    <>
      <nav className="bible-catalog-read-outline" aria-label="正典十段">
        {groups.map((group) => (
          <div
            key={group.testament}
            role="group"
            className={`bible-catalog-read-testament bible-catalog-read-testament--${group.testament}`}
            aria-labelledby={`bc-testament-${group.testament}`}
          >
            <div className="bible-catalog-read-testament-body">
              <p
                id={`bc-testament-${group.testament}`}
                className="bible-catalog-read-testament-label bible-catalog-read-heading-row"
              >
                <span className="bible-catalog-read-heading-left">
                  {group.testament === "old" ? "旧约" : "新约"}
                </span>
                <span className="bible-catalog-read-heading-right" aria-hidden="true" />
              </p>
              {group.sections.map((section) => (
                <section key={section.sectionId} id={section.sectionId} className="bible-catalog-read-block">
                  <h2 className="bible-catalog-read-title bible-catalog-read-heading-row">
                    <span className="bible-catalog-read-heading-left">{section.title}</span>
                    <span className="bible-catalog-read-heading-right" aria-hidden="true" />
                  </h2>
                  <div className="bible-catalog-read-books">
                    {section.books.map((book) => {
                      const eraCompact = formatBibleBookHistoryEraCompact(book.bookId);
                      const eraAria = formatBibleBookHistoryEraAriaZh(book.bookId);
                      return (
                        <button
                          key={book.bookId}
                          type="button"
                          className="bible-catalog-read-book bible-catalog-read-book--tap"
                          aria-label={
                            [
                              group.testament === "old" ? "旧约" : "新约",
                              eraAria ? `历史时期${eraAria}` : "",
                              section.title,
                              book.bookName,
                              `神是${book.divine}`,
                              book.summary,
                              "在点击处打开选章",
                            ]
                              .filter(Boolean)
                              .join("。")
                          }
                          aria-haspopup="dialog"
                          onClick={(e) => openSheet(book, e.currentTarget)}
                        >
                          <span className="bible-catalog-read-book-era" title={eraAria || undefined}>
                            {eraCompact}
                          </span>
                          <span className="bible-catalog-read-book-body">
                            <span className="bible-catalog-read-book-num" aria-hidden="true">
                              {book.bookNumber}
                            </span>
                            <span className="bible-catalog-read-book-main">
                              <strong className="bible-catalog-read-book-name">{book.bookName}</strong>
                              <span className="bible-catalog-read-book-divine">神是{book.divine}</span>
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          </div>
        ))}
      </nav>
      {sheetNode}
    </>
  );
}
