import { ExploreHomeContent } from "@/components/explore/ExploreHomeContent";
import { ExploreParchmentChrome } from "@/components/explore/ExploreParchmentChrome";
import { readExploreFeaturedArticles } from "@/lib/explore/explore-featured-articles";
import { EMPTY_EXPLORE_MODULES_BUNDLE } from "@/lib/explore/explore-modules-bundle-types";
import { readExploreModulesBundleSync } from "@/lib/explore/explore-modules-bundle-store";
import { sitePageTitle } from "@/lib/site-metadata-defaults";

export const metadata = {
  title: sitePageTitle("探索"),
  description: "更多小惊喜正在路上；也可从这儿打开祷告与经文。",
};

export default async function ExplorePage() {
  const exploreModulesBundle =
    readExploreModulesBundleSync(process.cwd()) ?? EMPTY_EXPLORE_MODULES_BUNDLE;
  /**
   * 一次算齐三种语言交给客户端选，页面因此不必读请求语言、可静态生成。
   * 在服务端算而不是让客户端自己调：那份 bundle 有 149KB，从客户端组件引用会被整份
   * 打进 chunk，把 next build 推爆堆上限。
   */
  const featuredByLocale = {
    "zh-CN": readExploreFeaturedArticles("zh-CN"),
    "zh-TW": readExploreFeaturedArticles("zh-TW"),
    en: readExploreFeaturedArticles("en"),
  };

  return (
    <ExploreParchmentChrome>
      <ExploreHomeContent
        exploreModulesBundle={exploreModulesBundle}
        featuredByLocale={featuredByLocale}
      />
    </ExploreParchmentChrome>
  );
}
