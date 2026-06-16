"use client";

import type { ReactNode } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { OLD_TESTAMENT_MAX_BOOK_NUMBER } from "@/lib/bible/scripture-books";
import type { ScriptureCanonCatalogBook, ScriptureCanonCatalogSection } from "@/lib/bible/read-scripture-canon-catalog";
import { canonSectionTheme } from "@/lib/read/canon-section-theme";

type Props = {
  sections: ScriptureCanonCatalogSection[];
  highlightedBookId: string;
  onBookPress: (book: ScriptureCanonCatalogBook) => void;
  chapterColumn: ReactNode;
};

type TestamentGroup = {
  testament: "old" | "new";
  sections: ScriptureCanonCatalogSection[];
};

function groupSectionsByTestament(sections: ScriptureCanonCatalogSection[]): TestamentGroup[] {
  const groups: TestamentGroup[] = [];
  for (const sec of sections) {
    const n = sec.books[0]?.bookNumber;
    const testament: "old" | "new" =
      typeof n === "number" && n <= OLD_TESTAMENT_MAX_BOOK_NUMBER ? "old" : "new";
    const prev = groups[groups.length - 1];
    if (prev && prev.testament === testament) {
      prev.sections.push(sec);
    } else {
      groups.push({ testament, sections: [sec] });
    }
  }
  return groups;
}

function TestamentColumn({
  testament,
  group,
  highlightedBookId,
  onBookPress,
}: {
  testament: "old" | "new";
  group: TestamentGroup | undefined;
  highlightedBookId: string;
  onBookPress: (book: ScriptureCanonCatalogBook) => void;
}) {
  const { t } = useLocale();
  const title =
    testament === "old" ? t("pages.read.catalogTestamentOld") : t("pages.read.catalogTestamentNew");

  return (
    <div
      className={`read-jump-catalog-testament-column read-jump-catalog-testament-column--${testament}`}
    >
      <p className={`bc-jump-testament-header bc-jump-testament-header--${testament}`}>{title}</p>
      <div className="read-jump-catalog-testament-scroll read-bible-typography">
        {group?.sections.map((section) => {
          const sectionTheme = canonSectionTheme(section.sectionId, testament);
          return (
            <section
              key={section.sectionId}
              className="bc-jump-section-block"
              data-section-id={section.sectionId}
              style={{ ["--bc-jump-accent" as string]: sectionTheme.accent } as React.CSSProperties}
            >
              <h2 className="bc-jump-section-title" style={{ color: sectionTheme.accent }}>
                {section.title}
              </h2>
              <div className="bc-jump-books">
                {section.books.map((book) => {
                  const selected = highlightedBookId === book.bookId;
                  return (
                    <button
                      key={book.bookId}
                      type="button"
                      className={[
                        "bc-jump-book-row bc-jump-book-row--compact",
                        selected ? "bc-jump-book-row--active" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      aria-label={[section.title, book.bookName, "打开选章"].join("。")}
                      onClick={() => onBookPress(book)}
                    >
                      <span
                        className="bc-jump-book-num"
                        style={{ color: sectionTheme.accent }}
                        aria-hidden
                      >
                        {String(book.bookNumber).padStart(2, "0")}
                      </span>
                      <span className="bc-jump-book-name">{book.bookName}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

/** 宽屏跳转目录：旧约 | 新约 | 章次 三栏 */
export function JumpCatalogWideGrid({
  sections,
  highlightedBookId,
  onBookPress,
  chapterColumn,
}: Props) {
  const groups = groupSectionsByTestament(sections);

  return (
    <div className="read-jump-catalog-wide-grid">
      <TestamentColumn
        testament="old"
        group={groups.find((g) => g.testament === "old")}
        highlightedBookId={highlightedBookId}
        onBookPress={onBookPress}
      />
      <TestamentColumn
        testament="new"
        group={groups.find((g) => g.testament === "new")}
        highlightedBookId={highlightedBookId}
        onBookPress={onBookPress}
      />
      <aside className="read-jump-catalog-chapters-column">{chapterColumn}</aside>
    </div>
  );
}
