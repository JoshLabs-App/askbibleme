import { BibleCatalogReadOutline } from "@/components/bible/BibleCatalogReadOutline";
import { ReadCatalogFooterLink, ReadCatalogTopBack } from "@/components/bible/ReadCatalogNavLinks";
import { ShellTemplateChromeLayout } from "@/components/shell/ShellTemplateChromeLayout";
import { readScriptureCanonCatalog } from "@/lib/bible/read-scripture-canon-catalog";
import "./bible-catalog.css";

export const metadata = {
  title: "六十六卷",
  description: "圣经正典目录与历史时期线索。",
};

export default function ReadCatalogPage() {
  const canon = readScriptureCanonCatalog();

  return (
    <ShellTemplateChromeLayout contentClassName="gap-0">
      <div className="content-page bible-catalog-page--read page-paper-shell min-h-0 flex-1">
        <div className="bible-catalog-shell">
          <div className="bible-catalog-doc">
            <ReadCatalogTopBack />
            <h1 className="bible-catalog-read-h1">六十六卷</h1>

            <BibleCatalogReadOutline sections={canon.sections} />

            <ReadCatalogFooterLink />
          </div>
        </div>
      </div>
    </ShellTemplateChromeLayout>
  );
}
