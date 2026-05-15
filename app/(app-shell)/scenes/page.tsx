import type { Metadata } from "next";
import { NatureScenesPickerPage } from "@/components/nature/NatureScenesPickerPage";
import { readNatureSettings } from "@/lib/nature/read-nature-settings";
import { sitePageTitle } from "@/lib/site-metadata-defaults";

export const metadata: Metadata = {
  title: sitePageTitle("场景"),
  description: "选择自然首页背景场景；选择保存在本机。",
};

export default async function ScenesPage() {
  const cwd = process.cwd();
  const settings = await readNatureSettings(cwd);
  return <NatureScenesPickerPage initial={settings} />;
}
