import { notFound } from "next/navigation";
import { ReadChapterEndNav } from "@/components/bible/ReadChapterEndNav";
import { ReadChapterTodayPlanBlock } from "@/components/bible/ReadChapterTodayPlanBlock";
import { ReadChapterNav } from "@/components/bible/ReadChapterNav";
import { ReadChapterVersesClient } from "@/components/bible/ReadChapterVersesClient";
import { ScriptureChrome } from "@/components/scripture/ScriptureChrome";
import { loadChapterFromDefaultTranslation } from "@/lib/bible/load-chapter-from-default-translation";
import { loadPublishedInfoEditionChapter } from "@/lib/bible/info-edition-v1-published-store";
import { ReadChapterInfoEditionBlock } from "@/components/bible/ReadChapterInfoEditionBlock";
import { resolveReadChapterNeighbors } from "@/lib/bible/read-chapter-neighbors";
import { sitePageTitle } from "@/lib/site-metadata-defaults";

type Props = { params: Promise<{ bookId: string; chapter: string }> };

export async function generateMetadata({ params }: Props) {
  const { bookId, chapter } = await params;
  const data = await loadChapterFromDefaultTranslation(bookId, Number(chapter));
  if (!data) return { title: sitePageTitle("经文") };
  return { title: sitePageTitle(`${data.bookName} ${data.chapter}`) };
}

export default async function ReadChapterPage({ params }: Props) {
  const { bookId, chapter } = await params;
  const ch = Number(chapter);
  if (!Number.isFinite(ch)) notFound();
  const data = await loadChapterFromDefaultTranslation(bookId, ch);
  if (!data) notFound();

  const { prev, next } = resolveReadChapterNeighbors(data.bookId, data.chapter);
  const infoEdition = loadPublishedInfoEditionChapter(process.cwd(), data.bookId, data.chapter);

  return (
    <ScriptureChrome>
      <header className="read-chapter-header">
        <ReadChapterNav />
        <h1 className="read-chapter-title mt-3 text-balance font-semibold tracking-tight text-amber-950 dark:text-stone-50">
          {data.bookName}{" "}
          <span className="tabular-nums text-[0.88em] font-semibold text-amber-900/88 dark:text-stone-200">
            第 {data.chapter} 章
          </span>
        </h1>
      </header>
      <article className="read-chapter-article">
        <div className="read-chapter-scripture">
          <ReadChapterVersesClient
            translationId={data.translationId}
            bookId={data.bookId}
            bookName={data.bookName}
            chapter={data.chapter}
            verses={data.verses}
          />
        </div>
        {infoEdition ? <ReadChapterInfoEditionBlock published={infoEdition} /> : null}
        <ReadChapterTodayPlanBlock bookId={data.bookId} chapter={data.chapter} />
        <ReadChapterEndNav bookName={data.bookName} chapter={data.chapter} prev={prev} next={next} />
      </article>
    </ScriptureChrome>
  );
}
