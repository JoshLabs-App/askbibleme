"use client";

import { scriptureBooks } from "@/lib/bible/scripture-books";

type Props = {
  bookId: string;
  bookName: string;
  activeChapter?: number;
  onPickChapter: (chapter: number) => void;
};

const chaptersByBookId = new Map(scriptureBooks.map((b) => [b.bookId, b.chapters]));

/** 嵌在跳转章節弹层内选章（对齐 iOS `BibleChapterPickerPanel` embedded） */
export function BibleChapterPickerPanel({
  bookId,
  bookName,
  activeChapter,
  onPickChapter,
}: Props) {
  const total = chaptersByBookId.get(bookId) ?? 0;
  if (total < 1) return null;

  return (
    <nav
      className="read-jump-chapter-picker-grid bc-sheet-chapters bc-sheet-chapters--centered"
      aria-label={`${bookName} 章次`}
    >
      {Array.from({ length: total }, (_, i) => i + 1).map((ch) => {
        const isCurrent = activeChapter === ch;
        return (
          <button
            key={ch}
            type="button"
            className={[
              "bible-catalog-chapter-cell",
              isCurrent ? "bible-catalog-chapter-cell--current" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            aria-label={`第 ${ch} 章`}
            aria-current={isCurrent ? "page" : undefined}
            onClick={() => onPickChapter(ch)}
          >
            {ch}
          </button>
        );
      })}
    </nav>
  );
}
