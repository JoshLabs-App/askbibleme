import fs from "node:fs";
import path from "node:path";

const REL = path.join("data", "scripture", "home-golden-theme-selection.json");

const KEY_RE = /^\d+-\d+$/;

export type HomeGoldenThemeSelectionFile = {
  version: number;
  /** 与主题库一致：`${categoryId}-${subId}` */
  selectedSubcategoryKeys: string[];
};

export function readHomeGoldenThemeSelectionSync(cwd: string): HomeGoldenThemeSelectionFile {
  const abs = path.join(cwd, REL);
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(abs, "utf8")) as unknown;
  } catch {
    return { version: 1, selectedSubcategoryKeys: [] };
  }
  if (!raw || typeof raw !== "object") return { version: 1, selectedSubcategoryKeys: [] };
  const o = raw as Record<string, unknown>;
  const keys = Array.isArray(o.selectedSubcategoryKeys)
    ? o.selectedSubcategoryKeys
        .map((x) => (typeof x === "string" ? x.trim() : ""))
        .filter((x): x is string => KEY_RE.test(x))
    : [];
  return {
    version: typeof o.version === "number" ? o.version : 1,
    selectedSubcategoryKeys: keys,
  };
}

export function writeHomeGoldenThemeSelectionSync(cwd: string, keys: string[]): void {
  const abs = path.join(cwd, REL);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  const uniq = [...new Set(keys.filter((k) => KEY_RE.test(k)))];
  const payload: HomeGoldenThemeSelectionFile = { version: 1, selectedSubcategoryKeys: uniq };
  fs.writeFileSync(abs, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}
