import { ExploreParchmentChrome } from "@/components/explore/ExploreParchmentChrome";
import { BiblePanoramaClient } from "@/components/panorama/BiblePanoramaClient";
import { sitePageTitle } from "@/lib/site-metadata-defaults";

export const metadata = {
  title: sitePageTitle("救赎全景"),
  description: "在完整的救赎故事中安静灵修，看见今天所读经文的位置。",
};

export default function JourneyPanoramaPage() {
  return (
    <ExploreParchmentChrome>
      <BiblePanoramaClient />
    </ExploreParchmentChrome>
  );
}
