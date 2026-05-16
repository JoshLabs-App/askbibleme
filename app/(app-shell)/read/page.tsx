import { ReadBibleHomeClient } from "@/components/bible/ReadBibleHomeClient";
import { ScriptureChrome } from "@/components/scripture/ScriptureChrome";
import { readScriptureCanonCatalog } from "@/lib/bible/read-scripture-canon-catalog";
import { readReadingPlanRegistrySync } from "@/lib/bible/reading-plans/reading-plans-store";
import { sitePageTitle } from "@/lib/site-metadata-defaults";
import "./catalog/bible-catalog.css";

export const metadata = {
  title: sitePageTitle("圣经"),
  description: "正典六十六卷目录、今日读经与安静的阅读入口。",
};

export default async function ReadPlaceholderPage() {
  const cwd = process.cwd();
  const canon = readScriptureCanonCatalog();
  const readingPlanRegistry = readReadingPlanRegistrySync(cwd)?.plans ?? [];
  return (
    <ScriptureChrome scrollHome>
      <ReadBibleHomeClient catalogSections={canon.sections} readingPlanRegistry={readingPlanRegistry} />
    </ScriptureChrome>
  );
}
