import type { HomePrayerManifestV1 } from "@/lib/home-prayer-pools/types";
import {
  menuScopeMatchesVerseKey,
  type HomeVersePoolMenuScopeId,
} from "@/lib/home-prayer-pools/home-verse-pool-menu-scopes";

export function filterManifestToMenuScope(
  manifest: HomePrayerManifestV1,
  menuScope: HomeVersePoolMenuScopeId,
): HomePrayerManifestV1 {
  if (!manifest.entries.length) return manifest;
  if (menuScope === "repeatGe5All") return manifest;
  const filteredEntries = manifest.entries.filter((e) => menuScopeMatchesVerseKey(menuScope, e.verseKey));
  if (filteredEntries.length === 0) return manifest;
  const bootstrapVerseKeys = manifest.bootstrapVerseKeys ?? [];
  const nextBootstrap = bootstrapVerseKeys.filter((k) => menuScopeMatchesVerseKey(menuScope, k));
  return {
    ...manifest,
    entries: filteredEntries,
    bootstrapVerseKeys: nextBootstrap.length
      ? nextBootstrap
      : filteredEntries.slice(0, 40).map((e) => e.verseKey),
  };
}
