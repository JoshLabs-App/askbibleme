import Link from "next/link";
import { ExploreProsePage } from "@/components/explore/ExploreProsePage";
import { getScriptureBookDisplayName } from "@/lib/bible/scripture-book-display-name";
import type { AppLocale } from "@/lib/i18n/config";
import { getMessages } from "@/lib/i18n/messages";
import { toZhTwText } from "@/lib/i18n/zh-tw-text";
import { legacyFigureDisplayNameClient } from "@/lib/legacy-figure-locale-client";
import type {
  LegacyFigureTimelineBookRow,
  LegacyFigureTimelineEntry,
} from "@/lib/legacy-figures-timeline-types";
import { isLegacyFigurePrimary, legacyFigureEntryHref } from "@/lib/legacy-figure-preview-links";

function localizeBookName(bookId: string, locale: AppLocale): string {
  if (locale === "zh-CN") {
    return getScriptureBookDisplayName(bookId, "zh-CN");
  }
  if (locale === "zh-TW") {
    return toZhTwText(getScriptureBookDisplayName(bookId, "zh-CN"));
  }
  return getScriptureBookDisplayName(bookId, "en");
}

function BookFiguresCell({
  figures,
  locale,
}: {
  figures: LegacyFigureTimelineEntry[];
  locale: AppLocale;
}) {
  if (!figures.length) {
    return <span className="figure-library-empty-cell">—</span>;
  }

  return (
    <div className="figure-library-figure-list">
      {figures.map((figure) => {
        const variant = isLegacyFigurePrimary(figure) ? "primary" : "secondary";
        const name = legacyFigureDisplayNameClient(figure, locale);
        return (
          <Link
            key={figure.id}
            href={legacyFigureEntryHref(figure)}
            className={`figure-library-figure-link figure-library-figure-link--${variant}`}
            title={figure.linkedArticleSlug ? figure.articleTitle || figure.linkedArticleSlug : name}
          >
            {name}
            {!figure.linkedArticleSlug ? (
              <span className="figure-library-figure-flag" aria-hidden>
                ·
              </span>
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}

type TableRow =
  | { kind: "testament"; key: string; testament: "old" | "new" }
  | { kind: "book"; key: string; row: LegacyFigureTimelineBookRow };

function buildTableRows(bookRows: LegacyFigureTimelineBookRow[]): TableRow[] {
  const tableRows: TableRow[] = [];
  let lastTestament: "old" | "new" | null = null;
  for (const row of bookRows) {
    if (row.testament !== lastTestament) {
      tableRows.push({ kind: "testament", key: `testament-${row.testament}`, testament: row.testament });
      lastTestament = row.testament;
    }
    tableRows.push({ kind: "book", key: row.bookId, row });
  }
  return tableRows;
}

type Props = {
  bookRows: LegacyFigureTimelineBookRow[];
  locale: AppLocale;
  backHref?: string;
  backLabel?: string;
};

export function LegacyFiguresTimeline({
  bookRows,
  locale,
  backHref = "/explore",
  backLabel,
}: Props) {
  const messages = getMessages(locale);
  const explore = messages.pages.explore;
  const read = messages.pages.read;
  const resolvedBackLabel = backLabel ?? explore.figuresBackToExplore;
  const tableRows = buildTableRows(bookRows);

  return (
    <ExploreProsePage className="figure-library-page figure-parchment-page">
      {backHref ? (
        <Link href={backHref} className="explore-prose-back underline">
          {resolvedBackLabel}
        </Link>
      ) : null}

      <header className="explore-prose-header">
        <h1 className="explore-prose-title">{explore.figuresTitle}</h1>
        <p className="explore-prose-subtitle">{explore.figuresSubtitle}</p>
      </header>

      <div className="figure-library-timeline" aria-label={explore.figuresTitle}>
        {tableRows.map((entry, index) => {
          const showLine = index < tableRows.length - 1;

          if (entry.kind === "testament") {
            return (
              <div key={entry.key} className="figure-library-timeline-row figure-library-timeline-row--testament">
                <div className="figure-library-timeline-marker" aria-hidden="true">
                  <span className="figure-library-timeline-dot figure-library-timeline-dot--testament" />
                  {showLine ? <span className="figure-library-timeline-line" /> : null}
                </div>
                <div className="figure-library-timeline-body">
                  <p className="figure-library-testament-label">
                    {entry.testament === "old" ? read.catalogTestamentOld : read.catalogTestamentNew}
                  </p>
                </div>
              </div>
            );
          }

          return (
            <article key={entry.key} className="figure-library-timeline-row">
              <div className="figure-library-timeline-marker" aria-hidden="true">
                <span className="figure-library-timeline-dot" />
                {showLine ? <span className="figure-library-timeline-line" /> : null}
              </div>
              <div className="figure-library-timeline-body">
                <header className="figure-library-book-header">
                  <div className="figure-library-book-heading">
                    <span className="figure-library-book-order">{entry.row.bookNumber}</span>
                    <span className="figure-library-book-name">
                      {localizeBookName(entry.row.bookId, locale)}
                    </span>
                  </div>
                  {entry.row.eraAria && locale !== "en" ? (
                    <p className="figure-library-book-era">
                      {locale === "zh-TW" ? toZhTwText(entry.row.eraAria) : entry.row.eraAria}
                    </p>
                  ) : null}
                </header>
                <div className="figure-library-book-figures">
                  <BookFiguresCell figures={entry.row.figures} locale={locale} />
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </ExploreProsePage>
  );
}
