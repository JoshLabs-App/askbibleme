import type { HomePrayerManifestV1 } from "@/lib/home-prayer-pools/types";
import {
  homeVersePoolAllPriority,
  homeVersePoolPrayerPriority,
  type HomeVersePoolScopeId,
} from "@/lib/explore/explore-home-verse-pool-scopes";

export function filterManifestToExploreScope(
  manifest: HomePrayerManifestV1,
  scopeVerseKeys: Set<string>,
  scopeId: HomeVersePoolScopeId,
): HomePrayerManifestV1 {
  if (!manifest.entries.length) return manifest;
  const filteredEntriesRaw = manifest.entries.filter((e) => scopeVerseKeys.has(e.verseKey));
  const filteredEntries =
    scopeId === "all"
      ? filteredEntriesRaw
          .map((entry, idx) => ({ entry, idx, p: homeVersePoolAllPriority(entry.verseKey) }))
          .sort((a, b) => (a.p !== b.p ? a.p - b.p : a.idx - b.idx))
          .map((row) => row.entry)
      : scopeId === "prayer_scripture"
        ? filteredEntriesRaw
            .map((entry, idx) => ({ entry, idx, p: homeVersePoolPrayerPriority(entry.verseKey) }))
            .sort((a, b) => (a.p !== b.p ? a.p - b.p : a.idx - b.idx))
            .map((row) => row.entry)
        : filteredEntriesRaw;
  if (filteredEntries.length === 0) return manifest;
  const bootstrapVerseKeys = manifest.bootstrapVerseKeys ?? [];
  const nextBootstrapRaw = bootstrapVerseKeys.filter((k) => scopeVerseKeys.has(k));
  const nextBootstrap =
    scopeId === "all"
      ? [...nextBootstrapRaw].sort((a, b) => homeVersePoolAllPriority(a) - homeVersePoolAllPriority(b))
      : scopeId === "prayer_scripture"
        ? [...nextBootstrapRaw].sort((a, b) => homeVersePoolPrayerPriority(a) - homeVersePoolPrayerPriority(b))
        : nextBootstrapRaw;
  return {
    ...manifest,
    entries: filteredEntries,
    bootstrapVerseKeys: nextBootstrap.length ? nextBootstrap : filteredEntries.slice(0, 40).map((e) => e.verseKey),
  };
}
