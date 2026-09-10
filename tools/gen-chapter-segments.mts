// 章节分段（小标题 + 段落起点）→ 两端静态 JSON。
// 直接调 RN 的 loadBundledChapterSegments(…, "t1") + buildChapterSegmentMeta 同一套逻辑（tsx 跑），不另抄一份：
// t1 模式 = 故事化小标题（open-usfm-chapter-segments.story.t1.zh.json）合并到 USFM 段落 / 诗体起点上。
//   node node_modules/tsx/dist/cli.mjs tools/gen-chapter-segments.mts
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as segNs from "../apps/askbible-mobile/src/bible/bundled-chapter-segments";
import * as dispNs from "../apps/askbible-mobile/src/bible/chapter-segment-display";
import * as booksNs from "../lib/bible/scripture-books";
const unwrap = (ns: any) => (ns && ns.default && typeof ns.default === "object" ? { ...ns.default, ...ns } : ns);
const seg: any = unwrap(segNs), disp: any = unwrap(dispNs), books: any = unwrap(booksNs);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const out: Record<string, Record<string, { h?: Record<string, string[]>; p?: number[]; he?: Record<string, string[]>; pe?: number[] }>> = {};
let chapters = 0, headings = 0, paragraphs = 0;
for (const b of books.scriptureBooks as Array<{ bookId: string; chapters: number }>) {
  for (let ch = 1; ch <= b.chapters; ch++) {
    const rows = seg.loadBundledChapterSegments(b.bookId, ch, "t1");
    if (!rows) continue;
    const h: Record<string, string[]> = {};
    const p = new Set<number>();
    for (const row of rows) {
      if (!Number.isInteger(row.verseStart) || row.verseStart == null) continue;
      if (row.type === "heading") {
        const text = disp.resolveChapterSegmentHeadingText(row, "zh-CN", undefined, false);
        if (text) (h[String(row.verseStart)] ??= []).push(text);
      }
      if (row.type === "paragraph" || row.type === "poetry") p.add(row.verseStart);
    }
    // 英文译本的面（RN preferEnglishTitles）：小标题只取 USFM 的英文 T1，段落起点也按英文那套
    const rowsEn = seg.loadBundledChapterSegments(b.bookId, ch, "t1", { preferEnglishTitles: true }) ?? [];
    const he: Record<string, string[]> = {};
    const pe = new Set<number>();
    for (const row of rowsEn) {
      if (!Number.isInteger(row.verseStart) || row.verseStart == null) continue;
      if (row.type === "heading") {
        const text = disp.resolveChapterSegmentHeadingText(row, "en", undefined, true);
        if (text) (he[String(row.verseStart)] ??= []).push(text);
      }
      if (row.type === "paragraph" || row.type === "poetry") pe.add(row.verseStart);
    }
    const entry: { h?: Record<string, string[]>; p?: number[]; he?: Record<string, string[]>; pe?: number[] } = {};
    if (Object.keys(h).length) entry.h = h;
    if (p.size) entry.p = [...p].sort((a, c) => a - c);
    if (Object.keys(he).length) entry.he = he;
    const peList = [...pe].sort((a, c) => a - c);
    if (peList.length && JSON.stringify(peList) !== JSON.stringify(entry.p ?? [])) entry.pe = peList;
    if (!entry.h && !entry.p && !entry.he) continue;
    (out[b.bookId] ??= {})[String(ch)] = entry;
    chapters++; headings += Object.values(h).reduce((s, arr) => s + arr.length, 0); paragraphs += p.size;
  }
}
const json = JSON.stringify(out);
for (const dir of ["apps/askbible-ios/AskBible/Resources", "apps/askbible-android/app/src/main/assets"]) {
  mkdirSync(path.join(ROOT, dir), { recursive: true });
  writeFileSync(path.join(ROOT, dir, "chapter-segments.json"), json);
}
console.log(`章节分段已生成：${chapters} 章，${headings} 个小标题，${paragraphs} 个段落起点，${(json.length / 1024).toFixed(0)} KB`);
const g2 = out.GEN?.["2"], m13 = out.MAT?.["13"];
console.log("GEN 2:", JSON.stringify(g2, null, 0), "\nMAT 13:", JSON.stringify(m13, null, 0));
