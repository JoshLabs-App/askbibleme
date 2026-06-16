import fs from "node:fs";
import path from "node:path";

import {
  isExploreModulesBundle,
  type ExploreModulesBundle,
} from "@/lib/explore/explore-modules-bundle-types";

const REL_BUNDLE = path.join("data", "explore-modules", "bundle.json");

export function exploreModulesBundlePath(cwd: string): string {
  return path.join(cwd, REL_BUNDLE);
}

export function readExploreModulesBundleSync(cwd: string): ExploreModulesBundle | null {
  const p = exploreModulesBundlePath(cwd);
  try {
    const raw = fs.readFileSync(p, "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    if (!isExploreModulesBundle(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}
