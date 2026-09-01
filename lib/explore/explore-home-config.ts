import type { AppLocale } from "@/lib/i18n/config";
import { toZhTwText } from "@/lib/i18n/zh-tw-text";
import type {
  ExploreHomeLocalizedText,
  ExploreModulesBundle,
  ExploreModulesExploreHome,
  ExploreModulesRemoteStagedModule,
} from "@/lib/explore/explore-modules-bundle-types";
import {
  EXPLORE_SCRIPTURE_POOL_ENTRY_IDS,
  getExploreStagedEntry,
  isExploreScripturePoolEntryId,
  isExploreStagedEntryId,
  type ExploreStagedEntry,
} from "@/lib/explore/explore-staged-entries";

function resolveUiText(locale: AppLocale, zh: string, en: string): string {
  if (locale === "en") return en;
  if (locale === "zh-TW") return toZhTwText(zh);
  return zh;
}

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
    return toZhTwText(raw);
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
  return resolveExploreHomeLocalizedText(locale, caption, "更多探索", "More to explore");
}

export function getExploreStagedRemoteModule(
  bundle: ExploreModulesBundle,
  entryId: string,
): ExploreModulesRemoteStagedModule | null {
  const remoteModule = getExploreHomeConfig(bundle).remoteModules?.[entryId];
  if (!remoteModule || typeof remoteModule !== "object") return null;
  return remoteModule;
}

export function hasExploreStagedRemotePoolContent(module: ExploreModulesRemoteStagedModule): boolean {
  return Boolean(module.categories?.length && module.bookAbbrToId && Object.keys(module.bookAbbrToId).length > 0);
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
      const remoteModule = getExploreStagedRemoteModule(bundle, id);
      if (!remoteModule || !hasExploreStagedRemotePoolContent(remoteModule)) continue;
    }

    seen.add(id);
    result.push(entry);
  }
  return result;
}

/** 开发自检 */
export function assertExploreStagedCatalog(): void {
  if (EXPLORE_SCRIPTURE_POOL_ENTRY_IDS.length !== 5) {
    throw new Error(`Expected 5 scripture pool slots, got ${EXPLORE_SCRIPTURE_POOL_ENTRY_IDS.length}`);
  }
}
