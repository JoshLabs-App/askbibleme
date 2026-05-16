import fs from "node:fs";
import path from "node:path";
import type { AppLocale } from "@/lib/i18n/config";
import type { HomeVerseEntry } from "@/lib/i18n/home-verses";

const REL = path.join("data", "scripture", "home-golden-verse-rotation-static.json");

export type HomeGoldenVerseRotationStaticFileV1 = {
  version: 1;
  /** 与 `getHomeVerseRotationRefs(cwd).length` 一致时 RSC 才采用；避免只改 refs 未重生成时误用旧正文 */
  verseRefsCount: number;
  entriesByLocale: Record<AppLocale, HomeVerseEntry[]>;
};

function isHomeVerseEntry(x: unknown): x is HomeVerseEntry {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  if (!Array.isArray(o.lines) || typeof o.ref !== "string") return false;
  return o.lines.every((ln) => typeof ln === "string");
}

export function readHomeGoldenVerseRotationStaticSync(cwd: string): HomeGoldenVerseRotationStaticFileV1 | null {
  const abs = path.join(cwd, REL);
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(abs, "utf8")) as unknown;
  } catch {
    return null;
  }
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.version !== 1 || typeof o.verseRefsCount !== "number" || o.verseRefsCount < 0) return null;
  const eb = o.entriesByLocale;
  if (!eb || typeof eb !== "object") return null;
  const m = eb as Record<string, unknown>;
  const zh = m["zh-CN"];
  const en = m.en;
  if (!Array.isArray(zh) || !Array.isArray(en)) return null;
  const zhArr: HomeVerseEntry[] = [];
  const enArr: HomeVerseEntry[] = [];
  for (const item of zh) {
    if (!isHomeVerseEntry(item)) return null;
    zhArr.push(item);
  }
  for (const item of en) {
    if (!isHomeVerseEntry(item)) return null;
    enArr.push(item);
  }
  return { version: 1, verseRefsCount: o.verseRefsCount, entriesByLocale: { "zh-CN": zhArr, en: enArr } };
}

export function writeHomeGoldenVerseRotationStaticSync(cwd: string, payload: HomeGoldenVerseRotationStaticFileV1): void {
  const abs = path.join(cwd, REL);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}
