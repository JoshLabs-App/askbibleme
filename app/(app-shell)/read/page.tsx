import { ReadBibleHomeClient } from "@/components/bible/ReadBibleHomeClient";
import { ReadBibleTypographySettingsControl } from "@/components/bible/ReadBibleTypographySettingsControl";
import { ShellTemplateChromeLayout } from "@/components/shell/ShellTemplateChromeLayout";
import { readScriptureCanonCatalog } from "@/lib/bible/read-scripture-canon-catalog";
import { readReadingPlanRegistrySync } from "@/lib/bible/reading-plans/reading-plans-store";
import { PRAYER_SHELL_FILL_LIGHT } from "@/lib/prayer/prayer-shell-fill";
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
    <ShellTemplateChromeLayout
      contentClassName="gap-0"
      appShellBackground={PRAYER_SHELL_FILL_LIGHT}
      immersive
      topBarRightAccessory={<ReadBibleTypographySettingsControl />}
    >
      <div className="read-bible-parchment-shell flex-1 text-amber-950 dark:text-stone-50">
        <div className="read-bible-parchment-scroll read-bible-parchment-scroll--read-home">
          <div className="read-bible-parchment-column read-bible-parchment-column--catalog read-bible-typography">
            <ReadBibleHomeClient catalogSections={canon.sections} readingPlanRegistry={readingPlanRegistry} />
          </div>
        </div>
      </div>
    </ShellTemplateChromeLayout>
  );
}
