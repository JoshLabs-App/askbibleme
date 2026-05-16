import fs from "node:fs";
import path from "node:path";
import type { VerseRef } from "@/lib/bible/verse-ref";
import { parseVerseRefFromUnknown } from "@/lib/bible/verse-ref-json";
import type { ScriptureSourceMeta } from "@/lib/scripture/scripture-source-meta";

const REL = path.join("data", "scripture", "external-home-verse-rotation.json");

export type ExternalHomeVerseRotationFile = {
  version: number;
  sourceMeta?: ScriptureSourceMeta;
  verseRefs: VerseRef[];
};

/** 同步读首页轮播 `VerseRef[]`；坏文件时返回 null。 */
export function readExternalHomeVerseRotationSync(cwd: string): ExternalHomeVerseRotationFile | null {
  const abs = path.join(cwd, REL);
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(abs, "utf8")) as unknown;
  } catch {
    return null;
  }
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.version !== "number" || !Array.isArray(o.verseRefs)) return null;
  const verseRefs: VerseRef[] = [];
  for (const item of o.verseRefs) {
    const r = parseVerseRefFromUnknown(item);
    if (r) verseRefs.push(r);
  }
  if (verseRefs.length === 0) return null;
  const sm = o.sourceMeta;
  let sourceMeta: ScriptureSourceMeta | undefined;
  if (sm && typeof sm === "object") {
    const m = sm as Record<string, unknown>;
    sourceMeta = {
      sourceName: typeof m.sourceName === "string" ? m.sourceName : undefined,
      sourceUrl: typeof m.sourceUrl === "string" ? m.sourceUrl : undefined,
      licenseOrTermsNote: typeof m.licenseOrTermsNote === "string" ? m.licenseOrTermsNote : undefined,
      retrievedAt: typeof m.retrievedAt === "string" ? m.retrievedAt : undefined,
      snapshotVersion: typeof m.snapshotVersion === "string" ? m.snapshotVersion : undefined,
    };
  }
  return { version: o.version, sourceMeta, verseRefs };
}

/** 写入首页轮播 `VerseRef[]`（不含 sourceMeta，避免落库来源信息）。 */
export function writeExternalHomeVerseRotationSync(cwd: string, verseRefs: VerseRef[]): void {
  const abs = path.join(cwd, REL);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  const payload: ExternalHomeVerseRotationFile = { version: 2, verseRefs };
  fs.writeFileSync(abs, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}
