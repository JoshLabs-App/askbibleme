import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ReadChapterLastPositionSync } from "@/components/bible/ReadChapterLastPositionSync";
import { ReadChapterTopActions } from "@/components/bible/ReadChapterTopActions";
import { ReadChapterEndNav } from "@/components/bible/ReadChapterEndNav";
import { ReadChapterPlanFlowSync } from "@/components/bible/ReadChapterPlanFlowSync";
import { ReadChapterCompletionSection } from "@/components/bible/ReadChapterCompletionSection";
import { ReadChapterTodayPlanBlock } from "@/components/bible/ReadChapterTodayPlanBlock";
import { ReadChapterVersesClient } from "@/components/bible/ReadChapterVersesClient";
import { ScriptureChrome } from "@/components/scripture/ScriptureChrome";
import { loadChapterXrefs } from "@/lib/bible/load-chapter-xrefs";
import { loadReadChapterForReadPage } from "@/lib/read/load-read-chapter-for-read-page";
import { ReadChapterPostReadingEditions } from "@/components/bible/ReadChapterPostReadingEditions";
import {
  getInfoEditionReaderCacheAsync,
  resolveInfoEditionReaderTarget,
} from "@/lib/bible/info-edition-v1-reader-persistence";
import { resolveReadChapterNeighbors } from "@/lib/bible/read-chapter-neighbors";
import { ReadChapterTelemetry } from "@/components/telemetry/ReadChapterTelemetry";
import { sitePageTitle } from "@/lib/site-metadata-defaults";
import { readTranslationsIndexSync } from "@/lib/bible/translations-store";
import {
  INFO_EDITION_GUIDE_V2_EN_ROLE_ID,
} from "@/lib/bible/info-edition-v1-publish";

const INFO_EDITION_V1_EN_ROLE_ID = "info_edition_v1_en";

type Props = { params: Promise<{ bookId: string; chapter: string }> };

export async function generateMetadata({ params }: Props) {
  const { bookId, chapter } = await params;
  const loaded = await loadReadChapterForReadPage(bookId, Number(chapter));
  if (!loaded) return { title: sitePageTitle("经文") };
  const data = loaded.primary;
  return { title: sitePageTitle(`${data.bookName} ${data.chapter}`) };
}

export default async function ReadChapterPage({ params }: Props) {
  const { bookId, chapter } = await params;
  const ch = Number(chapter);
  if (!Number.isFinite(ch)) notFound();
  const loaded = await loadReadChapterForReadPage(bookId, ch);
  if (!loaded) notFound();

  const data = loaded.primary;
  const contrasts = loaded.contrasts;

  const { prev, next } = resolveReadChapterNeighbors(data.bookId, data.chapter);

  const cwd = process.cwd();
  const translations = readTranslationsIndexSync(cwd);
  const primaryMeta = translations.translations.find((t) => t.id === data.translationId);
  const prefersEnglishEdition = /^en\b/i.test(primaryMeta?.language ?? "");

  const infoTarget = resolveInfoEditionReaderTarget(cwd, {
    edition: "info",
    roleId: prefersEnglishEdition ? INFO_EDITION_V1_EN_ROLE_ID : undefined,
  });
  const guideTarget = resolveInfoEditionReaderTarget(cwd, {
    edition: "guide",
    roleId: prefersEnglishEdition ? INFO_EDITION_GUIDE_V2_EN_ROLE_ID : undefined,
  });
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

  const chapterXrefs = await loadChapterXrefs(cwd, data.bookId, data.chapter);

  return (
    <ScriptureChrome parchmentColumnClassName="read-bible-parchment-column--read-chapter">
      <ReadChapterTopActions />
      <Suspense fallback={null}>
        <ReadChapterPlanFlowSync />
      </Suspense>
      <ReadChapterLastPositionSync bookId={data.bookId} chapter={data.chapter} bookName={data.bookName} />
      <ReadChapterTelemetry bookId={data.bookId} chapter={data.chapter} />
      <article className="read-chapter-article">
        <div className="read-chapter-spread">
          <div className="read-chapter-open-book">
            <div className="read-chapter-spread-scripture read-chapter-open-book-page read-chapter-open-book-page--left">
              <header className="read-chapter-header">
                <h1 className="read-chapter-title">
                  {data.bookName}{" "}
                  <span className="read-chapter-title-chapter tabular-nums">
                    第{data.chapter}章
                  </span>
                </h1>
              </header>
              <div className="read-chapter-scripture">
                <ReadChapterVersesClient
                  translationId={data.translationId}
                  bookId={data.bookId}
                  bookName={data.bookName}
                  chapter={data.chapter}
                  verses={data.verses}
                  segments={data.segments ?? null}
                  contrasts={contrasts.map((c) => ({
                    translationId: c.translationId,
                    verses: c.chapter.verses,
                  }))}
                  chapterXrefs={chapterXrefs}
                />
              </div>
              <div className="read-chapter-ending">
                <ReadChapterEndNav
                  bookId={data.bookId}
                  bookName={data.bookName}
                  chapter={data.chapter}
                  prev={prev}
                  next={next}
                />
                <ReadChapterCompletionSection bookId={data.bookId} chapter={data.chapter} />
              </div>
            </div>
            <div className="read-chapter-open-book-spine" aria-hidden="true" />
            <aside className="read-chapter-spread-editions read-chapter-open-book-page read-chapter-open-book-page--right">
              <ReadChapterPostReadingEditions
                bookId={data.bookId}
                chapter={data.chapter}
                initialInfoPublished={initialInfoPublished}
                initialGuidePublished={initialGuidePublished}
                infoRoleId={"error" in infoTarget ? null : infoTarget.roleId}
                guideRoleId={"error" in guideTarget ? null : guideTarget.roleId}
                prevChapterHref={prev ? `/read/${prev.bookId}/${prev.chapter}` : null}
                nextChapterHref={next ? `/read/${next.bookId}/${next.chapter}` : null}
              />
            </aside>
          </div>
        </div>
        <div className="read-chapter-spread-after read-chapter-spread-after--web-extras">
          <ReadChapterTodayPlanBlock bookId={data.bookId} chapter={data.chapter} />
        </div>
      </article>
    </ScriptureChrome>
  );
}
