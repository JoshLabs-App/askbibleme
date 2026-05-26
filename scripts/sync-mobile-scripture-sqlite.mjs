#!/usr/bin/env node
/**
 * 将主仓库构建好的译本 SQLite 复制到 Expo 资源目录（供离线原生阅读）。
 * 默认同步 `data/bible/translations.json` 中的全部译本；
 * 可用 SELAH_MOBILE_SCRIPTURE_IDS=id1,id2 覆盖。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = path.join(repoRoot, "data", "bible", "sqlite");
const destDir = path.join(repoRoot, "apps", "askbible-mobile", "assets", "scripture");
const translationsPath = path.join(repoRoot, "data", "bible", "translations.json");

function defaultTranslationIds() {
  const raw = fs.readFileSync(translationsPath, "utf8");
  const j = JSON.parse(raw);
  const list = Array.isArray(j.translations) ? j.translations : [];
  return list.map((t) => String(t.id || "").trim()).filter(Boolean);
}

const ids = (process.env.SELAH_MOBILE_SCRIPTURE_IDS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const resolvedIds = ids.length > 0 ? ids : defaultTranslationIds();

fs.mkdirSync(destDir, { recursive: true });

for (const id of resolvedIds) {
  const src = path.join(srcDir, `${id}.sqlite`);
  const dest = path.join(destDir, `${id}.sqlite`);
  if (!fs.existsSync(src)) {
    console.error(`Missing ${src}. Run: npm run build:bible-sqlite`);
    process.exit(1);
  }
  fs.copyFileSync(src, dest);
  const mb = (fs.statSync(dest).size / (1024 * 1024)).toFixed(2);
  console.log(`Copied ${id}.sqlite (${mb} MB) → apps/askbible-mobile/assets/scripture/`);
}

const xrefSrc = path.join(srcDir, "scripture-xrefs.sqlite");
const xrefDest = path.join(destDir, "scripture-xrefs.sqlite");
if (fs.existsSync(xrefSrc)) {
  fs.copyFileSync(xrefSrc, xrefDest);
  const mb = (fs.statSync(xrefDest).size / (1024 * 1024)).toFixed(2);
  console.log(`Copied scripture-xrefs.sqlite (${mb} MB) → apps/askbible-mobile/assets/scripture/`);
} else {
  console.warn(`Missing ${xrefSrc}. Run: npm run build:scripture-xrefs`);
}
