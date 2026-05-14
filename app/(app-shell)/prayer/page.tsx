import { PrayerTopicsCategoryList } from "@/components/prayer/PrayerTopicsIndex";
import { PrayerHomeFirstScreen } from "@/components/prayer/PrayerHomeFirstScreen";
import { PrayerPageFrame } from "@/components/prayer/PrayerPageFrame";
import { ShellTemplateChromeLayout } from "@/components/shell/ShellTemplateChromeLayout";
import { readTopicPrayerLibrarySync } from "@/lib/prayer/read-topic-prayer-library";
import { PRAYER_SHELL_FILL_LIGHT } from "@/lib/prayer/prayer-shell-fill";
import { resolveTopicPrayerLibraryJsonPath } from "@/lib/prayer/topic-prayer-library-path";
import { sitePageTitle } from "@/lib/site-metadata-defaults";

export const metadata = {
  title: sitePageTitle("祷告"),
  description: "以经文为起点的安静祷告入口：方向、主题与可读译本正文。",
};

export const revalidate = 600;

export default function PrayerIndexPage() {
  const cwd = process.cwd();
  const jsonPath = resolveTopicPrayerLibraryJsonPath(cwd);
  const lib = readTopicPrayerLibrarySync(cwd);
  const categories = lib.categories;

  return (
    <ShellTemplateChromeLayout contentClassName="gap-0" appShellBackground={PRAYER_SHELL_FILL_LIGHT}>
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
      </PrayerPageFrame>
    </ShellTemplateChromeLayout>
  );
}
