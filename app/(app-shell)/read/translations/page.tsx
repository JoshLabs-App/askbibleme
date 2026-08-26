import { Suspense } from "react";
import { ReadBibleTranslationsPageClient } from "@/components/bible/ReadBibleTranslationsPageClient";
import { ScriptureChrome } from "@/components/scripture/ScriptureChrome";
import { sitePageTitle } from "@/lib/site-metadata-defaults";

export const metadata = {
  title: sitePageTitle("圣经版本"),
};

export default function ReadBibleTranslationsPage() {
  return (
    <ScriptureChrome scrollHome>
      <Suspense fallback={null}>
        <ReadBibleTranslationsPageClient />
      </Suspense>
    </ScriptureChrome>
  );
}
