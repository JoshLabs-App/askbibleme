import { GoldenVersesPageClient } from "@/components/verse/GoldenVersesPageClient";
import { readGoldenVersesSettings } from "@/lib/golden-verses/settings-file";
import { sitePageTitle } from "@/lib/site-metadata-defaults";

export const metadata = {
  title: sitePageTitle("金句"),
  description: "金句",
};

export const revalidate = 600;

export default async function GoldenVersesPage() {
  const cwd = process.cwd();
  const golden = await readGoldenVersesSettings(cwd);

  return <GoldenVersesPageClient goldenBackgroundImageUrl={golden.backgroundImageUrl} />;
}
