"use client";

import { useState } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { ReadChapterInfoEditionBlock } from "@/components/bible/ReadChapterInfoEditionBlock";
import type { InfoEditionReaderVariant } from "@/lib/bible/info-edition-v1-publish";
import type { InfoEditionV1PublishedChapter } from "@/lib/bible/info-edition-v1-published-types";

type Props = {
  bookId: string;
  chapter: number;
  initialInfoPublished?: InfoEditionV1PublishedChapter | null;
  initialGuidePublished?: InfoEditionV1PublishedChapter | null;
};

export function ReadChapterPostReadingEditions({
  bookId,
  chapter,
  initialInfoPublished = null,
  initialGuidePublished = null,
}: Props) {
  const { t } = useLocale();
  const [active, setActive] = useState<InfoEditionReaderVariant | null>(null);

  const toggle = (variant: InfoEditionReaderVariant) => {
    setActive((current) => (current === variant ? null : variant));
  };

  return (
    <section
      className="read-chapter-post-reading-editions"
      aria-label={t("pages.read.postReadingEditionsAriaLabel")}
    >
      <p className="read-chapter-post-reading-editions-lead">{t("pages.read.postReadingEditionsLead")}</p>
      <div
        className="read-chapter-post-reading-editions-choices"
        role="group"
        aria-label={t("pages.read.postReadingEditionsChoicesAria")}
      >
        <button
          type="button"
          className={
            active === "guide"
              ? "read-chapter-post-reading-editions-choice read-chapter-post-reading-editions-choice--active"
              : "read-chapter-post-reading-editions-choice"
          }
          aria-pressed={active === "guide"}
          onClick={() => toggle("guide")}
        >
          {t("pages.read.postReadingEditionGuide")}
        </button>
        <button
          type="button"
          className={
            active === "info"
              ? "read-chapter-post-reading-editions-choice read-chapter-post-reading-editions-choice--active"
              : "read-chapter-post-reading-editions-choice"
          }
          aria-pressed={active === "info"}
          onClick={() => toggle("info")}
        >
          {t("pages.read.postReadingEditionInfo")}
        </button>
      </div>

      <div className="read-chapter-post-reading-editions-panels">
        <ReadChapterInfoEditionBlock
          variant="guide"
          bookId={bookId}
          chapter={chapter}
          isActive={active === "guide"}
          initialPublished={initialGuidePublished}
        />
        <ReadChapterInfoEditionBlock
          variant="info"
          bookId={bookId}
          chapter={chapter}
          isActive={active === "info"}
          initialPublished={initialInfoPublished}
        />
      </div>
    </section>
  );
}
