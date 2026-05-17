import { GoldenVersesPageClient } from "@/components/verse/GoldenVersesPageClient";
import { readGoldenVersesSettings } from "@/lib/golden-verses/settings-file";
import { sitePageTitle } from "@/lib/site-metadata-defaults";

export const metadata = {
  title: sitePageTitle("金句"),
  description: "金句",
};

export const dynamic = "force-dynamic";

export default async function GoldenVersesPage() {
  const cwd = process.cwd();
  const golden = await readGoldenVersesSettings(cwd, { syncDisk: true });

  return <GoldenVersesPageClient uploadedBackgrounds={golden.backgrounds} />;
}
