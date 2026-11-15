import { createHash } from "crypto";
import staticFigureArticlesEnBundle from "@/data/legacy-figure-articles/bundle.json";
import type { LegacyFigureArticle } from "@/lib/legacy-figure-preview";

export type LegacyFigureEnProfileBlock = {
  displayName: string;
  scripturePersonality?: string;
  periodLabel?: string;
  lifespan?: string;
  characterRole?: string;
  article?: Pick<LegacyFigureArticle, "title" | "summary" | "body">;
};

type LegacyFigureArticlesEnBundle = {
  schemaVersion: number;
  contentVersion?: string;
  generatedAt?: string;
  profiles: Array<{ id: string; slug: string; en: LegacyFigureEnProfileBlock }>;
};

let cache: LegacyFigureArticlesEnBundle | null = null;

function readBundle(_cwd = process.cwd()): LegacyFigureArticlesEnBundle | null {
  if (cache) return cache;
  cache = staticFigureArticlesEnBundle as LegacyFigureArticlesEnBundle;
  return cache;
}

export function readLegacyFigureEnBlockById(
  profileId: string,
  cwd = process.cwd(),
): LegacyFigureEnProfileBlock | null {
  const bundle = readBundle(cwd);
  if (!bundle) return null;
  return bundle.profiles.find((entry) => entry.id === profileId)?.en ?? null;
}

export function readLegacyFigureEnBlockBySlug(
  slug: string,
  cwd = process.cwd(),
): LegacyFigureEnProfileBlock | null {
  const bundle = readBundle(cwd);
  if (!bundle) return null;
  const needle = slug.trim().replace(/^figure-/, "");
  return (
    bundle.profiles.find(
      (entry) => entry.slug === needle || entry.slug === `figure-${needle}` || entry.id === needle,
    )?.en ?? null
  );
}

export function legacyFigureArticlesEnContentVersion(cwd = process.cwd()): string | null {
  return readBundle(cwd)?.contentVersion ?? null;
}

export function computeLegacyFigureArticlesEnContentVersion(
  profiles: Array<{ id: string; slug: string; en: LegacyFigureEnProfileBlock }>,
): string {
  return createHash("sha256")
    .update(JSON.stringify({ schemaVersion: 1, profiles }))
    .digest("hex")
    .slice(0, 16);
}
