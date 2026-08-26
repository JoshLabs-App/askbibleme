import Link from "next/link";
import { cookies, headers } from "next/headers";
import { ExploreParchmentChrome } from "@/components/explore/ExploreParchmentChrome";
import { ExploreScriptureAccordionContent } from "@/components/explore/ExploreScriptureAccordionContent";
import { readExploreModulesBundleSync } from "@/lib/explore/explore-modules-bundle-store";
import {
  getExploreStagedRemoteModule,
  hasExploreStagedRemotePoolContent,
  resolveExploreStagedEntryLabel,
} from "@/lib/explore/explore-home-config";
import { loadExploreRefVerseTexts } from "@/lib/explore/explore-scripture-ref";
import { getExploreStagedEntry, type ExploreStagedEntryId } from "@/lib/explore/explore-staged-entries";
import { resolveRequestLocale } from "@/lib/i18n/request-locale";
import type { AppLocale } from "@/lib/i18n/config";
import { toZhTwText } from "@/lib/i18n/zh-tw-text";

function resolveRemoteModulePageTitle(
  locale: AppLocale,
  module: NonNullable<ReturnType<typeof getExploreStagedRemoteModule>>,
  entryLabel: string,
): string {
  if (locale === "en") {
    return (module.pageTitleEn || module.pageTitle || entryLabel).trim();
  }
  if (locale === "zh-TW") {
    return toZhTwText((module.pageTitleTw || module.pageTitle || entryLabel).trim());
  }
  return (module.pageTitle || entryLabel).trim();
}

type Props = {
  entryId: ExploreStagedEntryId;
};

/** 预埋探索入口：经文池有远程配置则显示汇编，否则空白占位（对齐 App `ExploreStagedEntryScreen`）。 */
export async function ExploreStagedEntryPage({ entryId }: Props) {
  const bundle = readExploreModulesBundleSync(process.cwd());
  const entry = getExploreStagedEntry(entryId);
  const cookieStore = await cookies();
  const headerList = await headers();
  const locale = resolveRequestLocale(cookieStore, headerList.get("accept-language"));
  const remoteModule = bundle ? getExploreStagedRemoteModule(bundle, entryId) : null;
  const entryLabel =
    entry && bundle ? resolveExploreStagedEntryLabel(entry, locale, bundle) : entryId;

  if (remoteModule && hasExploreStagedRemotePoolContent(remoteModule)) {
    const categories = remoteModule.categories.map((category, index) => ({
      title: category.title,
      titleEn: remoteModule.titlesEn?.[index],
      refs: category.refs,
    }));
    const refs = categories.flatMap((c) => c.refs);
    const verseTextByRef = await loadExploreRefVerseTexts({
      refs,
      bookAbbrMap: remoteModule.bookAbbrToId,
      locale,
    });
    const pageTitle = resolveRemoteModulePageTitle(locale, remoteModule, entryLabel);
    const tapHint = locale === "en" ? "Tap a section to expand or collapse" : "点按分类可展开或收起";

    return (
      <ExploreParchmentChrome>
        <ExploreScriptureAccordionContent
          backLabelKey="pages.explore.wordOfGodBack"
          titleKey="pages.explore.wordOfGodTitle"
          subtitleKey="pages.explore.wordOfGodSubtitle"
          titleOverride={pageTitle}
          subtitleOverride={tapHint}
          categories={categories}
          bookAbbrMap={remoteModule.bookAbbrToId}
          verseTextByRef={verseTextByRef}
        />
      </ExploreParchmentChrome>
    );
  }

  const placeholder = locale === "en" ? "Coming soon." : "内容筹备中。";

  return (
    <ExploreParchmentChrome>
      <div className="explore-staged-placeholder">
        <Link href="/explore" className="explore-subpage-back" aria-label={locale === "en" ? "Back" : "返回"}>
          ←
        </Link>
        <h1 className="explore-staged-placeholder__title">{entryLabel}</h1>
        <p className="explore-staged-placeholder__lead">{placeholder}</p>
      </div>
    </ExploreParchmentChrome>
  );
}
