import { ReadPlansPageClient } from "@/components/bible/ReadPlansPageClient";
import { ScriptureChrome } from "@/components/scripture/ScriptureChrome";
import { readReadingPlanRegistrySync } from "@/lib/bible/reading-plans/reading-plans-store";
import { sitePageTitle } from "@/lib/site-metadata-defaults";

export const metadata = {
  title: sitePageTitle("读经计划"),
  description: "可选的一年通读、编年、分段等读经表；链到章节阅读。",
};

export default function ReadPlansPage() {
  const cwd = process.cwd();
  const registry = readReadingPlanRegistrySync(cwd);
  const plans = registry?.plans ?? [];

  return (
    <ScriptureChrome>
      <ReadPlansPageClient plans={plans} />
    </ScriptureChrome>
  );
}
