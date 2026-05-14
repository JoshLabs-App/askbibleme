import type { Metadata } from "next";
import { NatureVideoExperience } from "@/components/nature/NatureVideoExperience";
import { natureHomeViewport } from "@/lib/nature/nature-home-viewport";
import { readNatureSettings } from "@/lib/nature/read-nature-settings";

/** 与首页 `/` 同一套自然体验；独立路径便于顶栏菜单、捷径与书签。后台配置在 `/admin/music/nature`。 */
export const metadata: Metadata = {
  title: "自然 | Selah.my",
  description: "全屏自然影像与轮播经文。",
};

export const viewport = natureHomeViewport;

/** 构建期嵌入 `data/nature-settings.json`；打开后由 `NatureVideoExperience` 再拉 `/api/nature/settings` 对齐最新配置。 */
export default async function NaturePage() {
  const cwd = process.cwd();
  const settings = await readNatureSettings(cwd);
  return <NatureVideoExperience initial={settings} />;
}
