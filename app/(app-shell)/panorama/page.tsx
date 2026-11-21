import { BiblePanoramaClient } from "@/components/panorama/BiblePanoramaClient";
import { sitePageTitle } from "@/lib/site-metadata-defaults";

export const metadata = {
  title: sitePageTitle("救赎全景"),
};

export default function PanoramaPage() {
  return <BiblePanoramaClient />;
}
