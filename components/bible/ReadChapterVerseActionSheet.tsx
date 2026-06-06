"use client";

import { useEffect } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";

export type VerseActionMenuState = { verse: number; text: string } | null;

type Props = {
  menu: VerseActionMenuState;
  highlightModeActive: boolean;
  onClose: () => void;
  onCopy: () => void;
  onOpenMultiCopy: () => void;
  onOpenHighlight: () => void;
  onShare: () => void;
};

export function ReadChapterVerseActionSheet({
  menu,
  highlightModeActive,
  onClose,
  onCopy,
  onOpenMultiCopy,
  onOpenHighlight,
  onShare,
}: Props) {
  const { t, locale } = useLocale();

  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menu, onClose]);

  if (!menu) return null;

  const title =
    locale === "en"
      ? `Verse ${menu.verse}`
      : t("pages.read.verseActionVerseTitle", { verse: String(menu.verse) });

  return (
    <div className="read-chapter-verse-action-root" role="presentation">
      <button type="button" className="read-chapter-verse-action-backdrop" aria-label={t("pages.read.verseActionClose")} onClick={onClose} />
      <div className="read-chapter-verse-action-sheet" role="dialog" aria-modal="true" aria-labelledby="read-verse-action-title">
        <p id="read-verse-action-title" className="read-chapter-verse-action-title">
          {title}
        </p>
        <button type="button" className="read-chapter-verse-action-btn" onClick={onCopy}>
          {t("pages.read.verseActionCopy")}
        </button>
        <button type="button" className="read-chapter-verse-action-btn" onClick={onOpenMultiCopy}>
          {t("pages.read.verseActionMultiCopy")}
        </button>
        <button type="button" className="read-chapter-verse-action-btn" onClick={onOpenHighlight}>
          {highlightModeActive
            ? t("pages.read.verseHighlightModeActive")
            : t("pages.read.verseHighlightAction")}
        </button>
        <button type="button" className="read-chapter-verse-action-btn" onClick={onShare}>
          {t("pages.read.verseActionShare")}
        </button>
        <button
          type="button"
          className="read-chapter-verse-action-btn read-chapter-verse-action-btn--muted"
          onClick={onClose}
        >
          {t("pages.read.verseActionClose")}
        </button>
      </div>
    </div>
  );
}
