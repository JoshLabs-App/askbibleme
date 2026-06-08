import fs from "node:fs";
import path from "node:path";

import {
  isExploreFeaturedArticlesBundle,
  type ExploreFeaturedArticlesBundle,
} from "@/lib/explore/explore-featured-articles-bundle-types";

const REL_BUNDLE = path.join("data", "explore-featured-articles", "bundle.json");

export function exploreFeaturedArticlesBundlePath(cwd: string): string {
  return path.join(cwd, REL_BUNDLE);
}

export function readExploreFeaturedArticlesBundleSync(cwd: string): ExploreFeaturedArticlesBundle | null {
  const p = exploreFeaturedArticlesBundlePath(cwd);
  try {
    const raw = fs.readFileSync(p, "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    if (!isExploreFeaturedArticlesBundle(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}
