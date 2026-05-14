import { GoldenVersesPageClient } from "@/components/verse/GoldenVersesPageClient";
import { readGoldenVersesSettings } from "@/lib/golden-verses/settings-file";

export const metadata = {
  title: "金句 · Selah.my",
  description: "金句",
};

export const revalidate = 600;

export default async function GoldenVersesPage() {
  const cwd = process.cwd();
  const golden = await readGoldenVersesSettings(cwd);

  return <GoldenVersesPageClient goldenBackgroundImageUrl={golden.backgroundImageUrl} />;
}
