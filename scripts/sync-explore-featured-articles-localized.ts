#!/usr/bin/env node
/**
 * Bundle explore featured article markdown + meta into JSON for Web cache and mobile.
 * Bodies are pre-stripped and scripture-linkified so clients render without runtime work.
 * Run: node node_modules/tsx/dist/cli.mjs scripts/sync-explore-featured-articles-localized.ts
 */
import { createHash } from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { prepareExploreFeaturedArticleBodyForDisplay } from "../lib/explore/prepare-explore-featured-article-body-for-display";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contentDir = path.join(repoRoot, "data/explore-featured-articles");
const meta = JSON.parse(fs.readFileSync(path.join(contentDir, "meta.json"), "utf8")) as {
  articles: Array<{
    slug: string;
    "zh-CN": { title: string; exploreLabel: string };
    en: { title: string; exploreLabel: string };
  }>;
};

const articles = meta.articles.map((entry) => {
  const slug = entry.slug;
  const zhCNRaw = fs.readFileSync(path.join(contentDir, `${slug}.zh-CN.md`), "utf8");
  const enRaw = fs.readFileSync(path.join(contentDir, `${slug}.en.md`), "utf8");
  const zhCN = prepareExploreFeaturedArticleBodyForDisplay(zhCNRaw, "zh-CN");
  const en = prepareExploreFeaturedArticleBodyForDisplay(enRaw, "en");
  return {
    slug,
    "zh-CN": {
      title: entry["zh-CN"].title,
      exploreLabel: entry["zh-CN"].exploreLabel,
      body: zhCN.body,
      sections: zhCN.sections,
    },
    en: {
      title: entry.en.title,
      exploreLabel: entry.en.exploreLabel,
      body: en.body,
      sections: en.sections,
    },
  };
});

const contentVersion = createHash("sha256")
  .update(JSON.stringify({ schemaVersion: 1, articles }))
  .digest("hex")
  .slice(0, 16);
const bundle = { schemaVersion: 1, contentVersion, articles };
const outWeb = path.join(contentDir, "bundle.json");
const outMobile = path.join(
  repoRoot,
  "apps/askbible-mobile/src/explore/explore-featured-articles-localized.json",
);

fs.writeFileSync(outWeb, `${JSON.stringify(bundle, null, 2)}\n`);
fs.writeFileSync(outMobile, `${JSON.stringify(bundle, null, 2)}\n`);
console.log(`Wrote ${outWeb}`);
console.log(`Wrote ${outMobile}`);
