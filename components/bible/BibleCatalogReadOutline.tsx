"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import {
  formatBibleBookHistoryEraAriaZh,
  formatBibleBookHistoryEraCompact,
} from "@/lib/bible/bible-book-history-era";
import { READ_TESTAMENT_INTRO } from "@/lib/bible/read-testament-intro";
import { OLD_TESTAMENT_MAX_BOOK_NUMBER, scriptureBooks } from "@/lib/bible/scripture-books";
import type { ScriptureCanonCatalogBook, ScriptureCanonCatalogSection } from "@/lib/bible/read-scripture-canon-catalog";
import {
  readCompletedChapterCountsByBook,
  subscribeReadChapterCompletion,
} from "@/lib/read/read-chapter-completion";

type Props = {
  sections: ScriptureCanonCatalogSection[];
  paginateByTestament?: boolean;
  showBookSummary?: boolean;
  activeBookId?: string;
  /** 章页底栏「读经目录」：双列正典 + 居中选章（对齐 iOS） */
  jumpCatalog?: boolean;
  onChapterNavigate?: (bookId: string, chapter: number) => void;
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

function computeJumpCatalogPanelLayout(): PanelLayout {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const pad = 16;
  const panelW = Math.min(360, vw - pad * 2);
  const left = Math.max(pad, (vw - panelW) / 2);
  const maxH = Math.min(360, Math.max(220, vh * 0.42));
  const top = Math.max(pad, vh - maxH - pad - 12);
  return { top, left, width: panelW, maxHeight: maxH };
}

/** 首页 / 独立目录选章：居中 Modal（对齐 iOS `BibleCatalogOutline`） */
function computeCenteredChapterSheetLayout(): PanelLayout {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const pad = 20;
  const panelW = Math.min(360, vw - pad * 2);
  const left = Math.max(pad, (vw - panelW) / 2);
  const maxH = Math.min(Math.round(vh * 0.7), 520);
  const top = Math.max(pad, Math.round((vh - maxH) / 2));
  return { top, left, width: panelW, maxHeight: maxH };
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
export function BibleCatalogReadOutline({
  sections,
  paginateByTestament = false,
  showBookSummary = false,
  activeBookId,
  jumpCatalog = false,
  onChapterNavigate,
}: Props) {
  const { t, locale } = useLocale();
  const groups = groupSectionsByTestament(sections);
  const [activeTestament, setActiveTestament] = useState<"old" | "new">("new");
  const catalogBookIds = useMemo(
    () => sections.flatMap((section) => section.books.map((book) => book.bookId)),
    [sections],
  );
  const [completedByBook, setCompletedByBook] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!paginateByTestament) return;
    setActiveTestament("new");
  }, [paginateByTestament]);

  useEffect(() => {
    const reload = () => setCompletedByBook(readCompletedChapterCountsByBook(catalogBookIds));
    reload();
    return subscribeReadChapterCompletion(reload);
  }, [catalogBookIds]);

  const visibleGroups = useMemo(
    () => (paginateByTestament ? groups.filter((g) => g.testament === activeTestament) : groups),
    [groups, paginateByTestament, activeTestament],
  );

  const testamentIntro = READ_TESTAMENT_INTRO[locale] ?? READ_TESTAMENT_INTRO["zh-CN"];

  const [sheet, setSheet] = useState<SheetModel | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [portalReady, setPortalReady] = useState(false);
  const [layoutTick, setLayoutTick] = useState(0);

  const centerChapterSheet = showBookSummary && !jumpCatalog;

  const panelLayout = useMemo(() => {
    void layoutTick;
    if (!sheet) return null;
    if (jumpCatalog) return computeJumpCatalogPanelLayout();
    if (centerChapterSheet) return computeCenteredChapterSheetLayout();
    return computePanelLayout(sheet);
  }, [sheet, layoutTick, jumpCatalog, centerChapterSheet]);

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

  const closeSheetAndNavigate = useCallback(
    (targetBookId: string, ch: number) => {
      setSheetOpen(false);
      onChapterNavigate?.(targetBookId, ch);
    },
    [onChapterNavigate],
  );

  const sheetNode =
    portalReady &&
    sheet &&
    panelLayout &&
    createPortal(
      <div
        className={`bc-sheet-root bible-catalog-page--read${sheetOpen ? " bc-sheet-root--open" : ""}${jumpCatalog ? " bc-sheet-root--jump-catalog" : ""}${centerChapterSheet ? " bc-sheet-root--centered" : ""}`}
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
          <div className="bc-sheet-panel-inner read-bible-typography">
            <header className="bc-sheet-header">
              <div>
                <h2 id="bc-sheet-title" className="bc-sheet-title">
                  {sheet.bookName}
                </h2>
                {centerChapterSheet ? null : (
                  <p className="bc-sheet-sub" aria-hidden="true">
                    1–{sheet.chapters}
                  </p>
                )}
              </div>
              <button type="button" className="bc-sheet-close" onClick={closeSheet} aria-label="关闭">
                ×
              </button>
            </header>
            <nav
              className={[
                "bible-catalog-chapters-grid bc-sheet-chapters",
                centerChapterSheet ? "bc-sheet-chapters--centered" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              aria-label={`${sheet.bookName} 章次`}
            >
              {Array.from({ length: sheet.chapters }, (_, i) => i + 1).map((ch) =>
                onChapterNavigate ? (
                  <button
                    key={ch}
                    type="button"
                    className="bible-catalog-chapter-cell"
                    aria-label={`第 ${ch} 章`}
                    onClick={() => closeSheetAndNavigate(sheet.bookId, ch)}
                  >
                    {ch}
                  </button>
                ) : (
                  <Link
                    key={ch}
                    href={readerChapterHref(sheet.bookId, ch)}
                    className="bible-catalog-chapter-cell"
                    aria-label={`第 ${ch} 章`}
                  >
                    {ch}
                  </Link>
                ),
              )}
            </nav>
          </div>
        </div>
      </div>,
      document.body,
    );

  return (
    <>
      <div
        className={
          paginateByTestament
            ? [
                "bc-home-testament-frame mb-1.5 w-full",
                activeTestament === "old" ? "bc-home-testament-frame--old" : "bc-home-testament-frame--new",
              ].join(" ")
            : "contents"
        }
      >
        {paginateByTestament ? (
          <>
            <div className="bc-home-testament-pager" role="tablist" aria-label={t("pages.read.catalogSection")}>
              <button
                type="button"
                role="tab"
                aria-selected={activeTestament === "old"}
                className={[
                  "bc-home-testament-tab bc-home-testament-tab--old",
                  activeTestament === "old" ? "bc-home-testament-tab--active" : "",
                ].join(" ")}
                onClick={() => setActiveTestament("old")}
              >
                {t("pages.read.catalogTestamentOld")}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTestament === "new"}
                className={[
                  "bc-home-testament-tab bc-home-testament-tab--new",
                  activeTestament === "new" ? "bc-home-testament-tab--active" : "",
                ].join(" ")}
                onClick={() => setActiveTestament("new")}
              >
                {t("pages.read.catalogTestamentNew")}
              </button>
            </div>
            <p className="bc-home-testament-intro">{testamentIntro[activeTestament]}</p>
          </>
        ) : null}

      <nav
        className={[
          "bible-catalog-read-outline",
          showBookSummary ? "bible-catalog-read-outline--home" : "",
          jumpCatalog ? "bible-catalog-read-outline--jump-columns bible-catalog-on-parchment" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        aria-label="正典十段"
      >
        {visibleGroups.map((group) => (
          <div
            key={group.testament}
            role="group"
            className={`bible-catalog-read-testament bible-catalog-read-testament--${group.testament}`}
            aria-labelledby={paginateByTestament ? undefined : `bc-testament-${group.testament}`}
          >
            <div className="bible-catalog-read-testament-body">
              {!paginateByTestament && !jumpCatalog ? (
                <p
                  id={`bc-testament-${group.testament}`}
                  className="bible-catalog-read-testament-label"
                >
                  <span className="bible-catalog-read-testament-label-text">
                    {group.testament === "old" ? t("pages.read.catalogTestamentOld") : t("pages.read.catalogTestamentNew")}
                  </span>
                </p>
              ) : null}
              {group.sections.map((section) => {
                const plainSection =
                  showBookSummary &&
                  (section.sectionId === "canon-torah" || section.sectionId === "canon-gospels");
                return (
                <section
                  key={section.sectionId}
                  id={section.sectionId}
                  className={[
                    "bible-catalog-read-block",
                    showBookSummary ? "bc-home-section-block" : "",
                    plainSection ? "bc-home-section-block--plain" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  data-section-id={section.sectionId}
                >
                  {showBookSummary ? (
                    <h2 className="bc-home-section-title">{section.title}</h2>
                  ) : jumpCatalog ? (
                    <h2 className="bc-jump-section-title bible-catalog-read-title">{section.title}</h2>
                  ) : (
                    <h2 className="bible-catalog-read-title bible-catalog-read-heading-row">
                      <span className="bible-catalog-read-heading-left">{section.title}</span>
                      <span className="bible-catalog-read-heading-right" aria-hidden="true" />
                    </h2>
                  )}
                  <div
                    className={
                      showBookSummary
                        ? "bc-home-books"
                        : jumpCatalog
                          ? "bc-jump-books"
                          : "bible-catalog-read-books"
                    }
                  >
                    {section.books.map((book) => {
                      const eraCompact = formatBibleBookHistoryEraCompact(book.bookId);
                      const eraAria = formatBibleBookHistoryEraAriaZh(book.bookId);
                      const totalChapters = chaptersByBookId.get(book.bookId) ?? 0;
                      const completedChapters = Math.max(
                        0,
                        Math.min(totalChapters, completedByBook[book.bookId] ?? 0),
                      );
                      const progressRatio =
                        totalChapters > 0 ? Math.max(0, Math.min(1, completedChapters / totalChapters)) : 0;
                      const selected = activeBookId === book.bookId;

                      if (showBookSummary) {
                        return (
                          <button
                            key={book.bookId}
                            type="button"
                            className={[
                              "bc-home-book-row",
                              selected ? "bc-home-book-row--active" : "",
                            ]
                              .filter(Boolean)
                              .join(" ")}
                            data-section-id={section.sectionId}
                            aria-label={
                              [
                                group.testament === "old"
                                  ? t("pages.read.catalogTestamentOld")
                                  : t("pages.read.catalogTestamentNew"),
                                section.title,
                                book.bookName,
                                book.summary,
                                totalChapters > 0 ? `已读 ${completedChapters}/${totalChapters} 章` : "",
                                "在点击处打开选章",
                              ]
                                .filter(Boolean)
                                .join("。")
                            }
                            aria-haspopup="dialog"
                            onClick={(e) => openSheet(book, e.currentTarget)}
                          >
                            <span className="bc-home-book-badge" aria-hidden>
                              {String(book.bookNumber).padStart(2, "0")}
                            </span>
                            <span className="bc-home-book-main">
                              <span className="bc-home-book-name">{book.bookName}</span>
                              {book.summary ? (
                                <span className="bc-home-book-summary">{book.summary}</span>
                              ) : null}
                              {totalChapters > 0 ? (
                                <span className="bc-home-book-progress-track" aria-hidden>
                                  <span
                                    className="bc-home-book-progress-fill"
                                    style={{ width: `${Math.round(progressRatio * 100)}%` }}
                                  />
                                </span>
                              ) : null}
                            </span>
                            {totalChapters > 0 ? (
                              <span className="bc-home-book-meta" aria-hidden>
                                <span className="bc-home-book-progress-text">
                                  {completedChapters}/{totalChapters}
                                </span>
                              </span>
                            ) : null}
                            <span className="bc-home-book-chevron" aria-hidden>
                              ›
                            </span>
                          </button>
                        );
                      }

                      if (jumpCatalog) {
                        return (
                          <button
                            key={book.bookId}
                            type="button"
                            className={[
                              "bc-jump-book-row",
                              selected ? "bc-jump-book-row--active" : "",
                            ]
                              .filter(Boolean)
                              .join(" ")}
                            data-section-id={section.sectionId}
                            aria-label={[section.title, book.bookName, "打开选章"].join("。")}
                            aria-haspopup="dialog"
                            onClick={(e) => openSheet(book, e.currentTarget)}
                          >
                            <span className="bc-jump-book-num" aria-hidden>
                              {String(book.bookNumber).padStart(2, "0")}
                            </span>
                            <span className="bc-jump-book-name">{book.bookName}</span>
                          </button>
                        );
                      }

                      return (
                        <button
                          key={book.bookId}
                          type="button"
                          className={[
                            "bible-catalog-read-book bible-catalog-read-book--tap",
                            selected ? "bible-catalog-read-book--active" : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          data-section-id={section.sectionId}
                          aria-label={
                            [
                              group.testament === "old"
                                ? t("pages.read.catalogTestamentOld")
                                : t("pages.read.catalogTestamentNew"),
                              eraAria ? `历史时期${eraAria}` : "",
                              section.title,
                              book.bookName,
                              book.divine,
                              totalChapters > 0 ? `已读 ${completedChapters}/${totalChapters} 章` : "",
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
                              <span className="bible-catalog-read-book-divine">{book.divine}</span>
                              {totalChapters > 0 ? (
                                <span className="mt-1 block h-1 w-full max-w-[9rem] overflow-hidden rounded-sm bg-amber-900/10 dark:bg-stone-600/30">
                                  <span
                                    className="block h-full rounded-sm bg-[#65775C]"
                                    style={{ width: `${Math.round(progressRatio * 100)}%` }}
                                  />
                                </span>
                              ) : null}
                            </span>
                          </span>
                          {totalChapters > 0 ? (
                            <span
                              className="shrink-0 self-center pl-2 text-[11px] tabular-nums text-amber-800/55 dark:text-stone-500"
                              aria-hidden
                            >
                              {completedChapters}/{totalChapters}
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </section>
              );
              })}
            </div>
          </div>
        ))}
      </nav>
      </div>
      {sheetNode}
    </>
  );
}
