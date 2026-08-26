import { cookies, headers } from "next/headers";
import { ExploreHomeContent } from "@/components/explore/ExploreHomeContent";
import { ExploreParchmentChrome } from "@/components/explore/ExploreParchmentChrome";
import { readExploreFeaturedArticles } from "@/lib/explore/explore-featured-articles";
import { readExploreModulesBundleSync } from "@/lib/explore/explore-modules-bundle-store";
import { resolveRequestLocale } from "@/lib/i18n/request-locale";
import { sitePageTitle } from "@/lib/site-metadata-defaults";

export const metadata = {
  title: sitePageTitle("探索"),
  description: "更多小惊喜正在路上；也可从这儿打开祷告与经文。",
};

export default async function ExplorePage() {
  const cookieStore = await cookies();
  const headerList = await headers();
  const locale = resolveRequestLocale(cookieStore, headerList.get("accept-language"));
  const featuredArticles = readExploreFeaturedArticles(locale);
  const exploreModulesBundle =
    readExploreModulesBundleSync(process.cwd()) ??
    ({
      schemaVersion: 1,
      contentVersion: "",
      prayer: { bookAbbrToId: {}, scenarios: [] },
      narrowGate: { bookAbbrToId: {}, categories: [] },
      praiseWorship: { bookAbbrToId: {}, categories: [] },
      wordOfGod: { bookAbbrToId: {}, categories: [] },
      yearsDaysEternity: { zh: { pageTitle: "", intro: [], sections: [], closing: [] }, en: { pageTitle: "", intro: [], sections: [], closing: [] } },
      yearDayCount: { leadRef: { id: "", bookId: "", chapter: 0, verseStart: 0 }, scriptures: [] },
      biblicalLifespans: { scaleYears: 1000, ntScaleYears: 100, modernEra: "", era: {}, lifespans: [] },
      centuryTimeline: { spanYears: 90, batterySegmentCount: 5 },
      exploreHome: { visibleStagedEntryIds: [] },
    } satisfies import("@/lib/explore/explore-modules-bundle-types").ExploreModulesBundle);

  return (
    <ExploreParchmentChrome>
      <ExploreHomeContent featuredArticles={featuredArticles} exploreModulesBundle={exploreModulesBundle} />
    </ExploreParchmentChrome>
  );
}
