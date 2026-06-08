#!/usr/bin/env node
/**
 * Bundle explore featured article markdown + meta into JSON for Web cache and mobile.
 * Run: node scripts/sync-explore-featured-articles-localized.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contentDir = path.join(repoRoot, "data/explore-featured-articles");
const meta = JSON.parse(fs.readFileSync(path.join(contentDir, "meta.json"), "utf8"));

const articles = meta.articles.map((entry) => {
  const slug = entry.slug;
  const zhCNBody = fs.readFileSync(path.join(contentDir, `${slug}.zh-CN.md`), "utf8").trim();
  const enBody = fs.readFileSync(path.join(contentDir, `${slug}.en.md`), "utf8").trim();
  return {
    slug,
    "zh-CN": {
      title: entry["zh-CN"].title,
      exploreLabel: entry["zh-CN"].exploreLabel,
      body: zhCNBody,
    },
    en: {
      title: entry.en.title,
      exploreLabel: entry.en.exploreLabel,
      body: enBody,
    },
  };
});

const bundle = { schemaVersion: 1, articles };
const outWeb = path.join(contentDir, "bundle.json");
const outMobile = path.join(
  repoRoot,
  "apps/askbible-mobile/src/explore/explore-featured-articles-localized.json",
);

fs.writeFileSync(outWeb, `${JSON.stringify(bundle, null, 2)}\n`);
fs.writeFileSync(outMobile, `${JSON.stringify(bundle, null, 2)}\n`);
console.log(`Wrote ${outWeb}`);
console.log(`Wrote ${outMobile}`);
