import type { Metadata } from "next";
import { NatureVideoExperience } from "@/components/nature/NatureVideoExperience";
import { natureHomeViewport } from "@/lib/nature/nature-home-viewport";
import { readNatureSettings } from "@/lib/nature/read-nature-settings";

export const metadata: Metadata = {
  title: "Selah.my",
  description: "全屏自然影像与轮播经文。",
};

export const viewport = natureHomeViewport;

/** 与 `data/nature-settings.json` 同步：避免构建期静态快照导致前台自然画面不更新 */
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const cwd = process.cwd();
  const settings = await readNatureSettings(cwd);
  return <NatureVideoExperience initial={settings} />;
}
