#!/usr/bin/env node
/**
 * 从 TSTSCC 潮汕語音聖經（朗讀版 m=0）抓取各卷章節 MP3 路徑，寫入 manifest。
 *
 *   npm run audio:teochew-manifest
 */
import fs from "node:fs";
import path from "node:path";

const BASE = "http://info.tstscc.org:9090/teochew";
const MODE = 0;

/** @type {Record<string, string>} */
const TSTSCC_SLUG_TO_BOOK_ID = {
  mat: "MAT",
  mak: "MRK",
  luk: "LUK",
  jhn: "JHN",
  act: "ACT",
  rom: "ROM",
  "1co": "1CO",
  "2co": "2CO",
  gal: "GAL",
  eph: "EPH",
  phl: "PHP",
  col: "COL",
  "1ts": "1TH",
  "2ts": "2TH",
  "1ti": "1TI",
  "2ti": "2TI",
  tit: "TIT",
  phm: "PHM",
  heb: "HEB",
  jas: "JAS",
  "1pe": "1PE",
  "2pe": "2PE",
  "1jn": "1JN",
  "2jn": "2JN",
  "3jn": "3JN",
  jud: "JUD",
  rev: "REV",
};

const SLUGS = Object.keys(TSTSCC_SLUG_TO_BOOK_ID);

const MP3_RE = /href="(read\/[^"]+\.mp3)"/gi;

async function fetchText(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "SelahTeochewManifest/1.0" },
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

function parseChapters(html, slug) {
  const bookId = TSTSCC_SLUG_TO_BOOK_ID[slug];
  const entries = [];
  const seen = new Set();
  let m;
  while ((m = MP3_RE.exec(html)) !== null) {
    const rel = m[1];
    const file = rel.split("/").pop() || "";
    const chapMatch = /___(\d+)_/.exec(file);
    if (!chapMatch) continue;
    const chapter = Number(chapMatch[1]);
    if (!Number.isInteger(chapter) || chapter < 1) continue;
    const key = `${bookId}:${chapter}`;
    if (seen.has(key)) continue;
    seen.add(key);
    entries.push({
      bookId,
      chapter,
      tstsccSlug: slug,
      remotePath: rel,
      remoteUrl: `${BASE}/${rel}`,
      localFilename: `${bookId}-${chapter}.mp3`,
    });
  }
  entries.sort((a, b) => a.chapter - b.chapter);
  return entries;
}

async function main() {
  const all = [];
  for (const slug of SLUGS) {
    const url = `${BASE}/chapter.aspx?c=${encodeURIComponent(slug)}&m=${MODE}`;
    process.stdout.write(`fetch ${slug} … `);
    const html = await fetchText(url);
    const entries = parseChapters(html, slug);
    console.log(`${entries.length} chapters`);
    if (entries.length === 0) {
      console.error(`  warning: no chapters for ${slug}`);
    }
    all.push(...entries);
  }

  all.sort((a, b) => {
    const an = SLUGS.indexOf(
      Object.entries(TSTSCC_SLUG_TO_BOOK_ID).find(([, id]) => id === a.bookId)?.[0] ?? "",
    );
    const bn = SLUGS.indexOf(
      Object.entries(TSTSCC_SLUG_TO_BOOK_ID).find(([, id]) => id === b.bookId)?.[0] ?? "",
    );
    if (an !== bn) return an - bn;
    return a.chapter - b.chapter;
  });

  const out = {
    version: 1,
    source: "tstscc-teochew",
    sourceSite: "http://info.tstscc.org:9090/teochew/",
    mode: MODE,
    modeLabel: "朗读版",
    attribution:
      "潮州语新约朗读音频：众生命堂「潮汕語音聖經」朗读版（2018–2020）。",
    count: all.length,
    entries: all,
  };

  const dest = path.join(process.cwd(), "data", "bible", "teochew-nt-audio-manifest.json");
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, `${JSON.stringify(out, null, 2)}\n`, "utf8");
  console.log(`\nWrote ${out.count} entries → ${dest}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
