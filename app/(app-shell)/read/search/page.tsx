import { ReadScriptureSearchClient } from "@/components/bible/ReadScriptureSearchClient";
import { ScriptureChrome } from "@/components/scripture/ScriptureChrome";
import { sitePageTitle } from "@/lib/site-metadata-defaults";

export const metadata = {
  title: sitePageTitle("经文搜索"),
};

export default function ReadScriptureSearchPage() {
  return (
    <ScriptureChrome scrollHome>
      <ReadScriptureSearchClient />
    </ScriptureChrome>
  );
}
