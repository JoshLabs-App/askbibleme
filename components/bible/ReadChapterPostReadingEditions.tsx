"use client";

import Image from "next/image";
import { useState, type ReactNode } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { ReadChapterInfoEditionBlock } from "@/components/bible/ReadChapterInfoEditionBlock";
import type { InfoEditionReaderVariant } from "@/lib/bible/info-edition-v1-publish";
import type { InfoEditionV1PublishedChapter } from "@/lib/bible/info-edition-v1-published-types";

const DISCOVER_ART = "/read/post-reading/discover-self.png";
const CONSULT_ART = "/read/post-reading/consult-materials.png";

type Props = {
  bookId: string;
  chapter: number;
  initialInfoPublished?: InfoEditionV1PublishedChapter | null;
  initialGuidePublished?: InfoEditionV1PublishedChapter | null;
};

type PanelCopy = {
  side: "guide" | "info";
  art: string;
  tag: string;
  title: string;
  blurb: string;
  tagIcon: ReactNode;
};

function panelClass(active: boolean, side: "guide" | "info"): string {
  const base = "read-chapter-post-reading-editions-panel";
  const sideClass =
    side === "guide"
      ? "read-chapter-post-reading-editions-panel--discover"
      : "read-chapter-post-reading-editions-panel--consult";
  return active ? `${base} ${sideClass} read-chapter-post-reading-editions-panel--active` : `${base} ${sideClass}`;
}

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

function LeafIcon({ className }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
      <path
        d="M12 3c-4 4-6 8-6 12 0 3 2.5 5 6 6 4-1 6-3 6-6 0-4-2-8-6-12Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M12 9v10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function PostReadingPanel({
  panel,
  active,
  onToggle,
}: {
  panel: PanelCopy;
  active: boolean;
  onToggle: () => void;
}) {
  const ariaLabel = `${panel.tag} · ${panel.title}`;

  return (
    <button
      type="button"
      className={panelClass(active, panel.side)}
      aria-pressed={active}
      aria-label={ariaLabel}
      onClick={onToggle}
    >
      <div className="read-chapter-post-reading-editions-panel-art" aria-hidden>
        <Image
          src={panel.art}
          alt=""
          fill
          unoptimized
          sizes="(max-width: 560px) 50vw, 22rem"
          className="read-chapter-post-reading-editions-panel-art-img"
        />
      </div>
      <div className="read-chapter-post-reading-editions-panel-body">
        <span className="read-chapter-post-reading-editions-panel-badge">
          {panel.tagIcon}
          {panel.tag}
        </span>
        <span className="read-chapter-post-reading-editions-panel-title">{panel.title}</span>
        <span className="read-chapter-post-reading-editions-panel-title-rule" aria-hidden />
        <p className="read-chapter-post-reading-editions-panel-blurb">{panel.blurb}</p>
      </div>
    </button>
  );
}

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

  const panels: PanelCopy[] = [
    {
      side: "guide",
      art: DISCOVER_ART,
      tag: t("pages.read.postReadingEditionGuideTag"),
      title: t("pages.read.postReadingEditionGuideTitle"),
      blurb: t("pages.read.postReadingEditionGuideBlurb"),
      tagIcon: <CompassIcon />,
    },
    {
      side: "info",
      art: CONSULT_ART,
      tag: t("pages.read.postReadingEditionInfoTag"),
      title: t("pages.read.postReadingEditionInfoTitle"),
      blurb: t("pages.read.postReadingEditionInfoBlurb"),
      tagIcon: <BookIcon />,
    },
  ];

  return (
    <section
      className="read-chapter-post-reading-editions"
      aria-label={t("pages.read.postReadingEditionsAriaLabel")}
    >
      <header className="read-chapter-post-reading-editions-heading">
        <h2 className="read-chapter-post-reading-editions-heading-text">
          {t("pages.read.postReadingEditionsHeading")}
        </h2>
        <div className="read-chapter-post-reading-editions-heading-rule" aria-hidden>
          <span className="read-chapter-post-reading-editions-heading-rule-line" />
          <LeafIcon className="read-chapter-post-reading-editions-heading-leaf" />
          <span className="read-chapter-post-reading-editions-heading-rule-line" />
        </div>
      </header>

      <div
        className="read-chapter-post-reading-editions-board"
        role="group"
        aria-label={t("pages.read.postReadingEditionsChoicesAria")}
      >
        <PostReadingPanel
          panel={panels[0]}
          active={active === "guide"}
          onToggle={() => toggle("guide")}
        />

        <PostReadingPanel
          panel={panels[1]}
          active={active === "info"}
          onToggle={() => toggle("info")}
        />
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
