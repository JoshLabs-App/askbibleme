"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { ReadChapterInfoEditionBlock } from "@/components/bible/ReadChapterInfoEditionBlock";
import { useReadChapterSpreadLayout } from "@/hooks/useReadChapterSpreadLayout";
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

function PostReadingEditionPill({
  panel,
  active,
  onSelect,
}: {
  panel: PanelCopy;
  active: boolean;
  onSelect: () => void;
}) {
  const variant = panel.side === "guide" ? "guide" : "info";

  return (
    <button
      type="button"
      role="tab"
      id={`read-edition-tab-${variant}`}
      aria-selected={active}
      aria-controls={`read-edition-panel-${variant}`}
      className={[
        "read-chapter-edition-pill",
        panel.side === "guide" ? "read-chapter-edition-pill--discover" : "read-chapter-edition-pill--consult",
        active ? "read-chapter-edition-pill--active" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={onSelect}
    >
      {panel.tagIcon}
      {panel.tag}
    </button>
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
  const ariaLabel = panel.title;

  return (
    <button
      type="button"
      className={panelClass(active, panel.side)}
      aria-pressed={active}
      aria-label={ariaLabel}
      onClick={onToggle}
    >
      <div className="read-chapter-post-reading-editions-panel-art" aria-hidden>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={panel.art} alt="" className="read-chapter-post-reading-editions-panel-art-img" />
      </div>
      <div className="read-chapter-post-reading-editions-panel-body">
        <span className="read-chapter-post-reading-editions-panel-title read-chapter-post-reading-editions-panel-title--choice">
          {panel.title}
        </span>
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
  const isSpread = useReadChapterSpreadLayout();
  const [active, setActive] = useState<InfoEditionReaderVariant | null>(null);

  const selectVariant = (variant: InfoEditionReaderVariant) => {
    setActive(variant);
  };

  useEffect(() => {
    if (isSpread && active === null) {
      setActive("guide");
    }
  }, [isSpread, active]);

  const showGuide = active === "guide";
  const showInfo = active === "info";

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
      className={[
        "read-chapter-post-reading-editions",
        isSpread ? "read-chapter-post-reading-editions--spread" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label={t("pages.read.postReadingEditionsAriaLabel")}
    >
      <header
        className={[
          "read-chapter-post-reading-editions-heading",
          isSpread ? "read-chapter-post-reading-editions-heading--spread" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <h2 className="read-chapter-post-reading-editions-heading-text">
          {t("pages.read.postReadingEditionsHeading")}
        </h2>
        <div className="read-chapter-post-reading-editions-heading-rule" aria-hidden>
          <span className="read-chapter-post-reading-editions-heading-rule-line" />
        </div>
      </header>

      {isSpread ? (
        <div
          className="read-chapter-edition-switcher"
          role="tablist"
          aria-label={t("pages.read.postReadingEditionsChoicesAria")}
        >
          <PostReadingEditionPill
            panel={panels[0]}
            active={active === "guide"}
            onSelect={() => selectVariant("guide")}
          />
          <PostReadingEditionPill
            panel={panels[1]}
            active={active === "info"}
            onSelect={() => selectVariant("info")}
          />
        </div>
      ) : null}

      {!isSpread ? (
        <div className="read-chapter-post-reading-editions-board-wrap">
          <div
            className="read-chapter-post-reading-editions-board"
            role="group"
            aria-label={t("pages.read.postReadingEditionsChoicesAria")}
          >
            <PostReadingPanel
              panel={panels[0]}
              active={active === "guide"}
              onToggle={() => selectVariant("guide")}
            />
            <PostReadingPanel
              panel={panels[1]}
              active={active === "info"}
              onToggle={() => selectVariant("info")}
            />
          </div>
          <span className="read-chapter-post-reading-editions-or" aria-hidden>
            {t("pages.read.postReadingEditionsOr")}
          </span>
        </div>
      ) : null}

      <div className="read-chapter-post-reading-editions-panels">
        {showGuide ? (
          <div id="read-edition-panel-guide" role="tabpanel" aria-labelledby="read-edition-tab-guide">
            <ReadChapterInfoEditionBlock
              key={`guide-${bookId}-${chapter}`}
              variant="guide"
              bookId={bookId}
              chapter={chapter}
              isActive
              initialPublished={initialGuidePublished}
              showHeroBadge={!isSpread}
            />
          </div>
        ) : null}
        {showInfo ? (
          <div id="read-edition-panel-info" role="tabpanel" aria-labelledby="read-edition-tab-info">
            <ReadChapterInfoEditionBlock
              key={`info-${bookId}-${chapter}`}
              variant="info"
              bookId={bookId}
              chapter={chapter}
              isActive
              initialPublished={initialInfoPublished}
              showHeroBadge={!isSpread}
            />
          </div>
        ) : null}
      </div>
    </section>
  );
}
