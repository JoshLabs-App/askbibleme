import { OfflinePageClient } from "@/components/pwa/OfflinePageClient";
import { sitePageTitle } from "@/lib/site-metadata-defaults";

export const metadata = {
  title: sitePageTitle("离线"),
};

export default function OfflinePage() {
  return <OfflinePageClient />;
}
