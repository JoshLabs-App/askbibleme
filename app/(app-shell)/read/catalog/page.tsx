import { BibleCatalogReadOutline } from "@/components/bible/BibleCatalogReadOutline";
import { ReadCatalogFooterLink, ReadCatalogTopBack } from "@/components/bible/ReadCatalogNavLinks";
import { ScriptureChrome } from "@/components/scripture/ScriptureChrome";
import { readScriptureCanonCatalog } from "@/lib/bible/read-scripture-canon-catalog";
import { sitePageTitle } from "@/lib/site-metadata-defaults";
import "./bible-catalog.css";

export const metadata = {
  title: sitePageTitle("六十六卷"),
  description: "圣经正典目录与历史时期线索。",
};

export default function ReadCatalogPage() {
  const canon = readScriptureCanonCatalog();

  return (
    <ScriptureChrome>
      <div className="read-bible-parchment-column--catalog bible-catalog-page--read bible-catalog-on-parchment min-h-0 w-full">
        <header className="bible-catalog-read-header">
          <ReadCatalogTopBack />
          <h1 className="bible-catalog-read-h1">六十六卷</h1>
        </header>

        <BibleCatalogReadOutline sections={canon.sections} />

        <ReadCatalogFooterLink />
      </div>
    </ScriptureChrome>
  );
}
