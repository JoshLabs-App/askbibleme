import Link from "next/link";
import { notFound } from "next/navigation";
import { PrayerBreadcrumb } from "@/components/prayer/PrayerBreadcrumb";
import { PrayerPageFrame } from "@/components/prayer/PrayerPageFrame";
import { PrayerThemeTags } from "@/components/prayer/PrayerThemeTags";
import { PrayerVersePassage } from "@/components/prayer/PrayerVersePassage";
import { ShellTemplateChromeLayout } from "@/components/shell/ShellTemplateChromeLayout";
import {
  buildTopicOpeningLine,
  getRelatedTopicsForCategory,
  getTopicPrayerCategory,
} from "@/lib/prayer/read-topic-prayer-library";
import { pickPrayerDisplayTranslationId } from "@/lib/prayer/prayer-translation-id";
import { resolveTopicPrayerTopicHeadVerses } from "@/lib/prayer/resolve-topic-prayer-from-selah-bible";

type Props = { params: Promise<{ categoryId: string }> };

export const revalidate = 600;

export async function generateMetadata({ params }: Props) {
  const { categoryId } = await params;
  const cwd = process.cwd();
  const cat = getTopicPrayerCategory(cwd, categoryId);
  return { title: cat ? `${cat.title} · 祷告 · Selah.my` : "祷告" };
}

export default async function PrayerCategoryPage({ params }: Props) {
  const { categoryId } = await params;
  const cwd = process.cwd();
  const tid = pickPrayerDisplayTranslationId(cwd);
  const raw = getTopicPrayerCategory(cwd, categoryId);
  if (!raw) notFound();
  const resolved = {
    ...raw,
    topics: raw.topics.map((t) => resolveTopicPrayerTopicHeadVerses(cwd, t, tid, 3)),
  };
  const related = getRelatedTopicsForCategory(cwd, categoryId, 6);

  return (
    <ShellTemplateChromeLayout contentClassName="gap-0">
      <PrayerPageFrame>
        <PrayerBreadcrumb items={[{ href: "/", label: "首页" }, { href: "/prayer", label: "祷告" }]} />

        <header className="mt-6 max-w-prose border-b border-ink/10 pb-10">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">{resolved.topics.length} 个方向</p>
          <h1 className="mt-2 font-serif text-[1.5rem] font-medium tracking-tight text-ink/90 sm:text-[1.58rem]">{resolved.title}</h1>
          <p className="mt-4 text-[15px] leading-[1.75] text-ink/76">{resolved.description}</p>
          <p className="mt-6">
            <Link
              href="/prayer"
              className="text-[13px] font-medium text-ink/75 underline decoration-ink/22 underline-offset-[0.2em] transition hover:text-ink hover:decoration-ink/40"
            >
              ← 返回祷告首页
            </Link>
          </p>
        </header>

        <div className="divide-y divide-ink/10">
          {resolved.topics.map((topic) => (
            <article key={topic.id} id={topic.id} className="scroll-mt-6 py-12 first:pt-10">
              <header className="max-w-prose">
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">祷告方向</p>
                <h2 className="mt-2 font-serif text-[1.2rem] font-medium text-ink/90">{topic.title}</h2>
                <p className="mt-3 text-[15px] leading-[1.75] text-ink/74">{topic.summary || buildTopicOpeningLine(topic)}</p>
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
                <Link
                  href={`/prayer/${categoryId}/${topic.id}`}
                  className="text-[14px] font-medium text-ink/80 underline decoration-ink/25 underline-offset-[0.22em] transition hover:decoration-ink/45"
                >
                  查看全部参考经文 →
                </Link>
              </p>
            </article>
          ))}
        </div>

        {related.length ? (
          <section className="mt-4 border-t border-ink/10 pt-12">
            <h2 className="font-serif text-[1.08rem] font-medium text-ink/88">相近方向</h2>
            <p className="mt-2 max-w-prose text-[13px] leading-relaxed text-muted">若还想继续祷告，可从这些相近主题再展开。</p>
            <ul className="mt-8 max-w-prose list-none divide-y divide-ink/10 border-t border-ink/10 p-0">
              {related.map((entry) => (
                <li key={`${entry.categoryId}-${entry.topic.id}`}>
                  <Link href={`/prayer/${entry.categoryId}#${entry.topic.id}`} className="group block py-4 first:pt-3">
                    <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted">{entry.categoryTitle}</span>
                    <span className="mt-1 block font-serif text-[1.02rem] font-medium text-ink/88 group-hover:text-ink/95">
                      {entry.topic.title}
                    </span>
                    <span className="mt-2 block text-[13px] leading-relaxed text-ink/65 line-clamp-2">
                      {entry.topic.summary || buildTopicOpeningLine(entry.topic)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </PrayerPageFrame>
    </ShellTemplateChromeLayout>
  );
}
