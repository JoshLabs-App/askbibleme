import { PrayerTopicsCategoryList } from "@/components/prayer/PrayerTopicsIndex";
import { PrayerHomeFirstScreen } from "@/components/prayer/PrayerHomeFirstScreen";
import { PrayerPageFrame } from "@/components/prayer/PrayerPageFrame";
import { ScriptureChrome } from "@/components/scripture/ScriptureChrome";
import { readTopicPrayerLibraryIndexSync } from "@/lib/prayer/topic-prayer-library-index";
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
  const categories = readTopicPrayerLibraryIndexSync(cwd);

  return (
    <ScriptureChrome scrollHome>
      <PrayerPageFrame>
        <div className="space-y-0">
          <PrayerHomeFirstScreen />

          {!jsonPath || categories.length === 0 ? (
            <section className="prayer-accent-l mt-12">
              <p className="prayer-heading-sm">尚未载入主题库</p>
              <p className="prayer-lead mt-2 text-[0.88em]">
                请将 <code className="font-mono text-[0.95em]">topic_prayer_library.json</code> 放在{" "}
                <code className="font-mono text-[0.95em]">data/prayer/</code>，或设置{" "}
                <code className="font-mono text-[0.95em]">ASKBIBLE_REPO</code> 指向旧站仓库后再试。
              </p>
            </section>
          ) : (
            <div className="mt-14">
              <PrayerTopicsCategoryList categories={categories} />
            </div>
          )}
        </div>
      </PrayerPageFrame>
    </ScriptureChrome>
  );
}
