"use client";

import { useLocale } from "@/components/i18n/LocaleProvider";
import type { InfoEditionReaderVariant } from "@/lib/bible/info-edition-v1-publish";

function CompassIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
      <path d="m12 8 2.5 6.5L12 14l-2.5.5L12 8Z" fill="currentColor" />
    </svg>
  );
}

function BookIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 4.5h9a2 2 0 0 1 2 2V19a2 2 0 0 0-2-2H6V4.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M6 4.5v14.5a2 2 0 0 1 2-2h9"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type Props = {
  variant: InfoEditionReaderVariant;
};

export function PostReadingEditionHero({ variant }: Props) {
  const { t } = useLocale();
  const isDiscover = variant === "guide";
  const tag = isDiscover
    ? t("pages.read.postReadingEditionGuideTag")
    : t("pages.read.postReadingEditionInfoTag");

  return (
    <header
      className={
        isDiscover
          ? "read-chapter-info-edition-hero read-chapter-info-edition-hero--discover"
          : "read-chapter-info-edition-hero read-chapter-info-edition-hero--consult"
      }
      aria-label={tag}
    >
      <span className="read-chapter-info-edition-hero-badge">
        {isDiscover ? <CompassIcon /> : <BookIcon />}
        {tag}
      </span>
    </header>
  );
}
