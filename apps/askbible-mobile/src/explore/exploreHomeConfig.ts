import type { AppLocale } from "../i18n/config";
import { localizeZhText, resolveUiText } from "../i18n/site-copy";
import type {
  ExploreHomeLocalizedText,
  ExploreModulesBundle,
  ExploreModulesExploreHome,
  ExploreModulesRemoteStagedModule,
} from "./exploreModulesBundleCore";
import {
  EXPLORE_SCRIPTURE_POOL_ENTRY_IDS,
  getExploreStagedEntry,
  isExploreScripturePoolEntryId,
  isExploreStagedEntryId,
  type ExploreStagedEntry,
} from "./exploreStagedEntries";

export function getExploreHomeConfig(bundle: ExploreModulesBundle): ExploreModulesExploreHome {
  return bundle.exploreHome ?? { visibleStagedEntryIds: [] };
}

export function resolveExploreHomeLocalizedText(
  locale: AppLocale,
  text: ExploreHomeLocalizedText | undefined,
  fallbackZh: string,
  fallbackEn: string,
): string {
  if (!text) return resolveUiText(locale, fallbackZh, fallbackEn);
  if (locale === "en") {
    return (text.en || text.zh || fallbackEn).trim() || fallbackEn;
  }
  if (locale === "zh-TW") {
    const raw = (text.zhTw || text.zh || fallbackZh).trim() || fallbackZh;
    return localizeZhText(locale, raw);
  }
  return (text.zh || fallbackZh).trim() || fallbackZh;
}

export function resolveExploreStagedEntryLabel(
  entry: ExploreStagedEntry,
  locale: AppLocale,
  bundle: ExploreModulesBundle,
): string {
  const remote = getExploreHomeConfig(bundle).entryLabels?.[entry.id];
  if (remote) {
    return resolveExploreHomeLocalizedText(locale, remote, entry.labelZh, entry.labelEn);
  }
  return resolveUiText(locale, entry.labelZh, entry.labelEn);
}

export function resolveExploreStagedSectionCaption(locale: AppLocale, bundle: ExploreModulesBundle): string {
  const caption = getExploreHomeConfig(bundle).sectionCaption;
  return resolveExploreHomeLocalizedText(
    locale,
    caption,
    "更多探索",
    "More to explore",
  );
}

/** 首页预埋区：仅 remote 显式放出且（经文池）已有内容时才展示图标 */
export function getVisibleExploreStagedEntries(bundle: ExploreModulesBundle): ExploreStagedEntry[] {
  const ids = getExploreHomeConfig(bundle).visibleStagedEntryIds;
  if (!ids.length) return [];

  const seen = new Set<string>();
  const result: ExploreStagedEntry[] = [];
  for (const id of ids) {
    if (!isExploreStagedEntryId(id) || seen.has(id)) continue;
    const entry = getExploreStagedEntry(id);
    if (!entry) continue;

    if (isExploreScripturePoolEntryId(id)) {
      const module = getExploreStagedRemoteModule(bundle, id);
      if (!module || !hasExploreStagedRemotePoolContent(module)) continue;
    }

    seen.add(id);
    result.push(entry);
  }
  return result;
}

export function getExploreStagedRemoteModule(
  bundle: ExploreModulesBundle,
  entryId: string,
): ExploreModulesRemoteStagedModule | null {
  const module = getExploreHomeConfig(bundle).remoteModules?.[entryId];
  if (!module || typeof module !== "object") return null;
  return module;
}

export function hasExploreStagedRemotePoolContent(module: ExploreModulesRemoteStagedModule): boolean {
  return Boolean(module.categories?.length && module.bookAbbrToId && Object.keys(module.bookAbbrToId).length > 0);
}

/** 开发自检 */
export function assertExploreStagedCatalog(): void {
  if (EXPLORE_SCRIPTURE_POOL_ENTRY_IDS.length !== 5) {
    throw new Error(`Expected 5 scripture pool slots, got ${EXPLORE_SCRIPTURE_POOL_ENTRY_IDS.length}`);
  }
}
