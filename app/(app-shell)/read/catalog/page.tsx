import { BibleCatalogReadOutline } from "@/components/bible/BibleCatalogReadOutline";
import { ReadBibleTypographySettingsControl } from "@/components/bible/ReadBibleTypographySettingsControl";
import { ReadCatalogFooterLink, ReadCatalogTopBack } from "@/components/bible/ReadCatalogNavLinks";
import { ShellTemplateChromeLayout } from "@/components/shell/ShellTemplateChromeLayout";
import { readScriptureCanonCatalog } from "@/lib/bible/read-scripture-canon-catalog";
import { PRAYER_SHELL_FILL_LIGHT } from "@/lib/prayer/prayer-shell-fill";
import { sitePageTitle } from "@/lib/site-metadata-defaults";
import "./bible-catalog.css";

export const metadata = {
  title: sitePageTitle("六十六卷"),
  description: "圣经正典目录与历史时期线索。",
};

export default function ReadCatalogPage() {
  const canon = readScriptureCanonCatalog();

  return (
    <ShellTemplateChromeLayout
      contentClassName="gap-0"
      appShellBackground={PRAYER_SHELL_FILL_LIGHT}
      immersive
      topBarRightAccessory={<ReadBibleTypographySettingsControl />}
    >
      <div className="read-bible-parchment-shell flex-1 text-amber-950 dark:text-stone-50">
        <div className="read-bible-parchment-scroll">
          <div className="read-bible-parchment-column read-bible-parchment-column--catalog read-bible-typography">
            <div className="bible-catalog-page--read bible-catalog-on-parchment min-h-0">
              <header className="bible-catalog-read-header">
                <ReadCatalogTopBack />
                <h1 className="bible-catalog-read-h1">六十六卷</h1>
              </header>

              <BibleCatalogReadOutline sections={canon.sections} />

              <ReadCatalogFooterLink />
            </div>
          </div>
        </div>
      </div>
    </ShellTemplateChromeLayout>
  );
}
