"use client";

import { useLocale } from "@/components/i18n/LocaleProvider";
import {
  DEFAULT_VERSE_TEXT_HIGHLIGHT_COLOR,
  VERSE_TEXT_HIGHLIGHT_PALETTE,
} from "@/lib/read/read-verse-text-highlights";

type Props = {
  activeColor: string;
  onColorChange: (color: string) => void;
  onDone: () => void;
};

export function ReadChapterHighlightModeBar({ activeColor, onColorChange, onDone }: Props) {
  const { t } = useLocale();

  return (
    <div className="read-chapter-highlight-bar" role="toolbar" aria-label={t("pages.read.verseHighlightModeTitle")}>
      <p className="read-chapter-highlight-bar-title">{t("pages.read.verseHighlightModeTitle")}</p>
      <div className="read-chapter-highlight-colors" role="group" aria-label={t("pages.read.verseHighlightColorAria")}>
        {VERSE_TEXT_HIGHLIGHT_PALETTE.map((color) => {
          const active = color === activeColor;
          return (
            <button
              key={color}
              type="button"
              className={[
                "read-chapter-highlight-color-chip",
                active ? "read-chapter-highlight-color-chip--active" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              style={{ backgroundColor: color }}
              aria-label={
                active
                  ? t("pages.read.verseHighlightColorActive")
                  : t("pages.read.verseHighlightColorSwitch")
              }
              aria-pressed={active}
              onClick={() => onColorChange(color)}
            />
          );
        })}
      </div>
      <button type="button" className="read-chapter-highlight-done" onClick={onDone}>
        {t("pages.read.verseHighlightDone")}
      </button>
    </div>
  );
}

export { DEFAULT_VERSE_TEXT_HIGHLIGHT_COLOR };
