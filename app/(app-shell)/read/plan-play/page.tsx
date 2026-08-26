import { cookies, headers } from "next/headers";
import { ReadPlanPlayClient } from "@/components/bible/ReadPlanPlayClient";
import { ScriptureChrome } from "@/components/scripture/ScriptureChrome";
import { readReadingPlanRegistrySync } from "@/lib/bible/reading-plans/reading-plans-store";
import { sitePageTitle } from "@/lib/site-metadata-defaults";
import "../catalog/bible-catalog.css";
import "./read-plan-play.css";

export const metadata = {
  title: sitePageTitle("读经计划"),
  description: "今日读经计划与连续播放。",
};

export default async function ReadPlanPlayPage() {
  const readingPlanRegistry = readReadingPlanRegistrySync(process.cwd())?.plans ?? [];

  return (
    <ScriptureChrome scrollHome hideTypographyControl>
      <ReadPlanPlayClient readingPlanRegistry={readingPlanRegistry} />
    </ScriptureChrome>
  );
}
