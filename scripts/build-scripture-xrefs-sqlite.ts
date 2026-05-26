/**
 * Build curated scripture cross-references SQLite from CrossReferences-org KJV TSV.
 *
 * Usage:
 *   npm run build:scripture-xrefs
 *   npm run build:scripture-xrefs -- --report
 */
import fs from "node:fs";
import path from "node:path";
import { bookIdFromKjvAbbr } from "../lib/bible/crossreferences-kjv-book-map";
import { expandKjvCrossreferenceTargets } from "../lib/bible/parse-crossreferences-kjv-ref";
import { scriptureBooks, testamentForBookNumber } from "../lib/bible/scripture-books";
import {
  SCRIPTURE_XREF_SCHEMA_SQL,
  SCRIPTURE_XREF_SQLITE_FORMAT,
  scriptureXrefSqlitePath,
} from "../lib/bible/scripture-xref-sqlite-path";
import { getSqlJsStatic } from "../lib/bible/sql-js-wasm";

const repoRoot = process.cwd();
const tsvPath = path.join(
  repoRoot,
  "data",
  "bible",
  "cross-references",
  "raw",
  "crossreferences_kjv.tsv",
);
const configPath = path.join(repoRoot, "data", "bible", "cross-references", "xref-curation.config.json");
const overridesPath = path.join(repoRoot, "data", "bible", "cross-references", "curated-overrides.json");

type CurationConfig = {
  maxOutgoingPerVerse: number;
  maxIncomingPerVerse: number;
  /** 单条边低于此分不进入候选（默认 100 = 须跨约） */
  minEdgePriorityToKeep: number;
  /** 该节最高 priority 低于此值则不写入库（除非 override add） */
  minVersePriorityToPublish: number;
  requireCrossTestamentEdge: boolean;
  skipEmptyAnchors: boolean;
  priority: {
    crossTestament: number;
    highFrequencyTarget: number;
    multiAnchorConsensus: number;
    sameBook: number;
  };
  highFrequencyTargetMinIncoming: number;
};

type EdgeDraft = {
  fromBookId: string;
  fromChapter: number;
  fromVerse: number;
  toBookId: string;
  toChapter: number;
  toVerseStart: number;
  toVerseEnd: number;
  priority: number;
};

type OverrideRef = {
  bookId: string;
  chapter: number;
  verse?: number;
  verseStart?: number;
  verseEnd?: number;
};

const bookNumberById = new Map(scriptureBooks.map((b) => [b.bookId, b.bookNumber]));

function loadConfig(): CurationConfig {
  const raw = JSON.parse(fs.readFileSync(configPath, "utf8")) as Partial<CurationConfig>;
  return {
    maxOutgoingPerVerse: raw.maxOutgoingPerVerse ?? 5,
    maxIncomingPerVerse: raw.maxIncomingPerVerse ?? 4,
    minEdgePriorityToKeep: raw.minEdgePriorityToKeep ?? 100,
    minVersePriorityToPublish: raw.minVersePriorityToPublish ?? 120,
    requireCrossTestamentEdge: raw.requireCrossTestamentEdge ?? true,
    skipEmptyAnchors: raw.skipEmptyAnchors ?? true,
    priority: {
      crossTestament: raw.priority?.crossTestament ?? 100,
      highFrequencyTarget: raw.priority?.highFrequencyTarget ?? 50,
      multiAnchorConsensus: raw.priority?.multiAnchorConsensus ?? 20,
      sameBook: raw.priority?.sameBook ?? 10,
    },
    highFrequencyTargetMinIncoming: raw.highFrequencyTargetMinIncoming ?? 12,
  };
}

function edgeKey(e: Pick<EdgeDraft, "fromBookId" | "fromChapter" | "fromVerse" | "toBookId" | "toChapter" | "toVerseStart">): string {
  return `${e.fromBookId}:${e.fromChapter}:${e.fromVerse}->${e.toBookId}:${e.toChapter}:${e.toVerseStart}`;
}

function isCrossTestament(fromBookId: string, toBookId: string): boolean {
  const a = bookNumberById.get(fromBookId);
  const b = bookNumberById.get(toBookId);
  if (a == null || b == null) return false;
  return testamentForBookNumber(a) !== testamentForBookNumber(b);
}

function parseTsv(cwd: string, config: CurationConfig): EdgeDraft[] {
  if (!fs.existsSync(tsvPath)) {
    throw new Error(`Missing ${tsvPath}. Download CrossReferences-org KJV TSV first.`);
  }
  const lines = fs.readFileSync(tsvPath, "utf8").split(/\r?\n/);
  const byFrom = new Map<
    string,
    { fromBookId: string; fromChapter: number; fromVerse: number; targets: Map<string, { edge: EdgeDraft; consensus: number }> }
  >();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (!line.trim() || i === 0) continue;
    const parts = line.split("\t");
    if (parts.length < 5) continue;
    const [bookAbbr, chStr, vStr, anchor, refsRaw] = parts;
    if (config.skipEmptyAnchors && !String(anchor || "").trim()) continue;
    const fromBookId = bookIdFromKjvAbbr(bookAbbr!);
    if (!fromBookId) continue;
    const fromChapter = Number(chStr);
    const fromVerse = Number(vStr);
    if (!Number.isInteger(fromChapter) || !Number.isInteger(fromVerse)) continue;

    const fromKey = `${fromBookId}:${fromChapter}:${fromVerse}`;
    let bucket = byFrom.get(fromKey);
    if (!bucket) {
      bucket = { fromBookId, fromChapter, fromVerse, targets: new Map() };
      byFrom.set(fromKey, bucket);
    }

    for (const refToken of String(refsRaw || "").split("|")) {
      for (const t of refToken.split("; ")) {
        const parsed = expandKjvCrossreferenceTargets(t);
        for (const p of parsed) {
          const draft: EdgeDraft = {
            fromBookId,
            fromChapter,
            fromVerse,
            toBookId: p.bookId,
            toChapter: p.chapter,
            toVerseStart: p.verseStart,
            toVerseEnd: p.verseEnd,
            priority: 0,
          };
          const k = edgeKey(draft);
          const hit = bucket.targets.get(k);
          if (hit) hit.consensus += 1;
          else bucket.targets.set(k, { edge: draft, consensus: 1 });
        }
      }
    }
  }

  const incomingCount = new Map<string, number>();
  for (const bucket of byFrom.values()) {
    for (const { edge } of bucket.targets.values()) {
      const ik = `${edge.toBookId}:${edge.toChapter}:${edge.toVerseStart}`;
      incomingCount.set(ik, (incomingCount.get(ik) ?? 0) + 1);
    }
  }

  const highFreq = new Set<string>();
  for (const [ik, n] of incomingCount) {
    if (n >= config.highFrequencyTargetMinIncoming) highFreq.add(ik);
  }

  const all: EdgeDraft[] = [];
  for (const bucket of byFrom.values()) {
    const scored: EdgeDraft[] = [];
    for (const { edge, consensus } of bucket.targets.values()) {
      let priority = 0;
      if (isCrossTestament(bucket.fromBookId, edge.toBookId)) {
        priority += config.priority.crossTestament;
      }
      const ik = `${edge.toBookId}:${edge.toChapter}:${edge.toVerseStart}`;
      if (highFreq.has(ik)) priority += config.priority.highFrequencyTarget;
      if (consensus >= 2) priority += config.priority.multiAnchorConsensus;
      if (edge.toBookId === bucket.fromBookId) priority += config.priority.sameBook;
      scored.push({ ...edge, priority });
    }
    scored.sort((a, b) => b.priority - a.priority || a.toBookId.localeCompare(b.toBookId));
    const pool = scored.filter((e) => e.priority >= config.minEdgePriorityToKeep);
    let kept = pool
      .filter((e) => e.priority >= config.minVersePriorityToPublish)
      .slice(0, config.maxOutgoingPerVerse);
    if (!kept.length) continue;
    if (config.requireCrossTestamentEdge) {
      const hasCross = kept.some((e) => isCrossTestament(bucket.fromBookId, e.toBookId));
      if (!hasCross) continue;
    }
    all.push(...kept);
  }
  return all;
}

function applyOverrides(edges: EdgeDraft[]): EdgeDraft[] {
  if (!fs.existsSync(overridesPath)) return edges;
  const o = JSON.parse(fs.readFileSync(overridesPath, "utf8")) as {
    add?: Array<{ from: OverrideRef; to: OverrideRef; note?: string }>;
    remove?: Array<{ from: OverrideRef; to: OverrideRef }>;
  };
  const map = new Map<string, EdgeDraft>();
  for (const e of edges) map.set(edgeKey(e), e);

  for (const r of o.remove ?? []) {
    const fromVerse = r.from.verse ?? 0;
    const toStart = r.to.verseStart ?? r.to.verse ?? 0;
    const k = `${r.from.bookId}:${r.from.chapter}:${fromVerse}->${r.to.bookId}:${r.to.chapter}:${toStart}`;
    for (const key of map.keys()) {
      if (key.startsWith(k)) map.delete(key);
    }
  }

  for (const a of o.add ?? []) {
    const fromVerse = a.from.verse ?? 0;
    const toStart = a.to.verseStart ?? a.to.verse ?? 0;
    const toEnd = a.to.verseEnd ?? toStart;
    const draft: EdgeDraft = {
      fromBookId: a.from.bookId,
      fromChapter: a.from.chapter,
      fromVerse,
      toBookId: a.to.bookId,
      toChapter: a.to.chapter,
      toVerseStart: toStart,
      toVerseEnd: toEnd,
      priority: 999,
    };
    map.set(edgeKey(draft), draft);
  }

  return [...map.values()];
}

async function writeSqlite(
  edges: EdgeDraft[],
  config: CurationConfig,
): Promise<{ outCount: number; inCount: number }> {
  const SQL = await getSqlJsStatic(repoRoot);
  const db = new SQL.Database();
  db.run(SCRIPTURE_XREF_SCHEMA_SQL);
  const insMeta = db.prepare("INSERT INTO meta (key, value) VALUES (?, ?)");
  insMeta.run(["format", SCRIPTURE_XREF_SQLITE_FORMAT]);
  insMeta.run(["source", "crossreferences-org-kjv"]);
  insMeta.run(["curation_version", "1"]);
  insMeta.run(["built_at", new Date().toISOString()]);
  insMeta.free();

  const insOut = db.prepare(
    `INSERT INTO xref_out (from_book_id, from_chapter, from_verse, to_book_id, to_chapter, to_verse_start, to_verse_end, priority)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insIn = db.prepare(
    `INSERT INTO xref_in (to_book_id, to_chapter, to_verse, from_book_id, from_chapter, from_verse, priority)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );

  const inDedup = new Map<
    string,
    {
      toBookId: string;
      toChapter: number;
      toVerse: number;
      fromBookId: string;
      fromChapter: number;
      fromVerse: number;
      priority: number;
    }
  >();
  for (const e of edges) {
    for (let v = e.toVerseStart; v <= e.toVerseEnd; v++) {
      const ik = `${e.toBookId}:${e.toChapter}:${v}:${e.fromBookId}:${e.fromChapter}:${e.fromVerse}`;
      const prev = inDedup.get(ik);
      if (!prev || e.priority > prev.priority) {
        inDedup.set(ik, {
          toBookId: e.toBookId,
          toChapter: e.toChapter,
          toVerse: v,
          fromBookId: e.fromBookId,
          fromChapter: e.fromChapter,
          fromVerse: e.fromVerse,
          priority: e.priority,
        });
      }
    }
  }

  let inCount = 0;
  db.run("BEGIN TRANSACTION");
  try {
    for (const e of edges) {
      insOut.run([
        e.fromBookId,
        e.fromChapter,
        e.fromVerse,
        e.toBookId,
        e.toChapter,
        e.toVerseStart,
        e.toVerseEnd,
        e.priority,
      ]);
    }
    const incomingByVerse = new Map<
      string,
      {
        toBookId: string;
        toChapter: number;
        toVerse: number;
        fromBookId: string;
        fromChapter: number;
        fromVerse: number;
        priority: number;
      }[]
    >();
    for (const row of inDedup.values()) {
      const vk = `${row.toBookId}:${row.toChapter}:${row.toVerse}`;
      const arr = incomingByVerse.get(vk) ?? [];
      arr.push(row);
      incomingByVerse.set(vk, arr);
    }
    for (const rows of incomingByVerse.values()) {
      rows.sort((a, b) => b.priority - a.priority);
      for (const row of rows.slice(0, config.maxIncomingPerVerse)) {
        insIn.run([
          row.toBookId,
          row.toChapter,
          row.toVerse,
          row.fromBookId,
          row.fromChapter,
          row.fromVerse,
          row.priority,
        ]);
        inCount += 1;
      }
    }
    db.run("COMMIT");
  } catch (err) {
    db.run("ROLLBACK");
    throw err;
  }
  insOut.free();
  insIn.free();

  const outPath = scriptureXrefSqlitePath(repoRoot);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const bytes = db.export();
  fs.writeFileSync(outPath, Buffer.from(bytes));
  db.close();

  return { outCount: edges.length, inCount };
}

function printReport(edges: EdgeDraft[]) {
  const samples: Array<{ bookId: string; chapter: number; label: string }> = [
    { bookId: "LUK", chapter: 4, label: "Luke 4" },
    { bookId: "ACT", chapter: 2, label: "Acts 2" },
    { bookId: "HEB", chapter: 8, label: "Heb 8" },
    { bookId: "ISA", chapter: 61, label: "Isa 61" },
    { bookId: "JOL", chapter: 2, label: "Joel 2" },
  ];

  const versesWithXref = new Set(edges.map((e) => `${e.fromBookId}:${e.fromChapter}:${e.fromVerse}`));
  const byFrom = new Map<string, EdgeDraft[]>();
  for (const e of edges) {
    const k = `${e.fromBookId}:${e.fromChapter}:${e.fromVerse}`;
    const arr = byFrom.get(k) ?? [];
    arr.push(e);
    byFrom.set(k, arr);
  }

  console.log("\n--- scripture-xrefs build report ---");
  console.log(`outgoing edges: ${edges.length}`);
  console.log(`verses with ≥1 outgoing: ${versesWithXref.size}`);
  const avg = versesWithXref.size ? (edges.length / versesWithXref.size).toFixed(2) : "0";
  console.log(`avg outgoing per marked verse: ${avg}`);

  for (const s of samples) {
    console.log(`\n[${s.label}]`);
    const inChapter = [...byFrom.entries()].filter(([k]) => k.startsWith(`${s.bookId}:${s.chapter}:`));
    if (!inChapter.length) {
      console.log("  (no outgoing in chapter)");
    }
    for (const [k, list] of inChapter.sort(([a], [b]) => a.localeCompare(b))) {
      const verse = Number(k.split(":")[2]);
      const tops = list
        .sort((a, b) => b.priority - a.priority)
        .slice(0, 5)
        .map((e) => `${e.toBookId} ${e.toChapter}:${e.toVerseStart}${e.toVerseEnd > e.toVerseStart ? `-${e.toVerseEnd}` : ""}`)
        .join(", ");
      console.log(`  v${verse} (${list.length}): ${tops}`);
    }
  }
  console.log("\n--- end report ---\n");
}

async function main() {
  const report = process.argv.includes("--report");
  const config = loadConfig();
  let edges = parseTsv(repoRoot, config);
  edges = applyOverrides(edges);
  const { outCount, inCount } = await writeSqlite(edges, config);
  const mb = (fs.statSync(scriptureXrefSqlitePath(repoRoot)).size / (1024 * 1024)).toFixed(2);
  console.log(`Wrote ${scriptureXrefSqlitePath(repoRoot)} (${mb} MB)`);
  console.log(`xref_out: ${outCount} rows, xref_in: ${inCount} rows`);
  if (report) printReport(edges);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
