import Link from "next/link";
import { notFound } from "next/navigation";
import { PrayerBreadcrumb } from "@/components/prayer/PrayerBreadcrumb";
import { PrayerPageFrame } from "@/components/prayer/PrayerPageFrame";
import { PrayerThemeTags } from "@/components/prayer/PrayerThemeTags";
import { PrayerVersePassage } from "@/components/prayer/PrayerVersePassage";
import { ShellTemplateChromeLayout } from "@/components/shell/ShellTemplateChromeLayout";
import { buildTopicOpeningLine, getTopicPrayerCategory, getTopicPrayerTopic } from "@/lib/prayer/read-topic-prayer-library";
import { pickPrayerDisplayTranslationId } from "@/lib/prayer/prayer-translation-id";
import { PRAYER_SHELL_FILL_LIGHT } from "@/lib/prayer/prayer-shell-fill";
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
  const topic = resolveTopicPrayerTopicFromSelah(cwd, raw, tid);
  const lead = topic.summary?.trim() || buildTopicOpeningLine(topic);

  const crumbs = [
    { href: "/", label: "首页" },
    { href: "/prayer", label: "祷告" },
    { href: `/prayer/${categoryId}`, label: category?.title ?? "分类" },
  ];

  return (
    <ShellTemplateChromeLayout contentClassName="gap-0" appShellBackground={PRAYER_SHELL_FILL_LIGHT}>
      <PrayerPageFrame>
        <PrayerBreadcrumb items={crumbs} />

        <header className="mt-6 max-w-prose border-b border-ink/10 pb-10">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">祷告方向</p>
          <h1 className="mt-2 font-serif text-[1.42rem] font-medium tracking-tight text-ink/90 sm:text-[1.52rem]">{topic.title}</h1>
          <p className="mt-4 text-[15px] leading-[1.75] text-ink/76">{lead}</p>
          <div className="mt-5">
            <PrayerThemeTags tags={topic.themeTags} />
          </div>
        </header>

        <section className="mt-10 max-w-prose">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-ink/10 pb-3">
            <h2 className="font-serif text-[1.08rem] font-medium text-ink/88">参考经文</h2>
            <span className="text-[12px] tabular-nums text-muted">共 {topic.verses.length} 段</span>
          </div>

          {topic.verses.length === 0 ? (
            <p className="mt-8 text-[14px] text-muted">此主题暂无经文条目。</p>
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

        <footer className="mt-14 max-w-prose border-t border-ink/10 pt-8 text-[13px] leading-relaxed text-muted">
          <p>
            <Link
              href={`/prayer/${categoryId}`}
              className="font-medium text-ink/78 underline decoration-ink/22 underline-offset-[0.2em] transition hover:text-ink hover:decoration-ink/40"
            >
              ← {category?.title ?? "返回分类"}
            </Link>
            <span className="mx-2 text-ink/25">·</span>
            <Link
              href="/prayer"
              className="font-medium text-ink/78 underline decoration-ink/22 underline-offset-[0.2em] transition hover:text-ink hover:decoration-ink/40"
            >
              祷告首页
            </Link>
          </p>
        </footer>
      </PrayerPageFrame>
    </ShellTemplateChromeLayout>
  );
}
