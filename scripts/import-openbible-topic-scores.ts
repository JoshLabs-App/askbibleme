/**
 * 将 OpenBible.info 导出的 topic-scores TSV 导入本地 SQLite（供后台浏览）。
 *
 * 用法：
 *   npx tsx scripts/import-openbible-topic-scores.ts [path/to/file.tsv]
 *
 * 默认读取：data/bible/openbible-topic-scores.tsv
 * 输出：data/bible/openbible-topics.sqlite
 */
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import initSqlJs from "sql.js";
import {
  invalidateOpenbibleTopicsDbCache,
  openbibleTopicsSqlitePath,
  OPENBIBLE_TOPICS_DDL,
} from "../lib/bible/openbible-topics-db";
import { inferCompanionDirectionFlags } from "../lib/bible/openbible-companion-direction-infer";
import { computeOpenbibleOsisVerseCount } from "../lib/bible/openbible-osis-verse-count";
import { readOpenbibleTopicZhOverridesMap, resolveOpenbibleTopicZh } from "../lib/bible/openbible-topic-zh-resolve";

function parseLine(line: string): { topic: string; osis: string; qualityScore: number } | null {
  const parts = line.split("\t");
  if (parts.length < 3) return null;
  const topic = String(parts[0] ?? "").trim();
  const osis = String(parts[1] ?? "").trim();
  const scoreRaw = String(parts[2] ?? "").trim();
  if (!topic || topic === "Topic" || !osis) return null;
  const qualityScore = Number.parseInt(scoreRaw, 10);
  if (!Number.isFinite(qualityScore)) return null;
  return { topic, osis, qualityScore };
}

async function main() {
  const cwd = process.cwd();
  const argPath = process.argv[2]?.trim();
  const tsvRel = argPath || "data/bible/openbible-topic-scores.tsv";
  const tsvAbs = path.isAbsolute(tsvRel) ? tsvRel : path.join(cwd, tsvRel);
  if (!fs.existsSync(tsvAbs)) {
    console.error(`找不到 TSV：${tsvAbs}`);
    console.error("请将 OpenBible topic-scores 文件放到该路径，或传入绝对/相对路径。");
    process.exit(1);
  }

  const outAbs = openbibleTopicsSqlitePath(cwd);
  fs.mkdirSync(path.dirname(outAbs), { recursive: true });
  if (fs.existsSync(outAbs)) {
    fs.unlinkSync(outAbs);
  }

  const wasmPath = path.join(cwd, "node_modules", "sql.js", "dist", "sql-wasm.wasm");
  const SQL = await initSqlJs({ locateFile: () => wasmPath });
  const db = new SQL.Database();
  db.run(OPENBIBLE_TOPICS_DDL);

  const zhOverrides = readOpenbibleTopicZhOverridesMap(cwd);
  const insert = db.prepare(
    "INSERT INTO openbible_topic_row (topic, osis, quality_score, verse_count, dir_quiet, dir_pray, dir_form) VALUES (?, ?, ?, ?, ?, ?, ?)",
  );

  let n = 0;
  let skipped = 0;
  const rl = readline.createInterface({
    input: fs.createReadStream(tsvAbs, { encoding: "utf-8" }),
    crlfDelay: Infinity,
  });

  db.run("BEGIN");
  try {
    for await (const line of rl) {
      const row = parseLine(line);
      if (!row) {
        skipped++;
        continue;
      }
      const vc = computeOpenbibleOsisVerseCount(row.osis);
      const zh = resolveOpenbibleTopicZh(cwd, row.topic, zhOverrides);
      const d = inferCompanionDirectionFlags(row.topic, zh);
      insert.run([
        row.topic,
        row.osis,
        row.qualityScore,
        vc === null ? null : vc,
        d.quiet ? 1 : 0,
        d.pray ? 1 : 0,
        d.form ? 1 : 0,
      ]);
      n++;
    }
    db.run("COMMIT");
  } catch (e) {
    try {
      db.run("ROLLBACK");
    } catch {
      /* ignore */
    }
    throw e;
  } finally {
    insert.free();
  }

  const iso = new Date().toISOString();
  db.run("INSERT OR REPLACE INTO openbible_import_meta (key, value) VALUES ('source_tsv', ?)", [tsvAbs]);
  db.run("INSERT OR REPLACE INTO openbible_import_meta (key, value) VALUES ('imported_at', ?)", [iso]);
  db.run("INSERT OR REPLACE INTO openbible_import_meta (key, value) VALUES ('row_count', ?)", [String(n)]);

  const binary = db.export();
  fs.writeFileSync(outAbs, Buffer.from(binary));
  db.close();
  invalidateOpenbibleTopicsDbCache();

  console.log(`已导入 ${n} 行，跳过 ${skipped} 行（表头或无效行）。`);
  console.log(`SQLite：${outAbs}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
