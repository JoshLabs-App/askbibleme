import type { Metadata } from "next";
import { NatureVideoExperience } from "@/components/nature/NatureVideoExperience";
import { readNatureSettings } from "@/lib/nature/read-nature-settings";

export const metadata: Metadata = {
  title: "自然",
  description: "全屏自然影像与轮播经文，延续壳层轻音乐。",
};

export default async function NaturePage() {
  const settings = await readNatureSettings(process.cwd());
  return <NatureVideoExperience initial={settings} />;
}
