import type { Metadata } from "next";
import { NatureVideoExperience } from "@/components/nature/NatureVideoExperience";
import { buildHomeVerseRotationByLocale } from "@/lib/bible/home-verse-ref-rotation";
import { natureHomeViewport } from "@/lib/nature/nature-home-viewport";
import { readNatureSettings } from "@/lib/nature/read-nature-settings";
import { getResolvedBrandColors } from "@/lib/site-branding";

/** 与首页 `/` 同一套自然体验；独立路径便于顶栏菜单、捷径与书签。后台配置在 `/admin/music/nature`。 */
export const metadata: Metadata = {
  title: "自然 | Selah.my",
  description: "全屏自然影像与轮播经文。",
};

export const viewport = natureHomeViewport;

export const dynamic = "force-dynamic";

export default async function NaturePage() {
  const cwd = process.cwd();
  const settings = await readNatureSettings(cwd);
  const { appLight, appDark } = await getResolvedBrandColors();
  const homeVerseRotation = buildHomeVerseRotationByLocale(cwd);
  return (
    <NatureVideoExperience
      initial={settings}
      brandChrome={{ appLight, appDark }}
      homeVerseRotation={homeVerseRotation}
    />
  );
}
