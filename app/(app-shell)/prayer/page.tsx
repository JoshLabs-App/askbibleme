import Link from "next/link";
import { CATEGORY_DESC, PrayerTopicsCategoryList } from "@/components/prayer/PrayerTopicsIndex";
import { PrayerHomeFirstScreen } from "@/components/prayer/PrayerHomeFirstScreen";
import { PrayerPageFrame } from "@/components/prayer/PrayerPageFrame";
import { ShellTemplateChromeLayout } from "@/components/shell/ShellTemplateChromeLayout";
import { readTopicPrayerLibrarySync } from "@/lib/prayer/read-topic-prayer-library";
import { PRAYER_SHELL_FILL_LIGHT } from "@/lib/prayer/prayer-shell-fill";
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
    <ShellTemplateChromeLayout
      contentClassName="gap-0"
      suppressEdgeScrim
      appShellBackground={PRAYER_SHELL_FILL_LIGHT}
    >
      <PrayerPageFrame>
        <div className="space-y-0">
          <PrayerHomeFirstScreen />

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
          <nav className="mt-16 border-t border-amber-200/45 pt-10 dark:border-stone-700/50" aria-labelledby="prayer-index-toc">
            <h2 id="prayer-index-toc" className="font-serif text-[1.12rem] font-medium text-ink/88">
              按处境浏览
            </h2>
            <p className="mt-2 max-w-prose text-[13px] leading-relaxed text-muted">以下链到各方向下的主题与经文预览。</p>
            <ol className="mt-8 list-none divide-y divide-amber-200/40 border-t border-amber-200/40 p-0 dark:divide-stone-700/50 dark:border-stone-700/50">
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
