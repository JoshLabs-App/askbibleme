import { ExploreBiblicalFeastsContent } from "@/components/explore/ExploreBiblicalFeastsContent";
import { ExploreParchmentChrome } from "@/components/explore/ExploreParchmentChrome";
import { sitePageTitle } from "@/lib/site-metadata-defaults";

export const metadata = {
  title: sitePageTitle("圣经节期"),
  description: "按圣经月份查看一年中的核心节期：逾越节到住棚节。",
};

export default function ExploreBiblicalFeastsPage() {
  return (
    <ExploreParchmentChrome proseScroll>
      <ExploreBiblicalFeastsContent />
    </ExploreParchmentChrome>
  );
}
