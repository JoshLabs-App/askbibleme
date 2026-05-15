import { NextResponse } from "next/server";
import { isStudioDiskSaveAllowed } from "@/lib/studio-disk-save";
import {
  getOpenbibleTopicsDatabase,
  invalidateOpenbibleTopicsDbCache,
  openbibleTopicsDbHasCompanionDirectionColumns,
  openbibleTopicsDbHasVerseCountColumn,
} from "@/lib/bible/openbible-topics-db";
import { migrateOpenbibleTopicExtensionsInPlace } from "@/lib/bible/migrate-openbible-topic-extensions";
import { parseOpenbibleOsisToVerseSpan } from "@/lib/bible/osis-openbible-book";
import type { AppLocale } from "@/lib/i18n/config";
import {
  formatVerseRefFootnote,
  resolveVerseRefToHomeEntry,
} from "@/lib/bible/resolve-verse-range-for-display";
import type { VerseRef } from "@/lib/bible/verse-ref";
import { computeOpenbibleOsisVerseCount } from "@/lib/bible/openbible-osis-verse-count";
import { inferCompanionDirectionFlags } from "@/lib/bible/openbible-companion-direction-infer";
import { formatOpenbibleOsisForLocale } from "@/lib/bible/format-openbible-osis-display";
import {
  findTopicsMatchingChineseTopicQuery,
  looksLikeChineseTopicQuery,
} from "@/lib/bible/openbible-topic-zh-search";
import {
  readOpenbibleTopicZhOverridesMap,
  resolveOpenbibleTopicZh,
} from "@/lib/bible/openbible-topic-zh-resolve";

export const dynamic = "force-dynamic";

function disk403() {
  return NextResponse.json(
    {
      error:
        "未允许读磁盘：开发环境默认可用；生产请设置 STUDIO_ALLOW_DISK_SAVE=1、STUDIO_WRITE_SECRET，并携带 Authorization: Bearer …",
    },
    { status: 403 },
  );
}

const MAX_LIMIT = 200;
const MAX_TOPIC_INDEX = 400;

function clampInt(v: string | null, def: number, min: number, max: number): number {
  if (v == null || v === "") return def;
  const n = Number.parseInt(v, 10);
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, n));
}

/** 首字母：a–z、@=数字起头、#=其它 */
function topicFirstCharWhereClause(prefixRaw: string): { sql: string; params: string[] } {
  const p = prefixRaw.trim().toLowerCase();
  if (p === "@") {
    return {
      sql: "substr(trim(topic),1,1) BETWEEN '0' AND '9'",
      params: [],
    };
  }
  if (p === "#") {
    return {
      sql: `lower(substr(trim(topic),1,1)) NOT BETWEEN 'a' AND 'z'
            AND substr(trim(topic),1,1) NOT BETWEEN '0' AND '9'`,
      params: [],
    };
  }
  if (p.length === 1 && p >= "a" && p <= "z") {
    return {
      sql: "lower(substr(trim(topic),1,1)) = ?",
      params: [p],
    };
  }
  return { sql: "1=1", params: [] };
}

/** SQLite 变量数上限附近分批，避免 `topic IN (…)` 过长。 */
function sqlTopicInClause(matched: string[]): { sql: string; params: string[] } {
  const MAX = 400;
  if (matched.length === 0) return { sql: "1=0", params: [] };
  if (matched.length <= MAX) {
    return {
      sql: `topic IN (${matched.map(() => "?").join(",")})`,
      params: matched,
    };
  }
  const parts: string[] = [];
  const params: string[] = [];
  for (let i = 0; i < matched.length; i += MAX) {
    const slice = matched.slice(i, i + MAX);
    parts.push(`topic IN (${slice.map(() => "?").join(",")})`);
    params.push(...slice);
  }
  return { sql: `(${parts.join(" OR ")})`, params };
}

type VerseBucket = "all" | "1" | "2" | "3" | "4plus" | "unknown";

function parseVerseBucket(raw: string | null): VerseBucket {
  const s = (raw ?? "").trim().toLowerCase();
  if (s === "1" || s === "2" || s === "3") return s;
  if (s === "4plus" || s === "4+") return "4plus";
  if (s === "unknown" || s === "unparsed") return "unknown";
  return "all";
}

type CompanionDirection = "all" | "quiet" | "pray" | "form";

function parseCompanionDirection(raw: string | null): CompanionDirection {
  const s = (raw ?? "").trim().toLowerCase();
  if (s === "quiet" || s === "encourage") return "quiet";
  if (s === "pray" || s === "prayer") return "pray";
  if (s === "form" || s === "formative") return "form";
  return "all";
}

function buildOpenbibleRowSelectCols(verseCountReady: boolean, companionDirectionReady: boolean): string {
  const parts = ["id", "topic", "osis", "quality_score"];
  if (verseCountReady) parts.push("verse_count");
  if (companionDirectionReady) parts.push("dir_quiet", "dir_pray", "dir_form");
  return parts.join(", ");
}

function companionFromRowOrInfer(
  companionDirectionReady: boolean,
  row: { dir_quiet?: unknown; dir_pray?: unknown; dir_form?: unknown },
  topic: string,
  topicZh: string | null,
): { quiet: boolean; pray: boolean; form: boolean } {
  if (companionDirectionReady && row.dir_quiet !== undefined && row.dir_pray !== undefined && row.dir_form !== undefined) {
    return {
      quiet: Number(row.dir_quiet) === 1,
      pray: Number(row.dir_pray) === 1,
      form: Number(row.dir_form) === 1,
    };
  }
  return inferCompanionDirectionFlags(topic, topicZh);
}

function orderByClause(sort: string | null): string {
  switch (sort) {
    case "score_desc":
      return "ORDER BY quality_score DESC, id ASC";
    case "topic_asc":
      return "ORDER BY topic COLLATE NOCASE ASC, id ASC";
    case "osis_asc":
      return "ORDER BY osis COLLATE NOCASE ASC, id ASC";
    default:
      return "ORDER BY id ASC";
  }
}

export async function GET(req: Request) {
  if (!isStudioDiskSaveAllowed(req)) return disk403();

  const cwd = process.cwd();
  let db = await getOpenbibleTopicsDatabase(cwd);
  if (!db) {
    return NextResponse.json(
      {
        ok: false as const,
        error: "NO_DB",
        message: "未找到 data/bible/openbible-topics.sqlite。请运行 npm run import:openbible-topics 导入 TSV。",
      },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (!openbibleTopicsDbHasVerseCountColumn(db) || !openbibleTopicsDbHasCompanionDirectionColumns(db)) {
    try {
      await migrateOpenbibleTopicExtensionsInPlace(cwd);
      invalidateOpenbibleTopicsDbCache();
      const reloaded = await getOpenbibleTopicsDatabase(cwd);
      if (reloaded) db = reloaded;
    } catch {
      /* 只读盘或写入失败时保留旧连接 */
    }
  }

  const zhOverrides = readOpenbibleTopicZhOverridesMap(cwd);
  const verseCountReady = openbibleTopicsDbHasVerseCountColumn(db);
  const companionDirectionReady = openbibleTopicsDbHasCompanionDirectionColumns(db);

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  const includeText = url.searchParams.get("includeText") === "1";
  const locale = (url.searchParams.get("locale") === "en" ? "en" : "zh-CN") as AppLocale;

  const readImportMeta = () => {
    const metaStmt = db.prepare("SELECT key, value FROM openbible_import_meta");
    const meta: Record<string, string> = {};
    while (metaStmt.step()) {
      const o = metaStmt.getAsObject() as { key?: string; value?: string };
      const k = String(o.key ?? "");
      if (k) meta[k] = String(o.value ?? "");
    }
    metaStmt.free();
    return meta;
  };

  const computeFacets = () => {
    const rStmt = db.prepare("SELECT COUNT(*) AS c FROM openbible_topic_row");
    rStmt.step();
    const rowCount = Number((rStmt.getAsObject() as { c?: number }).c ?? 0);
    rStmt.free();

    const dStmt = db.prepare("SELECT COUNT(DISTINCT topic) AS c FROM openbible_topic_row");
    dStmt.step();
    const distinctTopics = Number((dStmt.getAsObject() as { c?: number }).c ?? 0);
    dStmt.free();

    const hStmt = db.prepare(
      "SELECT quality_score AS s, COUNT(*) AS c FROM openbible_topic_row GROUP BY quality_score ORDER BY s DESC",
    );
    const scoreBuckets: { score: number; count: number }[] = [];
    while (hStmt.step()) {
      const o = hStmt.getAsObject() as { s?: number; c?: number };
      scoreBuckets.push({ score: Number(o.s), count: Number(o.c) });
    }
    hStmt.free();

    return { rowCount, distinctTopics, scoreBuckets };
  };

  if (url.searchParams.get("facetsOnly") === "1") {
    const meta = readImportMeta();
    const facets = computeFacets();
    return NextResponse.json(
      { ok: true as const, mode: "facetsOnly" as const, meta, facets },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const topicIndex = url.searchParams.get("topicIndex");
  if (topicIndex === "1") {
    const prefixRaw = (url.searchParams.get("prefix") ?? "a").trim();
    const { sql: preWhere, params: preParams } = topicFirstCharWhereClause(prefixRaw);
    const tLimit = clampInt(url.searchParams.get("limit"), 80, 1, MAX_TOPIC_INDEX);
    const tOffset = clampInt(url.searchParams.get("offset"), 0, 0, 500_000);

    const countSql = `SELECT COUNT(*) AS c FROM (
      SELECT topic FROM openbible_topic_row WHERE ${preWhere} GROUP BY topic
    )`;
    const cStmt = db.prepare(countSql);
    cStmt.bind(preParams);
    cStmt.step();
    const topicTotal = Number((cStmt.getAsObject() as { c?: number }).c ?? 0);
    cStmt.free();

    const listSql = `SELECT topic, COUNT(*) AS n FROM openbible_topic_row
      WHERE ${preWhere}
      GROUP BY topic
      ORDER BY topic COLLATE NOCASE ASC
      LIMIT ? OFFSET ?`;
    const tStmt = db.prepare(listSql);
    tStmt.bind([...preParams, tLimit, tOffset]);
    const topics: { topic: string; count: number; topicZh: string | null }[] = [];
    while (tStmt.step()) {
      const o = tStmt.getAsObject() as { topic?: string; n?: number };
      const topic = String(o.topic ?? "");
      topics.push({
        topic,
        count: Number(o.n ?? 0),
        topicZh: resolveOpenbibleTopicZh(cwd, topic, zhOverrides),
      });
    }
    tStmt.free();

    return NextResponse.json(
      {
        ok: true as const,
        mode: "topicIndex" as const,
        prefix: prefixRaw,
        topicTotal,
        limit: tLimit,
        offset: tOffset,
        topics,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  if (id != null && id.trim() !== "") {
    const rid = Number.parseInt(id, 10);
    if (!Number.isInteger(rid) || rid < 1) {
      return NextResponse.json({ error: "非法 id" }, { status: 400 });
    }
    const rowCols = buildOpenbibleRowSelectCols(verseCountReady, companionDirectionReady);
    const stmt = db.prepare(`SELECT ${rowCols} FROM openbible_topic_row WHERE id = ? LIMIT 1`);
    stmt.bind([rid]);
    if (!stmt.step()) {
      stmt.free();
      return NextResponse.json({ error: "未找到" }, { status: 404 });
    }
    const row = stmt.getAsObject() as {
      id?: number;
      topic?: string;
      osis?: string;
      quality_score?: number;
      verse_count?: number | null;
      dir_quiet?: number | null;
      dir_pray?: number | null;
      dir_form?: number | null;
    };
    stmt.free();

    const topic = String(row.topic ?? "");
    const osis = String(row.osis ?? "");
    const qualityScore = Number(row.quality_score ?? 0);
    const topicZhResolved = resolveOpenbibleTopicZh(cwd, topic, zhOverrides);
    const verseCountRaw = row.verse_count;
    const verseCount =
      verseCountRaw != null && Number.isFinite(Number(verseCountRaw))
        ? Number(verseCountRaw)
        : computeOpenbibleOsisVerseCount(osis);
    const companion = companionFromRowOrInfer(companionDirectionReady, row, topic, topicZhResolved);
    const span = parseOpenbibleOsisToVerseSpan(osis);
    let footnote: string | null = null;
    let previewLines: string[] | null = null;
    let parseNote: string | null = null;

    if (span) {
      const ref: VerseRef = {
        bookId: span.bookId,
        chapter: span.chapter,
        verseStart: span.verseStart,
        verseEnd: span.verseEnd,
      };
      footnote = formatVerseRefFootnote(ref, locale);
      if (includeText) {
        const entry = resolveVerseRefToHomeEntry(cwd, ref, locale, { whenIncomplete: "partial-span" });
        previewLines = entry?.lines?.length ? entry.lines : null;
      }
    } else {
      parseNote =
        locale === "zh-CN"
          ? "OSIS 非单章连续范围（或缩写未收录）：下方为书卷中文替换；完整跨章链请对照原文 OSIS。"
          : "OSIS is not a single-chapter span (or book token unknown): localized tokens below; compare raw OSIS for full range.";
    }

    const osisDisplay = formatOpenbibleOsisForLocale(osis, locale);

    return NextResponse.json(
      {
        ok: true as const,
        row: {
          id: rid,
          topic,
          osis,
          osisDisplay,
          qualityScore,
          verseCount,
          companion,
          topicZh: topicZhResolved,
        },
        footnote,
        previewLines,
        parseNote,
        readHref: span ? `/read/${encodeURIComponent(span.bookId)}/${encodeURIComponent(String(span.chapter))}` : null,
        verseSpan: span
          ? {
              bookId: span.bookId,
              chapter: span.chapter,
              verseStart: span.verseStart,
              verseEnd: span.verseEnd,
            }
          : null,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const topicQ = (url.searchParams.get("topic") ?? "").trim();
  const topicExact = (url.searchParams.get("topicExact") ?? "").trim();
  const osisQ = (url.searchParams.get("osis") ?? "").trim();
  const minScore = url.searchParams.get("minScore");
  const maxScore = url.searchParams.get("maxScore");
  const sort = url.searchParams.get("sort");
  const includeFacets = url.searchParams.get("includeFacets") === "1";
  const limit = clampInt(url.searchParams.get("limit"), 50, 1, MAX_LIMIT);
  const offset = clampInt(url.searchParams.get("offset"), 0, 0, 500_000);
  const verseBucket = parseVerseBucket(url.searchParams.get("verseBucket"));
  const companionDirection = parseCompanionDirection(url.searchParams.get("companionDirection"));

  const where: string[] = [];
  const params: (string | number)[] = [];
  let verseCountFilterIgnored = false;
  let companionDirectionFilterIgnored = false;

  if (topicExact) {
    where.push("topic = ? COLLATE NOCASE");
    params.push(topicExact);
  } else if (topicQ) {
    if (looksLikeChineseTopicQuery(topicQ)) {
      const matched = findTopicsMatchingChineseTopicQuery(db, cwd, topicQ, zhOverrides);
      const { sql, params: inParams } = sqlTopicInClause(matched);
      where.push(sql);
      params.push(...inParams);
    } else {
      where.push("topic LIKE '%' || ? || '%' COLLATE NOCASE");
      params.push(topicQ);
    }
  }
  if (osisQ) {
    where.push("osis LIKE '%' || ? || '%' COLLATE NOCASE");
    params.push(osisQ);
  }
  if (minScore != null && minScore !== "") {
    const m = Number.parseInt(minScore, 10);
    if (Number.isFinite(m)) {
      where.push("quality_score >= ?");
      params.push(m);
    }
  }
  if (maxScore != null && maxScore !== "") {
    const m = Number.parseInt(maxScore, 10);
    if (Number.isFinite(m)) {
      where.push("quality_score <= ?");
      params.push(m);
    }
  }

  if (verseBucket !== "all") {
    if (!verseCountReady) {
      verseCountFilterIgnored = true;
    } else {
      switch (verseBucket) {
        case "1":
          where.push("verse_count = 1");
          break;
        case "2":
          where.push("verse_count = 2");
          break;
        case "3":
          where.push("verse_count = 3");
          break;
        case "4plus":
          where.push("verse_count >= 4");
          break;
        case "unknown":
          where.push("verse_count IS NULL");
          break;
        default:
          break;
      }
    }
  }

  if (companionDirection !== "all") {
    if (!companionDirectionReady) {
      companionDirectionFilterIgnored = true;
    } else {
      switch (companionDirection) {
        case "quiet":
          where.push("dir_quiet = 1");
          break;
        case "pray":
          where.push("dir_pray = 1");
          break;
        case "form":
          where.push("dir_form = 1");
          break;
        default:
          break;
      }
    }
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const countStmt = db.prepare(`SELECT COUNT(*) AS c FROM openbible_topic_row ${whereSql}`);
  countStmt.bind(params);
  countStmt.step();
  const total = Number((countStmt.getAsObject() as { c?: number }).c ?? 0);
  countStmt.free();

  const orderBy = orderByClause(sort);

  const rowCols = buildOpenbibleRowSelectCols(verseCountReady, companionDirectionReady);

  const listStmt = db.prepare(
    `SELECT ${rowCols} FROM openbible_topic_row ${whereSql} ${orderBy} LIMIT ? OFFSET ?`,
  );
  listStmt.bind([...params, limit, offset]);

  const rows: {
    id: number;
    topic: string;
    osis: string;
    osisDisplay: string;
    qualityScore: number;
    verseCount: number | null;
    companion: { quiet: boolean; pray: boolean; form: boolean };
    topicZh: string | null;
  }[] = [];
  while (listStmt.step()) {
    const o = listStmt.getAsObject() as {
      id?: number;
      topic?: string;
      osis?: string;
      quality_score?: number;
      verse_count?: number | null;
      dir_quiet?: number | null;
      dir_pray?: number | null;
      dir_form?: number | null;
    };
    const topic = String(o.topic ?? "");
    const osis = String(o.osis ?? "");
    const vcRaw = o.verse_count;
    const verseCount =
      vcRaw != null && Number.isFinite(Number(vcRaw)) ? Number(vcRaw) : computeOpenbibleOsisVerseCount(osis);
    const topicZh = resolveOpenbibleTopicZh(cwd, topic, zhOverrides);
    const companion = companionFromRowOrInfer(companionDirectionReady, o, topic, topicZh);
    rows.push({
      id: Number(o.id),
      topic,
      osis,
      osisDisplay: formatOpenbibleOsisForLocale(osis, locale),
      qualityScore: Number(o.quality_score ?? 0),
      verseCount,
      companion,
      topicZh,
    });
  }
  listStmt.free();

  const meta = readImportMeta();

  let facets: {
    rowCount: number;
    distinctTopics: number;
    scoreBuckets: { score: number; count: number }[];
  } | null = null;

  if (includeFacets) {
    facets = computeFacets();
  }

  return NextResponse.json(
    {
      ok: true as const,
      total,
      limit,
      offset,
      rows,
      meta,
      facets,
      verseCountReady,
      verseCountFilterIgnored,
      verseBucket,
      companionDirectionReady,
      companionDirectionFilterIgnored,
      companionDirection,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
