import { ReadCatalogStandaloneClient } from "@/components/bible/ReadCatalogStandaloneClient";
import { ScriptureChrome } from "@/components/scripture/ScriptureChrome";
import { sitePageTitle } from "@/lib/site-metadata-defaults";
import "../catalog/bible-catalog.css";

export const metadata = {
  title: sitePageTitle("六十六卷"),
  description: "圣经正典目录与卷次摘要。",
};

/** 独立目录页（章页「目录」跳转；对齐 iOS `/read/read`）。 */
export default function ReadStandaloneCatalogPage() {
  return (
    <ScriptureChrome scrollHome>
      <ReadCatalogStandaloneClient />
    </ScriptureChrome>
  );
}
