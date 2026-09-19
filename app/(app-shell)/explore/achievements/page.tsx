import { AchievementsView } from "@/components/achievements/AchievementsView";
import { ExploreParchmentChrome } from "@/components/explore/ExploreParchmentChrome";
import { sitePageTitle } from "@/lib/site-metadata-defaults";

export const metadata = {
  title: sitePageTitle("成就"),
  description: "勋章、书卷印章与等级：看得见的读经积累。",
};

export default function AchievementsPage() {
  return (
    <ExploreParchmentChrome>
      <AchievementsView />
    </ExploreParchmentChrome>
  );
}
