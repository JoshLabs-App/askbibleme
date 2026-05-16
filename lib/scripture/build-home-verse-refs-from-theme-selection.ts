import type { VerseRef } from "@/lib/bible/verse-ref";
import { SITE_VERSE_POOL_MAX } from "@/lib/scripture/site-verse-pool";
import { getReaderVerseThemesDatabase } from "@/lib/scripture/reader-verse-themes-db";

function refKey(r: VerseRef): string {
  return `${r.bookId}:${r.chapter}:${r.verseStart}:${r.verseEnd}`;
}

/**
 * 从主题库 SQLite 中，按选中的子标签键（`categoryId-subId`）收集 VerseRef，去重后随机打乱并截断。
 */
export async function buildVerseRefsFromThemeSubcategoryKeys(
  cwd: string,
  keys: string[],
  options?: { maxRefs?: number; shuffle?: boolean },
): Promise<VerseRef[]> {
  const max = options?.maxRefs ?? SITE_VERSE_POOL_MAX;
  const shuffle = options?.shuffle !== false;
  const db = await getReaderVerseThemesDatabase(cwd);
  if (!db || keys.length === 0) return [];

  const pairs: { c: number; s: number }[] = [];
  for (const key of keys) {
    const [ca, su] = key.split("-");
    const c = Number(ca);
    const s = Number(su);
    if (!Number.isFinite(c) || !Number.isFinite(s)) continue;
    pairs.push({ c, s });
  }
  if (!pairs.length) return [];

  const parts: string[] = [];
  const params: number[] = [];
  for (const p of pairs) {
    parts.push("(category_id = ? AND sub_id = ?)");
    params.push(p.c, p.s);
  }

  const sql = `
    SELECT book_id, chapter_start, verse_start, chapter_end, verse_end
    FROM verse
    WHERE book_id IS NOT NULL AND TRIM(book_id) != ''
      AND (${parts.join(" OR ")})
  `;
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const collected: VerseRef[] = [];
  while (stmt.step()) {
    const o = stmt.getAsObject() as Record<string, unknown>;
    const bookId = String(o.book_id ?? "")
      .trim()
      .toUpperCase();
    if (!bookId || !/^[A-Z0-9]{2,8}$/.test(bookId)) continue;
    const chStart = Number(o.chapter_start ?? 0);
    const chEnd = Number(o.chapter_end ?? chStart);
    if (!Number.isFinite(chStart) || chStart <= 0) continue;
    if (!Number.isFinite(chEnd) || chEnd !== chStart) continue;
    const ch = chStart;
    const vs = Number(o.verse_start ?? 0);
    const ve = Number(o.verse_end ?? vs);
    if (!Number.isFinite(vs) || vs <= 0) continue;
    collected.push({
      bookId,
      chapter: ch,
      verseStart: vs,
      verseEnd: Number.isFinite(ve) && ve >= vs ? ve : vs,
    });
  }
  stmt.free();

  const seen = new Set<string>();
  const deduped: VerseRef[] = [];
  for (const r of collected) {
    const k = refKey(r);
    if (seen.has(k)) continue;
    seen.add(k);
    deduped.push(r);
  }

  const arr = [...deduped];
  if (shuffle) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = arr[i]!;
      arr[i] = arr[j]!;
      arr[j] = t;
    }
  } else {
    arr.sort((a, b) => refKey(a).localeCompare(refKey(b)));
  }
  return arr.slice(0, max);
}
