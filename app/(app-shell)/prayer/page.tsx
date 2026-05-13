import Link from "next/link";
import { CATEGORY_DESC, PrayerTopicsCategoryList, PrayerTopicsGuideIntro } from "@/components/prayer/PrayerTopicsIndex";
import { PrayerPageFrame } from "@/components/prayer/PrayerPageFrame";
import { PrayerBreadcrumb } from "@/components/prayer/PrayerBreadcrumb";
import { ShellTemplateChromeLayout } from "@/components/shell/ShellTemplateChromeLayout";
import { readTopicPrayerLibrarySync } from "@/lib/prayer/read-topic-prayer-library";
import { resolveTopicPrayerLibraryJsonPath } from "@/lib/prayer/topic-prayer-library-path";

export const metadata = {
  title: "祷告 · Selah.my",
  description: "以经文为起点的安静祷告入口：方向、主题与可读译本正文。",
};

export const revalidate = 600;

export default function PrayerIndexPage() {
  const cwd = process.cwd();
  const jsonPath = resolveTopicPrayerLibraryJsonPath(cwd);
  const lib = readTopicPrayerLibrarySync(cwd);
  const categories = lib.categories;

  return (
    <ShellTemplateChromeLayout contentClassName="gap-0">
      <PrayerPageFrame>
        <header className="max-w-prose border-b border-ink/10 pb-10">
          <PrayerBreadcrumb items={[{ href: "/", label: "首页" }]} />
          <p className="mt-6 text-[11px] font-medium uppercase tracking-[0.14em] text-muted">祷告</p>
          <h1 className="mt-2 font-serif text-[1.55rem] font-medium tracking-tight text-ink/90 sm:text-[1.65rem]">祷告与经文</h1>
        </header>

        <div className="mt-12 space-y-0">
          <PrayerTopicsGuideIntro />

          {!jsonPath || categories.length === 0 ? (
            <section className="mt-12 border-l-2 border-amber-500/55 pl-4 text-[14px] leading-relaxed text-ink/80 dark:border-amber-600/50">
              <p className="font-medium text-ink/90">尚未载入主题库</p>
              <p className="mt-2 text-[13px] leading-relaxed text-ink/75">
                请将 <code className="font-mono text-[12px] text-ink/85">topic_prayer_library.json</code> 放在{" "}
                <code className="font-mono text-[12px] text-ink/85">data/prayer/</code>，或设置{" "}
                <code className="font-mono text-[12px] text-ink/85">ASKBIBLE_REPO</code> 指向旧站仓库后再试。
              </p>
            </section>
          ) : (
            <div className="mt-14">
              <PrayerTopicsCategoryList categories={categories} />
            </div>
          )}
        </div>

        {categories.length > 0 ? (
          <nav className="mt-16 border-t border-ink/10 pt-10" aria-labelledby="prayer-index-toc">
            <h2 id="prayer-index-toc" className="font-serif text-[1.12rem] font-medium text-ink/88">
              按处境浏览
            </h2>
            <p className="mt-2 max-w-prose text-[13px] leading-relaxed text-muted">以下链到各方向下的主题与经文预览。</p>
            <ol className="mt-8 list-none divide-y divide-ink/10 border-t border-ink/10 p-0">
              {categories.map((c) => {
                const blurb = CATEGORY_DESC[c.id];
                return (
                  <li key={c.id}>
                    <Link href={`/prayer/${c.id}`} className="group block py-5 first:pt-4">
                      <span className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                        <span className="font-serif text-[1.08rem] font-medium text-ink/90 group-hover:text-ink">{c.title}</span>
                        <span className="shrink-0 text-[12px] tabular-nums text-muted">{c.topics.length} 个主题</span>
                      </span>
                      {blurb ? <p className="mt-2 max-w-prose text-[13px] leading-relaxed text-ink/68">{blurb}</p> : null}
                    </Link>
                  </li>
                );
              })}
            </ol>
          </nav>
        ) : null}
      </PrayerPageFrame>
    </ShellTemplateChromeLayout>
  );
}
