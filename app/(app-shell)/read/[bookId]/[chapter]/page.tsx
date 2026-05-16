import { notFound } from "next/navigation";
import { ReadChapterEndNav } from "@/components/bible/ReadChapterEndNav";
import { ReadChapterTodayPlanBlock } from "@/components/bible/ReadChapterTodayPlanBlock";
import { ReadChapterNav } from "@/components/bible/ReadChapterNav";
import { ReadChapterVersesClient } from "@/components/bible/ReadChapterVersesClient";
import { ReadBibleTypographySettingsControl } from "@/components/bible/ReadBibleTypographySettingsControl";
import { ShellTemplateChromeLayout } from "@/components/shell/ShellTemplateChromeLayout";
import { loadChapterFromDefaultTranslation } from "@/lib/bible/load-chapter-from-default-translation";
import { resolveReadChapterNeighbors } from "@/lib/bible/read-chapter-neighbors";
import { PRAYER_SHELL_FILL_LIGHT } from "@/lib/prayer/prayer-shell-fill";
import { sitePageTitle } from "@/lib/site-metadata-defaults";
import "../../read-chapter-surfaces.css";

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

  return (
    <ShellTemplateChromeLayout
      contentClassName="gap-0"
      appShellBackground={PRAYER_SHELL_FILL_LIGHT}
      immersive
      topBarRightAccessory={<ReadBibleTypographySettingsControl />}
    >
      <div className="read-bible-parchment-shell flex-1 text-amber-950 dark:text-stone-50">
        <div className="read-bible-parchment-scroll">
          <div className="read-bible-parchment-column read-bible-typography">
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
              <ReadChapterVersesClient
                translationId={data.translationId}
                bookId={data.bookId}
                bookName={data.bookName}
                chapter={data.chapter}
                verses={data.verses}
              />
              <ReadChapterTodayPlanBlock bookId={data.bookId} chapter={data.chapter} />
              <ReadChapterEndNav bookName={data.bookName} chapter={data.chapter} prev={prev} next={next} />
            </article>
          </div>
        </div>
      </div>
    </ShellTemplateChromeLayout>
  );
}
