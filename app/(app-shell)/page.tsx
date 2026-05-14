import type { Metadata } from "next";
import { NatureVideoExperience } from "@/components/nature/NatureVideoExperience";
import { natureHomeViewport } from "@/lib/nature/nature-home-viewport";
import { readNatureSettings } from "@/lib/nature/read-nature-settings";
import { SITE_METADATA_DEFAULT_TITLE } from "@/lib/site-metadata-defaults";

export const metadata: Metadata = {
  title: SITE_METADATA_DEFAULT_TITLE,
  description: "全屏自然影像与轮播经文。",
};

export const viewport = natureHomeViewport;

/** 构建期嵌入 `data/nature-settings.json`；打开后由 `NatureVideoExperience` 再拉 `/api/nature/settings` 对齐最新配置。 */
export default async function HomePage() {
  const cwd = process.cwd();
  const settings = await readNatureSettings(cwd);
  return <NatureVideoExperience initial={settings} />;
}
