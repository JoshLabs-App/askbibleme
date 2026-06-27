import fs from "node:fs";
import type { Database } from "sql.js";
import { NextResponse } from "next/server";
import { chineseBookNameToBookId } from "@/lib/bible/chinese-book-name-to-id";
import { canonicalLabel } from "@/lib/scripture/reader-verse-themes-bucket";
import {
  enrichVerseRepeatRankItems,
  enrichVerseRepeatRankThemeLabels,
  parseVerseRepeatRankSortBy,
  parseVerseRepeatRankTestament,
  queryVerseRepeatRankPage,
} from "@/lib/scripture/reader-verse-repeat-rank";
import {
  deleteVersesFromReaderThemeLibrary,
  parseVerseRepeatRankRowKey,
  persistReaderVerseThemesDatabase,
} from "@/lib/scripture/reader-verse-themes-mutations";
import { getReaderVerseThemesDatabase, readerVerseThemesSqlitePath } from "@/lib/scripture/reader-verse-themes-db";
import { isStudioDiskSaveAllowed } from "@/lib/studio-disk-save";

function disk403() {
  return NextResponse.json(
    {
      error:
        "未允许读/写磁盘：开发环境默认可用；生产请设置 STUDIO_ALLOW_DISK_SAVE=1、STUDIO_WRITE_SECRET，并携带 Authorization: Bearer …",
    },
    { status: 403 },
  );
}

export async function GET(req: Request) {
  if (!isStudioDiskSaveAllowed(req)) return disk403();

  const cwd = process.cwd();
  const url = new URL(req.url);
  const mode = (url.searchParams.get("mode") ?? "meta").trim();

  let db: Database | null;
  try {
    db = await getReaderVerseThemesDatabase(cwd);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }

  if (!db) {
    return NextResponse.json(
      {
        ok: false,
        missingDb: true,
        message:
          "未找到 data/scripture/reader-verse-themes.sqlite。请将 BIBLE 的 reader_zh_cn_verse_categories.json 用 npm run import:reader-verse-themes 导入。",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    if (mode === "meta") {
      const catC = db.exec("SELECT COUNT(*) AS c FROM category")[0]?.values[0]?.[0];
      const subC = db.exec("SELECT COUNT(*) AS c FROM subcategory")[0]?.values[0]?.[0];
      const verC = db.exec("SELECT COUNT(*) AS c FROM verse")[0]?.values[0]?.[0];
      return NextResponse.json(
        {
          ok: true,
          categoryCount: Number(catC ?? 0),
          subcategoryCount: Number(subC ?? 0),
          verseRowCount: Number(verC ?? 0),
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    if (mode === "index") {
      const stmt = db.prepare(`
        SELECT c.id AS category_id, c.name AS category_name, c.position AS category_position,
               s.id AS sub_id, s.name AS sub_name, s.title AS sub_title,
               s.advertised_verse_count AS verse_count, s.position AS sub_position, s.bucket AS bucket
        FROM subcategory s
        JOIN category c ON c.id = s.category_id
        ORDER BY c.position, s.position
      `);
      const rows: unknown[] = [];
      while (stmt.step()) {
        const o = stmt.getAsObject() as Record<string, unknown>;
        const categoryId = Number(o.category_id);
        const subId = Number(o.sub_id);
        const name = String(o.sub_name ?? "");
        const displayName = canonicalLabel(name);
        rows.push({
          key: `${categoryId}-${subId}`,
          categoryId,
          categoryName: String(o.category_name ?? ""),
          categoryPosition: Number(o.category_position ?? 0),
          name,
          displayName,
          title: String(o.sub_title ?? ""),
          position: Number(o.sub_position ?? 0),
          verseCount: Number(o.verse_count ?? 0),
          bucket: String(o.bucket ?? "复合标签"),
        });
      }
      stmt.free();
      return NextResponse.json({ ok: true, rows }, { headers: { "Cache-Control": "no-store" } });
    }

    if (mode === "verses") {
      const categoryId = Number(url.searchParams.get("categoryId") ?? "");
      const subId = Number(url.searchParams.get("subId") ?? "");
      const limit = Math.min(80, Math.max(1, Number(url.searchParams.get("limit") ?? 40)));
      const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0));
      if (!Number.isFinite(categoryId) || !Number.isFinite(subId)) {
        return NextResponse.json({ ok: false, error: "缺少 categoryId / subId" }, { status: 400 });
      }

      const cntStmt = db.prepare(
        "SELECT COUNT(*) AS c FROM verse WHERE category_id = ? AND sub_id = ?",
      );
      cntStmt.bind([categoryId, subId]);
      cntStmt.step();
      const total = Number((cntStmt.getAsObject() as { c?: unknown }).c ?? 0);
      cntStmt.free();

      const stmt = db.prepare(`
        SELECT position, reference, book, book_id, chapter_start, verse_start, chapter_end, verse_end, verse_text
        FROM verse
        WHERE category_id = ? AND sub_id = ?
        ORDER BY position
        LIMIT ? OFFSET ?
      `);
      stmt.bind([categoryId, subId, limit, offset]);
      const items: unknown[] = [];
      while (stmt.step()) {
        const o = stmt.getAsObject() as Record<string, unknown>;
        const book = String(o.book ?? "");
        const bookIdRaw = o.book_id != null && String(o.book_id).trim() ? String(o.book_id).trim() : null;
        const bookId = bookIdRaw ?? chineseBookNameToBookId(book);
        const ch = Number(o.chapter_start ?? 0);
        const readHref =
          bookId && ch > 0 ? `/read/${encodeURIComponent(bookId)}/${encodeURIComponent(String(ch))}` : null;
        items.push({
          position: Number(o.position ?? 0),
          reference: String(o.reference ?? ""),
          book,
          bookId,
          chapterStart: ch,
          verseStart: Number(o.verse_start ?? 0),
          chapterEnd: Number(o.chapter_end ?? ch),
          verseEnd: Number(o.verse_end ?? 0),
          text: String(o.verse_text ?? ""),
          readHref,
        });
      }
      stmt.free();

      return NextResponse.json(
        { ok: true, total, limit, offset, items },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    if (mode === "verse-repeat-rank") {
      const limit = Math.min(500, Math.max(1, Number(url.searchParams.get("limit") ?? 100)));
      const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0));
      const q = (url.searchParams.get("q") ?? "").trim();
      const minCount = url.searchParams.get("minCount");
      const maxCount = url.searchParams.get("maxCount");
      const sortBy = parseVerseRepeatRankSortBy(url.searchParams.get("sortBy"));
      const testament = parseVerseRepeatRankTestament(url.searchParams.get("testament"));
      const dbPath = readerVerseThemesSqlitePath(cwd);
      const mtimeMs = fs.existsSync(dbPath) ? fs.statSync(dbPath).mtimeMs : 0;
      const page = queryVerseRepeatRankPage(db, {
        limit,
        offset,
        q,
        minCount,
        maxCount,
        sortBy,
        testament,
        mtimeMs,
      });
      enrichVerseRepeatRankThemeLabels(db, page.items);
      await enrichVerseRepeatRankItems(page.items);
      return NextResponse.json(
        { ok: true, ...page },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    return NextResponse.json({ ok: false, error: "未知 mode" }, { status: 400 });
  } finally {
    /* db 为进程内缓存，不在此关闭 */
  }
}

type BatchDeletePayload = {
  action?: string;
  rowKeys?: unknown;
};

export async function POST(req: Request) {
  if (!isStudioDiskSaveAllowed(req)) return disk403();

  const cwd = process.cwd();
  let payload: BatchDeletePayload;
  try {
    payload = (await req.json()) as BatchDeletePayload;
  } catch {
    return NextResponse.json({ ok: false, error: "请求体不是合法 JSON" }, { status: 400 });
  }

  if (payload.action !== "batch-delete-verses") {
    return NextResponse.json({ ok: false, error: "未知 action" }, { status: 400 });
  }

  const rawKeys = Array.isArray(payload.rowKeys) ? payload.rowKeys : null;
  if (!rawKeys || rawKeys.length === 0) {
    return NextResponse.json({ ok: false, error: "rowKeys 必须是非空数组" }, { status: 400 });
  }

  const coords = rawKeys
    .map((k) => parseVerseRepeatRankRowKey(String(k ?? "")))
    .filter((c): c is NonNullable<typeof c> => c != null);
  if (coords.length === 0) {
    return NextResponse.json({ ok: false, error: "没有有效的 rowKeys" }, { status: 400 });
  }

  let db: Database | null;
  try {
    db = await getReaderVerseThemesDatabase(cwd);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }

  if (!db) {
    return NextResponse.json(
      {
        ok: false,
        missingDb: true,
        message: "未找到 data/scripture/reader-verse-themes.sqlite。",
      },
      { status: 404 },
    );
  }

  try {
    const result = deleteVersesFromReaderThemeLibrary(db, coords);
    persistReaderVerseThemesDatabase(cwd, db);
    return NextResponse.json(
      { ok: true, ...result, requested: rawKeys.length },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
