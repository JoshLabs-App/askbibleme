import type { Metadata } from "next";
import { NatureVideoExperience } from "@/components/nature/NatureVideoExperience";
import { readNatureSettings } from "@/lib/nature/read-nature-settings";

export const metadata: Metadata = {
  title: "Selah.my",
  description: "全屏自然影像与轮播经文。",
};

export default async function HomePage() {
  const settings = await readNatureSettings(process.cwd());
  return <NatureVideoExperience initial={settings} />;
}
