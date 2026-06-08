import { ExploreEncouragingWordsContent } from "@/components/explore/ExploreEncouragingWordsContent";
import { ExploreParchmentChrome } from "@/components/explore/ExploreParchmentChrome";
import { sitePageTitle } from "@/lib/site-metadata-defaults";

export const metadata = {
  title: sitePageTitle("鼓励的话"),
  description: "Calm 风格 · 100 句适合非信徒接受的圣经金句。",
};

export default function ExploreEncouragingWordsPage() {
  return (
    <ExploreParchmentChrome proseScroll>
      <ExploreEncouragingWordsContent />
    </ExploreParchmentChrome>
  );
}
