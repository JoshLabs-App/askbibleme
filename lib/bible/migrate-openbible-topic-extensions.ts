import fs from "node:fs";
import path from "node:path";
import initSqlJs from "sql.js";
import { inferCompanionDirectionFlags } from "@/lib/bible/openbible-companion-direction-infer";
import { computeOpenbibleOsisVerseCount } from "@/lib/bible/openbible-osis-verse-count";
import { openbibleTopicsSqlitePath } from "@/lib/bible/openbible-topics-db";
import {
  readOpenbibleTopicZhOverridesMap,
  resolveOpenbibleTopicZh,
} from "@/lib/bible/openbible-topic-zh-resolve";

function pragmaColumnNames(db: {
  prepare: (sql: string) => { step: () => boolean; getAsObject: () => Record<string, unknown>; free: () => void };
}): Set<string> {
  const names = new Set<string>();
  const info = db.prepare("PRAGMA table_info(openbible_topic_row)");
  while (info.step()) {
    const o = info.getAsObject() as { name?: string };
    const n = String(o.name ?? "");
    if (n) names.add(n);
  }
  info.free();
  return names;
}

/**
 * 一次打开 SQLite：补齐 `verse_count` 与陪伴方向三列（dir_quiet / dir_pray / dir_form），写回磁盘。
 */
export async function migrateOpenbibleTopicExtensionsInPlace(cwd: string): Promise<void> {
  const abs = openbibleTopicsSqlitePath(cwd);
  if (!fs.existsSync(abs)) {
    throw new Error("OPENBIBLE_SQLITE_MISSING");
  }

  const wasmPath = path.join(cwd, "node_modules", "sql.js", "dist", "sql-wasm.wasm");
  const SQL = await initSqlJs({ locateFile: () => wasmPath });
  const buf = fs.readFileSync(abs);
  const db = new SQL.Database(new Uint8Array(buf));

  try {
    const cols = pragmaColumnNames(db);

    if (!cols.has("verse_count")) {
      try {
        db.run("ALTER TABLE openbible_topic_row ADD COLUMN verse_count INTEGER");
      } catch {
        /* ignore */
      }
    }

    if (!cols.has("dir_quiet")) {
      try {
        db.run("ALTER TABLE openbible_topic_row ADD COLUMN dir_quiet INTEGER DEFAULT 0");
      } catch {
        /* ignore */
      }
    }
    if (!cols.has("dir_pray")) {
      try {
        db.run("ALTER TABLE openbible_topic_row ADD COLUMN dir_pray INTEGER DEFAULT 0");
      } catch {
        /* ignore */
      }
    }
    if (!cols.has("dir_form")) {
      try {
        db.run("ALTER TABLE openbible_topic_row ADD COLUMN dir_form INTEGER DEFAULT 0");
      } catch {
        /* ignore */
      }
    }

    let sel = db.prepare("SELECT id, osis FROM openbible_topic_row");
    while (sel.step()) {
      const o = sel.getAsObject() as { id?: number; osis?: string };
      const id = Number(o.id);
      const osis = String(o.osis ?? "");
      const vc = computeOpenbibleOsisVerseCount(osis);
      db.run("UPDATE openbible_topic_row SET verse_count = ? WHERE id = ?", [vc, id]);
    }
    sel.free();

    const overrides = readOpenbibleTopicZhOverridesMap(cwd);
    sel = db.prepare("SELECT id, topic FROM openbible_topic_row");
    while (sel.step()) {
      const o = sel.getAsObject() as { id?: number; topic?: string };
      const id = Number(o.id);
      const topic = String(o.topic ?? "");
      const zh = resolveOpenbibleTopicZh(cwd, topic, overrides);
      const f = inferCompanionDirectionFlags(topic, zh);
      db.run("UPDATE openbible_topic_row SET dir_quiet = ?, dir_pray = ?, dir_form = ? WHERE id = ?", [
        f.quiet ? 1 : 0,
        f.pray ? 1 : 0,
        f.form ? 1 : 0,
        id,
      ]);
    }
    sel.free();

    db.run("CREATE INDEX IF NOT EXISTS idx_openbible_verse_count ON openbible_topic_row(verse_count)");
    db.run("CREATE INDEX IF NOT EXISTS idx_openbible_dir_quiet ON openbible_topic_row(dir_quiet)");
    db.run("CREATE INDEX IF NOT EXISTS idx_openbible_dir_pray ON openbible_topic_row(dir_pray)");
    db.run("CREATE INDEX IF NOT EXISTS idx_openbible_dir_form ON openbible_topic_row(dir_form)");

    fs.writeFileSync(abs, Buffer.from(db.export()));
  } finally {
    db.close();
  }
}
