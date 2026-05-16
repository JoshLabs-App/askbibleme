import { ReadBibleTypographySettingsControl } from "@/components/bible/ReadBibleTypographySettingsControl";
import { ReadPlansPageClient } from "@/components/bible/ReadPlansPageClient";
import { ShellTemplateChromeLayout } from "@/components/shell/ShellTemplateChromeLayout";
import { readReadingPlanRegistrySync } from "@/lib/bible/reading-plans/reading-plans-store";
import { PRAYER_SHELL_FILL_LIGHT } from "@/lib/prayer/prayer-shell-fill";
import { sitePageTitle } from "@/lib/site-metadata-defaults";
import "../read-chapter-surfaces.css";
import "../read-bible-typography.css";

export const metadata = {
  title: sitePageTitle("读经计划"),
  description: "可选的一年通读、编年、分段等读经表；链到章节阅读。",
};

export default function ReadPlansPage() {
  const cwd = process.cwd();
  const registry = readReadingPlanRegistrySync(cwd);
  const plans = registry?.plans ?? [];

  return (
    <ShellTemplateChromeLayout
      contentClassName="gap-0"
      appShellBackground={PRAYER_SHELL_FILL_LIGHT}
      immersive
      topBarRightAccessory={<ReadBibleTypographySettingsControl />}
    >
      <div className="read-bible-parchment-shell flex-1 text-amber-950 dark:text-stone-50">
        <div className="read-bible-parchment-scroll">
          <div className="read-bible-parchment-column read-bible-typography">
            <ReadPlansPageClient plans={plans} />
          </div>
        </div>
      </div>
    </ShellTemplateChromeLayout>
  );
}
