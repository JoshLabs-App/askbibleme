import { ExploreHomeContent } from "@/components/explore/ExploreHomeContent";
import { ExploreParchmentChrome } from "@/components/explore/ExploreParchmentChrome";
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

  return (
    <ExploreParchmentChrome>
      <ExploreHomeContent exploreModulesBundle={exploreModulesBundle} />
    </ExploreParchmentChrome>
  );
}
