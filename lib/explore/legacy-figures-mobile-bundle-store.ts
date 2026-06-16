import fs from "node:fs";
import path from "node:path";

import {
  isMobileLegacyFiguresBundle,
  type MobileLegacyFiguresBundle,
} from "@/lib/explore/legacy-figures-mobile-bundle-types";

const REL_BUNDLE = path.join("data", "legacy-figures-mobile.json");

export function legacyFiguresMobileBundlePath(cwd: string): string {
  return path.join(cwd, REL_BUNDLE);
}

export function readLegacyFiguresMobileBundleSync(cwd: string): MobileLegacyFiguresBundle | null {
  const p = legacyFiguresMobileBundlePath(cwd);
  try {
    const raw = fs.readFileSync(p, "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    if (!isMobileLegacyFiguresBundle(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}
