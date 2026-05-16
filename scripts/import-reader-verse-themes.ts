/**
 * 将桌面 BIBLE 项目 `reader_zh_cn_verse_categories.json` 导入为
 * `data/scripture/reader-verse-themes.sqlite`（供后台「金句主题」标签墙读取）。
 * 不写入任何第三方来源元数据或外链（无 import_meta、无站点 URL、无源文件路径）。
 *
 * 用法（仓库根目录）：
 *   npx tsx scripts/import-reader-verse-themes.ts /path/to/reader_zh_cn_verse_categories.json
 *
 * 大文件（约 40MB+ JSON）解析需要足够内存；失败时可：
 *   NODE_OPTIONS=--max-old-space-size=8192 npx tsx scripts/import-reader-verse-themes.ts ...
 */
import fs from "node:fs";
import path from "node:path";
import initSqlJs from "sql.js";
import { chineseBookNameToBookId } from "../lib/bible/chinese-book-name-to-id";
import { classifyReaderThemeBucket, canonicalLabel } from "../lib/scripture/reader-verse-themes-bucket";
import {
  invalidateReaderVerseThemesDbCache,
  READER_VERSE_THEMES_SCHEMA_SQL,
  readerVerseThemesSqlitePath,
} from "../lib/scripture/reader-verse-themes-db";

type VerseIn = {
  position?: number;
  reference?: string;
  book?: string;
  chapter_start?: number;
  verse_start?: number;
  chapter_end?: number;
  verse_end?: number;
  verse_text?: string;
};

type SubIn = {
  id: number;
  category_id?: number;
  name: string;
  slug?: string;
  title?: string;
  advertised_verse_count?: number;
  position?: number;
  verses?: VerseIn[];
};

type CatIn = {
  id: number;
  name: string;
  slug?: string;
  position?: number;
  subcategories?: SubIn[];
};

type Root = {
  categories?: CatIn[];
};

function main() {
  const src = process.argv[2]?.trim();
  if (!src) {
    console.error("用法: npx tsx scripts/import-reader-verse-themes.ts <reader_zh_cn_verse_categories.json>");
    process.exit(1);
  }
  const absSrc = path.isAbsolute(src) ? src : path.join(process.cwd(), src);
  if (!fs.existsSync(absSrc)) {
    console.error(`找不到文件: ${absSrc}`);
    process.exit(1);
  }

  void run(absSrc).catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

async function run(absSrc: string) {
  const cwd = process.cwd();
  const outAbs = readerVerseThemesSqlitePath(cwd);
  fs.mkdirSync(path.dirname(outAbs), { recursive: true });

  console.error(`读取 JSON: ${absSrc}`);
  const raw = fs.readFileSync(absSrc, "utf8");
  const data = JSON.parse(raw) as Root;
  const categories = data.categories ?? [];
  if (!categories.length) {
    throw new Error("JSON 中无 categories");
  }

  const wasmPath = path.join(cwd, "node_modules", "sql.js", "dist", "sql-wasm.wasm");
  const SQL = await initSqlJs({ locateFile: () => wasmPath });
  const db = new SQL.Database();
  db.run(READER_VERSE_THEMES_SCHEMA_SQL);

  const insCat = db.prepare("INSERT INTO category (id, name, slug, position) VALUES (?, ?, ?, ?)");
  const insSub = db.prepare(
    "INSERT INTO subcategory (category_id, id, name, slug, title, advertised_verse_count, position, bucket) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const insVer = db.prepare(
    "INSERT INTO verse (category_id, sub_id, position, reference, book, book_id, chapter_start, verse_start, chapter_end, verse_end, verse_text) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );

  db.run("BEGIN TRANSACTION");
  try {
    for (const c of categories) {
      insCat.run([c.id, String(c.name ?? ""), String(c.slug ?? "") || null, Number(c.position ?? 0)]);
      const subs = c.subcategories ?? [];
      for (const s of subs) {
        const displayName = canonicalLabel(s.name);
        const bucket = classifyReaderThemeBucket({
          name: s.name,
          categoryName: c.name,
          displayName,
        });
        const adv = Number(s.advertised_verse_count ?? (s.verses ?? []).length ?? 0);
        insSub.run([
          c.id,
          s.id,
          String(s.name ?? ""),
          String(s.slug ?? "") || null,
          String(s.title ?? "") || null,
          adv,
          Number(s.position ?? 0),
          bucket,
        ]);
        const verses = s.verses ?? [];
        let pos = 0;
        for (const v of verses) {
          pos += 1;
          const book = String(v.book ?? "").trim();
          const bookId = chineseBookNameToBookId(book);
          insVer.run([
            c.id,
            s.id,
            Number(v.position ?? pos),
            String(v.reference ?? "") || null,
            book || null,
            bookId,
            Number(v.chapter_start ?? 0),
            Number(v.verse_start ?? 0),
            Number(v.chapter_end ?? v.chapter_start ?? 0),
            Number(v.verse_end ?? v.verse_start ?? 0),
            String(v.verse_text ?? ""),
          ]);
        }
      }
    }
    db.run("COMMIT");
  } catch (e) {
    db.run("ROLLBACK");
    throw e;
  } finally {
    insCat.free();
    insSub.free();
    insVer.free();
  }

  const bin = db.export();
  db.close();
  fs.writeFileSync(outAbs, Buffer.from(bin));
  invalidateReaderVerseThemesDbCache();
  console.error(`已写入: ${outAbs}`);
}

main();
