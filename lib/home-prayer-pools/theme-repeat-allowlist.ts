import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export type ThemeRepeatAllowlistRow = {
  verseKey: string;
  repeatCount: number;
  reference: string;
  text: string;
};

export function themeRepeatAllowlistPath(cwd: string, scopeId: string): string {
  return path.join(cwd, "data", "scripture", `${scopeId}-allowlist.tsv`);
}

export function readThemeRepeatAllowlistVerseKeys(
  cwd: string,
  scopeId: string,
): Set<string> | null {
  const filePath = themeRepeatAllowlistPath(cwd, scopeId);
  if (!existsSync(filePath)) return null;
  const raw = readFileSync(filePath, "utf8");
  const out = new Set<string>();
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const verseKey = trimmed.split("\t")[0]?.trim() ?? "";
    if (!verseKey) continue;
    out.add(verseKey);
  }
  return out;
}

export function readThemeRepeatAllowlistRows(
  cwd: string,
  scopeId: string,
): ThemeRepeatAllowlistRow[] | null {
  const filePath = themeRepeatAllowlistPath(cwd, scopeId);
  if (!existsSync(filePath)) return null;
  const raw = readFileSync(filePath, "utf8");
  const rows: ThemeRepeatAllowlistRow[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const [verseKeyRaw, repeatCountRaw, referenceRaw, ...textParts] = line.split("\t");
    const verseKey = String(verseKeyRaw ?? "").trim().toUpperCase();
    if (!verseKey) continue;
    const repeatCount = Math.max(1, Number.parseInt(String(repeatCountRaw ?? "1"), 10) || 1);
    const reference = String(referenceRaw ?? "").trim();
    const text = textParts.join("\t").trim();
    rows.push({ verseKey, repeatCount, reference, text });
  }
  return rows;
}

function cleanCell(input: string): string {
  return String(input ?? "")
    .replace(/\s+/g, " ")
    .replace(/\t/g, " ")
    .trim();
}

export function writeThemeRepeatAllowlist(
  cwd: string,
  scopeId: string,
  rows: ThemeRepeatAllowlistRow[],
): string {
  const filePath = themeRepeatAllowlistPath(cwd, scopeId);
  mkdirSync(path.dirname(filePath), { recursive: true });
  const lines = [
    "# Theme repeat pool allowlist",
    "# Delete a row to remove that verse from pool generation.",
    "# Columns: verseKey<TAB>repeatCount<TAB>reference<TAB>text",
    ...rows.map((row) =>
      [
        cleanCell(row.verseKey),
        String(Math.max(1, Math.floor(row.repeatCount || 0))),
        cleanCell(row.reference),
        cleanCell(row.text),
      ].join("\t"),
    ),
  ];
  writeFileSync(filePath, `${lines.join("\n")}\n`, "utf8");
  return filePath;
}
