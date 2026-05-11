import type { Metadata } from "next";
import { NatureVideoExperience } from "@/components/nature/NatureVideoExperience";
import { readNatureSettings } from "@/lib/nature/read-nature-settings";

export const metadata: Metadata = {
  title: "Selah.my",
  description: "全屏自然影像与轮播经文。",
};

/** 与 `data/nature-settings.json` 同步：避免构建期静态快照导致前台自然画面不更新 */
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const settings = await readNatureSettings(process.cwd());
  return <NatureVideoExperience initial={settings} />;
}
