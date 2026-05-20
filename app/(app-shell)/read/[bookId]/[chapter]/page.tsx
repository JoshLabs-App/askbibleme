import { notFound } from "next/navigation";
import { ReadChapterEndNav } from "@/components/bible/ReadChapterEndNav";
import { ReadChapterTodayPlanBlock } from "@/components/bible/ReadChapterTodayPlanBlock";
import { ReadChapterTripleLoopAdvance } from "@/components/bible/ReadChapterTripleLoopAdvance";
import { ReadChapterNav } from "@/components/bible/ReadChapterNav";
import { ReadChapterVersesClient } from "@/components/bible/ReadChapterVersesClient";
import { ReadChapterOfflineCacheEffects } from "@/components/pwa/ReadChapterOfflineCacheEffects";
import { ReadChapterOfflineNotice } from "@/components/pwa/ReadChapterOfflineNotice";
import { ScriptureChrome } from "@/components/scripture/ScriptureChrome";
import { loadReadChapterForReadPage } from "@/lib/read/load-read-chapter-for-read-page";
import { ReadChapterPostReadingEditions } from "@/components/bible/ReadChapterPostReadingEditions";
import {
  getInfoEditionReaderCacheAsync,
  resolveInfoEditionReaderTarget,
} from "@/lib/bible/info-edition-v1-reader-persistence";
import { parseScriptureVerseParam } from "@/lib/bible/parse-scripture-verse-param";
import { resolveReadChapterNeighbors } from "@/lib/bible/read-chapter-neighbors";
import { ReadChapterTelemetry } from "@/components/telemetry/ReadChapterTelemetry";
import { sitePageTitle } from "@/lib/site-metadata-defaults";

type Props = {
  params: Promise<{ bookId: string; chapter: string }>;
  searchParams: Promise<{ verse?: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { bookId, chapter } = await params;
  const loaded = await loadReadChapterForReadPage(bookId, Number(chapter));
  if (!loaded) return { title: sitePageTitle("经文") };
  const data = loaded.primary;
  return { title: sitePageTitle(`${data.bookName} ${data.chapter}`) };
}

export default async function ReadChapterPage({ params, searchParams }: Props) {
  const { bookId, chapter } = await params;
  const { verse: verseRaw } = await searchParams;
  const initialFocusVerse = parseScriptureVerseParam(verseRaw);
  const ch = Number(chapter);
  if (!Number.isFinite(ch)) notFound();
  const loaded = await loadReadChapterForReadPage(bookId, ch);
  if (!loaded) notFound();

  const data = loaded.primary;
  const contrast = loaded.contrast;

  const { prev, next } = resolveReadChapterNeighbors(data.bookId, data.chapter);

  const cwd = process.cwd();
  const infoTarget = resolveInfoEditionReaderTarget(cwd, { edition: "info" });
  const guideTarget = resolveInfoEditionReaderTarget(cwd, { edition: "guide" });
  const infoCache =
    "error" in infoTarget
      ? null
      : await getInfoEditionReaderCacheAsync(cwd, data.bookId, data.chapter, infoTarget);
  const guideCache =
    "error" in guideTarget
      ? null
      : await getInfoEditionReaderCacheAsync(cwd, data.bookId, data.chapter, guideTarget);
  const initialInfoPublished =
    infoCache?.status === "ready" && infoCache.published?.markdown.trim()
      ? infoCache.published
      : null;
  const initialGuidePublished =
    guideCache?.status === "ready" && guideCache.published?.markdown.trim()
      ? guideCache.published
      : null;

  return (
    <ScriptureChrome parchmentColumnClassName="read-bible-parchment-column--read-chapter">
      <ReadChapterTelemetry bookId={data.bookId} chapter={data.chapter} />
      <article className="read-chapter-article">
        <div className="read-chapter-spread">
          <div className="read-chapter-open-book">
            <div className="read-chapter-spread-scripture read-chapter-open-book-page read-chapter-open-book-page--left">
              <header className="read-chapter-header">
                <ReadChapterNav />
                <h1 className="read-chapter-title font-semibold tracking-tight text-amber-950 dark:text-stone-50">
                  {data.bookName}{" "}
                  <span className="tabular-nums text-[0.88em] font-semibold text-amber-900/88 dark:text-stone-200">
                    第 {data.chapter} 章
                  </span>
                </h1>
              </header>
              <div className="read-chapter-scripture">
                <ReadChapterOfflineNotice
                  translationId={data.translationId}
                  bookId={data.bookId}
                  chapter={data.chapter}
                />
                <ReadChapterOfflineCacheEffects
                  translationId={data.translationId}
                  bookId={data.bookId}
                  bookName={data.bookName}
                  chapter={data.chapter}
                  verses={data.verses}
                  contrastVerses={contrast?.verses ?? null}
                />
                <ReadChapterVersesClient
                  translationId={data.translationId}
                  bookId={data.bookId}
                  bookName={data.bookName}
                  chapter={data.chapter}
                  verses={data.verses}
                  contrastVerses={contrast?.verses ?? null}
                  initialFocusVerse={initialFocusVerse}
                />
              </div>
            </div>
            <div className="read-chapter-open-book-spine" aria-hidden="true" />
            <aside className="read-chapter-spread-editions read-chapter-open-book-page read-chapter-open-book-page--right">
              <ReadChapterPostReadingEditions
                bookId={data.bookId}
                chapter={data.chapter}
                initialInfoPublished={initialInfoPublished}
                initialGuidePublished={initialGuidePublished}
              />
            </aside>
          </div>
        </div>
        <div className="read-chapter-spread-after">
          <ReadChapterTodayPlanBlock bookId={data.bookId} chapter={data.chapter} />
          <ReadChapterTripleLoopAdvance bookId={data.bookId} chapter={data.chapter} />
          <ReadChapterEndNav
            bookId={data.bookId}
            bookName={data.bookName}
            chapter={data.chapter}
            prev={prev}
            next={next}
          />
        </div>
      </article>
    </ScriptureChrome>
  );
}
