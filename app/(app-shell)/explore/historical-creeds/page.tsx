import { ExploreHistoricalCreedsContent } from "@/components/explore/ExploreHistoricalCreedsContent";
import { ExploreParchmentChrome } from "@/components/explore/ExploreParchmentChrome";
import { sitePageTitle } from "@/lib/site-metadata-defaults";

export const metadata = {
  title: sitePageTitle("历代信经"),
  description: "按年代看教会如何陈述信仰：使徒信经、尼西亚信经与改教告白。",
};

export default function ExploreHistoricalCreedsPage() {
  return (
    <ExploreParchmentChrome>
      <ExploreHistoricalCreedsContent />
    </ExploreParchmentChrome>
  );
}
