#!/usr/bin/env node
/**
 * Export AskOLD figure profiles + people-column articles into
 * data/legacy-figure-preview.json for /explore/figures (圣经人物库).
 *
 * Usage:
 *   node scripts/export-legacy-figure-preview.mjs
 *   ASKOLD_ROOT=/path/to/AskOLD node scripts/export-legacy-figure-preview.mjs
 */
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const askOldRoot = process.env.ASKOLD_ROOT || path.join(os.homedir(), "Desktop", "APP", "AskOLD");

const profilesPath = path.join(askOldRoot, "admin_data", "figure_profiles.v2.json");
const articlesPath = path.join(askOldRoot, "admin_data", "community_articles.json");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

const profilesRoot = readJson(profilesPath);
const articlesRoot = readJson(articlesPath);
const figureArticles = (articlesRoot.items || []).filter((a) => a.slug?.startsWith("figure-"));
const articlesBySlug = new Map(figureArticles.map((a) => [a.slug, a]));

const profiles = (profilesRoot.characters || []).map((p) => {
  const article = p.linkedArticleSlug ? (articlesBySlug.get(p.linkedArticleSlug) ?? null) : null;
  return {
    id: p.id,
    slug: p.slug,
    displayNameZh: p.displayNameZh,
    englishName: p.englishName ?? "",
    aliasesZh: p.aliasesZh ?? [],
    identityType: p.identityType ?? "",
    importanceTier: p.importanceTier ?? "",
    profileStatus: p.profileStatus ?? "",
    primaryBookId: p.primaryBookId ?? "",
    bookIds: p.bookIds ?? [],
    characterRoleZh: p.characterRoleZh ?? "",
    scripturePersonalityZh: p.scripturePersonalityZh ?? "",
    periodLabelZh: p.periodLabelZh ?? "",
    lifespanZh: p.lifespanZh ?? "",
    managementNoteZh: p.managementNoteZh ?? "",
    linkedArticleSlug: p.linkedArticleSlug ?? "",
    article: article
      ? {
          slug: article.slug,
          title: article.title,
          summary: article.summary ?? "",
          body: article.body ?? "",
          authorName: article.authorName ?? "",
          updatedAt: article.updatedAt ?? "",
        }
      : null,
  };
});

const profileArticleSlugs = new Set(profiles.map((p) => p.linkedArticleSlug).filter(Boolean));
const orphanArticles = figureArticles
  .filter((a) => !profileArticleSlugs.has(a.slug))
  .map((a) => ({
    slug: a.slug,
    title: a.title,
    summary: a.summary ?? "",
    body: a.body ?? "",
    authorName: a.authorName ?? "",
    updatedAt: a.updatedAt ?? "",
  }));

const out = {
  schemaVersion: 1,
  exportedAt: new Date().toISOString(),
  note: "Temporary import from AskOLD for figure system review. Not for public production.",
  sources: {
    profiles: "AskOLD/admin_data/figure_profiles.v2.json",
    articles: "AskOLD/admin_data/community_articles.json",
  },
  stats: {
    profileCount: profiles.length,
    linkedCount: profiles.filter((p) => p.linkedArticleSlug).length,
    unlinkedProfileCount: profiles.filter((p) => !p.linkedArticleSlug).length,
    articleCount: figureArticles.length,
    orphanArticleCount: orphanArticles.length,
  },
  profiles: profiles.sort((a, b) => a.displayNameZh.localeCompare(b.displayNameZh, "zh-CN")),
  orphanArticles: orphanArticles.sort((a, b) => a.title.localeCompare(b.title, "zh-CN")),
};

const outPath = path.join(repoRoot, "data", "legacy-figure-preview.json");
fs.writeFileSync(outPath, `${JSON.stringify(out, null, 2)}\n`);
console.log(`Wrote ${outPath}`);
console.log(
  `profiles=${out.stats.profileCount} linked=${out.stats.linkedCount} orphans=${out.stats.orphanArticleCount}`,
);
