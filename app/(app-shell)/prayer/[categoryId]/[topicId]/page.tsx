import Link from "next/link";
import { notFound } from "next/navigation";
import { PrayerBreadcrumb } from "@/components/prayer/PrayerBreadcrumb";
import { PrayerPageFrame } from "@/components/prayer/PrayerPageFrame";
import { PrayerThemeTags } from "@/components/prayer/PrayerThemeTags";
import { PrayerVersePassage } from "@/components/prayer/PrayerVersePassage";
import { ScriptureChrome } from "@/components/scripture/ScriptureChrome";
import { buildTopicOpeningLine, getTopicPrayerCategory, getTopicPrayerTopic } from "@/lib/prayer/read-topic-prayer-library";
import { pickPrayerDisplayTranslationId } from "@/lib/prayer/prayer-translation-id";
import { resolveTopicPrayerTopicFromSelah } from "@/lib/prayer/resolve-topic-prayer-from-selah-bible";
import { sitePageTitle, sitePageTitleWithSuffix } from "@/lib/site-metadata-defaults";

type Props = { params: Promise<{ categoryId: string; topicId: string }> };

export const revalidate = 600;

export async function generateMetadata({ params }: Props) {
  const { categoryId, topicId } = await params;
  const cwd = process.cwd();
  const topic = getTopicPrayerTopic(cwd, categoryId, topicId);
  return { title: topic ? sitePageTitleWithSuffix([topic.title, "祷告"]) : sitePageTitle("祷告") };
}

export default async function PrayerTopicPage({ params }: Props) {
  const { categoryId, topicId } = await params;
  const cwd = process.cwd();
  const tid = pickPrayerDisplayTranslationId(cwd);
  const raw = getTopicPrayerTopic(cwd, categoryId, topicId);
  if (!raw) notFound();
  const category = getTopicPrayerCategory(cwd, categoryId);
  const topic = await resolveTopicPrayerTopicFromSelah(cwd, raw, tid);
  const lead = topic.summary?.trim() || buildTopicOpeningLine(topic);

  const crumbs = [
    { href: "/", label: "首页" },
    { href: "/prayer", label: "祷告" },
    { href: `/prayer/${categoryId}`, label: category?.title ?? "分类" },
  ];

  return (
    <ScriptureChrome>
      <PrayerPageFrame>
        <PrayerBreadcrumb items={crumbs} />

        <header className="prayer-rule-b mt-6 max-w-prose pb-10">
          <p className="prayer-eyebrow">祷告方向</p>
          <h1 className="prayer-heading mt-2">{topic.title}</h1>
          <p className="prayer-lead mt-4">{lead}</p>
          <div className="mt-5">
            <PrayerThemeTags tags={topic.themeTags} />
          </div>
        </header>

        <section className="mt-10 max-w-prose">
          <div className="prayer-rule-b flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 pb-3">
            <h2 className="prayer-heading-sm">参考经文</h2>
            <span className="prayer-muted text-[0.8em] tabular-nums">共 {topic.verses.length} 段</span>
          </div>

          {topic.verses.length === 0 ? (
            <p className="prayer-muted mt-8 text-[0.88em]">此主题暂无经文条目。</p>
          ) : (
            <div className="mt-2">
              {topic.verses.map((verse, index) => (
                <PrayerVersePassage
                  key={verse.id}
                  variant="full"
                  index={index}
                  reference={verse.reference}
                  book={verse.book}
                  chapterStart={verse.chapterStart}
                  text={verse.text}
                  prayerPrompt={verse.prayerPrompt}
                />
              ))}
            </div>
          )}
        </section>

        <footer className="prayer-muted prayer-rule-t mt-14 max-w-prose pt-8 text-[0.82em] leading-relaxed">
          <p>
            <Link href={`/prayer/${categoryId}`} className="prayer-link font-medium">
              ← {category?.title ?? "返回分类"}
            </Link>
            <span className="mx-2 opacity-40">·</span>
            <Link href="/prayer" className="prayer-link font-medium">
              祷告首页
            </Link>
          </p>
        </footer>
      </PrayerPageFrame>
    </ScriptureChrome>
  );
}
