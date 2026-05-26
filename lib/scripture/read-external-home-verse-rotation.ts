import fs from "node:fs";
import path from "node:path";
import type { VerseRef } from "@/lib/bible/verse-ref";
import { parseVerseRefFromUnknown } from "@/lib/bible/verse-ref-json";

const REL = path.join("data", "scripture", "external-home-verse-rotation.json");

export type ExternalHomeVerseRotationFile = {
  version: number;
  verseRefs: VerseRef[];
};

function parseExternalHomeVerseRotation(raw: unknown): ExternalHomeVerseRotationFile | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const refsRaw = o.verseRefs;
  if (!Array.isArray(refsRaw)) return null;
  const verseRefs: VerseRef[] = [];
  for (const item of refsRaw) {
    const ref = parseVerseRefFromUnknown(item);
    if (ref) verseRefs.push(ref);
  }
  if (verseRefs.length === 0) return null;
  return {
    version: typeof o.version === "number" ? o.version : 1,
    verseRefs,
  };
}

/**
 * Legacy source used by old Admin curation scripts.
 * Missing/invalid file should not break runtime boot.
 */
export function readExternalHomeVerseRotationSync(cwd: string): ExternalHomeVerseRotationFile | null {
  const abs = path.join(cwd, REL);
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(abs, "utf8")) as unknown;
  } catch {
    return null;
  }
  return parseExternalHomeVerseRotation(raw);
}
