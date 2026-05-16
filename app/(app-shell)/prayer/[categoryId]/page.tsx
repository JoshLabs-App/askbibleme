import Link from "next/link";
import { notFound } from "next/navigation";
import { PrayerBreadcrumb } from "@/components/prayer/PrayerBreadcrumb";
import { PrayerPageFrame } from "@/components/prayer/PrayerPageFrame";
import { PrayerThemeTags } from "@/components/prayer/PrayerThemeTags";
import { PrayerVersePassage } from "@/components/prayer/PrayerVersePassage";
import { ScriptureChrome } from "@/components/scripture/ScriptureChrome";
import {
  buildTopicOpeningLine,
  getRelatedTopicsForCategory,
  getTopicPrayerCategory,
} from "@/lib/prayer/read-topic-prayer-library";
import { pickPrayerDisplayTranslationId } from "@/lib/prayer/prayer-translation-id";
import { resolveTopicPrayerTopicHeadVerses } from "@/lib/prayer/resolve-topic-prayer-from-selah-bible";
import { sitePageTitle, sitePageTitleWithSuffix } from "@/lib/site-metadata-defaults";

type Props = { params: Promise<{ categoryId: string }> };

export const revalidate = 600;

export async function generateMetadata({ params }: Props) {
  const { categoryId } = await params;
  const cwd = process.cwd();
  const cat = getTopicPrayerCategory(cwd, categoryId);
  return { title: cat ? sitePageTitleWithSuffix([cat.title, "祷告"]) : sitePageTitle("祷告") };
}

export default async function PrayerCategoryPage({ params }: Props) {
  const { categoryId } = await params;
  const cwd = process.cwd();
  const tid = pickPrayerDisplayTranslationId(cwd);
  const raw = getTopicPrayerCategory(cwd, categoryId);
  if (!raw) notFound();
  const resolved = {
    ...raw,
    topics: await Promise.all(raw.topics.map((t) => resolveTopicPrayerTopicHeadVerses(cwd, t, tid, 3))),
  };
  const related = getRelatedTopicsForCategory(cwd, categoryId, 6);

  return (
    <ScriptureChrome>
      <PrayerPageFrame>
        <PrayerBreadcrumb items={[{ href: "/", label: "首页" }, { href: "/prayer", label: "祷告" }]} />

        <header className="prayer-rule-b mt-6 max-w-prose pb-10">
          <p className="prayer-eyebrow">{resolved.topics.length} 个方向</p>
          <h1 className="prayer-heading mt-2">{resolved.title}</h1>
          <p className="prayer-lead mt-4">{resolved.description}</p>
          <p className="mt-6">
            <Link href="/prayer" className="prayer-link text-[0.82em] font-medium">
              ← 返回祷告首页
            </Link>
          </p>
        </header>

        <div className="prayer-divide-y">
          {resolved.topics.map((topic) => (
            <article key={topic.id} id={topic.id} className="scroll-mt-6 py-12 first:pt-10">
              <header className="max-w-prose">
                <p className="prayer-eyebrow">祷告方向</p>
                <h2 className="prayer-heading-sm mt-2">{topic.title}</h2>
                <p className="prayer-lead mt-3">{topic.summary || buildTopicOpeningLine(topic)}</p>
                <div className="mt-4">
                  <PrayerThemeTags tags={topic.themeTags} />
                </div>
              </header>

              <div className="mt-8 max-w-prose space-y-6">
                {topic.verses.map((verse) => (
                  <PrayerVersePassage
                    key={verse.id}
                    variant="preview"
                    reference={verse.reference}
                    book={verse.book}
                    chapterStart={verse.chapterStart}
                    text={verse.text}
                    prayerPrompt={verse.prayerPrompt}
                  />
                ))}
              </div>

              <p className="mt-8">
                <Link href={`/prayer/${categoryId}/${topic.id}`} className="prayer-link text-[0.88em] font-medium">
                  查看全部参考经文 →
                </Link>
              </p>
            </article>
          ))}
        </div>

        {related.length ? (
          <section className="prayer-rule-t mt-4 pt-12">
            <h2 className="prayer-heading-sm">相近方向</h2>
            <p className="prayer-muted mt-2 max-w-prose text-[0.82em] leading-relaxed">
              若还想继续祷告，可从这些相近主题再展开。
            </p>
            <ul className="prayer-divide-y prayer-rule-t mt-8 max-w-prose list-none p-0">
              {related.map((entry) => (
                <li key={`${entry.categoryId}-${entry.topic.id}`}>
                  <Link href={`/prayer/${entry.categoryId}#${entry.topic.id}`} className="group block py-4 first:pt-3">
                    <span className="prayer-eyebrow text-[0.95em]">{entry.categoryTitle}</span>
                    <span className="prayer-heading-sm mt-1 block group-hover:opacity-95">{entry.topic.title}</span>
                    <span className="prayer-muted mt-2 block text-[0.82em] leading-relaxed line-clamp-2">
                      {entry.topic.summary || buildTopicOpeningLine(entry.topic)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </PrayerPageFrame>
    </ScriptureChrome>
  );
}
