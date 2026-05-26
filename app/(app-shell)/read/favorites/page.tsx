import { ReadFavoritesClient } from "@/components/bible/ReadFavoritesClient";
import { ScriptureChrome } from "@/components/scripture/ScriptureChrome";
import { sitePageTitle } from "@/lib/site-metadata-defaults";

export const metadata = {
  title: sitePageTitle("收藏"),
};

export default function ReadFavoritesPage() {
  return (
    <ScriptureChrome scrollHome>
      <ReadFavoritesClient />
    </ScriptureChrome>
  );
}

