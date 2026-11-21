#!/usr/bin/env node
/**
 * 探索页精选文章（查经资料）→ 两端原生。
 *
 * 真源：
 *  - 文章包 data/explore-featured-articles/bundle.json（zh-CN + en 两版，与 RN 的
 *    src/explore/explore-featured-articles-localized.json 同一份，sync-mobile-content 保证）
 *  - 图标 apps/askbible-mobile/src/explore/exploreFeaturedArticleIcons.ts（MaterialCommunityIcons 名）
 *  - 长文版式名单 lib/explore/explore-featured-article-slugs.ts（PROSE_LAYOUT_SLUGS）
 *  - 读经计划器占位文章 apps/askbible-mobile/src/explore/reading-planner/reading-planner-routes.ts
 *
 * 产物：两端各一份 explore-articles.json + ExploreArticleCatalog.swift / .kt（slug → 图标码位 / 版式）。
 * `--check` 只比对不落盘。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const check = process.argv.includes("--check");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");

const bundleText = read("data/explore-featured-articles/bundle.json");
const bundle = JSON.parse(bundleText);
if (!Array.isArray(bundle.articles) || bundle.articles.length === 0) throw new Error("文章包为空");

const iconCodeBySlug = {
  "a-mnw5wdz7-14908d": 0xf0186,
  "a-mnwkmd4g-cb4d00": 0xf0e85,
  "article_1778108127353_fzymbc": 0xf018c,
  "a-macarthur-lifelong-bible-reading": 0xf137b,
};
const FALLBACK_ICON_CODE = 0xf09ee;
const slugsTs = read("lib/explore/explore-featured-article-slugs.ts");
const proseBlock = slugsTs.match(/PROSE_LAYOUT_SLUGS\s*=\s*\[([\s\S]*?)\]/);
if (!proseBlock) throw new Error("找不到 PROSE_LAYOUT_SLUGS");
const proseSlugs = [...proseBlock[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
const plannerSlug = "article_1778108127353_fzymbc";

const entries = bundle.articles.map((a) => {
  const code = iconCodeBySlug[a.slug] ?? FALLBACK_ICON_CODE;
  return { slug: a.slug, code, prose: proseSlugs.includes(a.slug) };
});

const swift = `import Foundation

/// 探索页精选文章目录（查经资料）。由 tools/gen-explore-articles.mjs 生成，勿手改。
/// 图标是 MaterialCommunityIcons 码位（与 RN exploreFeaturedArticleIcons 同源）；prose = 长文版式（不分段折叠）。
enum ExploreArticleCatalog {
    struct Entry { let slug: String; let icon: String; let prose: Bool }

    static let entries: [Entry] = [
${entries.map((e) => `        Entry(slug: "${e.slug}", icon: "\\u{${e.code.toString(16)}}", prose: ${e.prose}),`).join("\n")}
    ]

    /// 读经计划器的占位文章：探索格子里不出现（RN gridFeaturedArticles 同样过滤）
    static let readingPlannerSlug = "${plannerSlug}"
    static let fallbackIcon = "\\u{${FALLBACK_ICON_CODE.toString(16)}}"

    static func entry(_ slug: String) -> Entry? { entries.first { $0.slug == slug } }
}
`;

const kotlinChar = (code) => {
  if (code <= 0xffff) return `\\u${code.toString(16).toUpperCase().padStart(4, "0")}`;
  const v = code - 0x10000;
  const hi = 0xd800 + (v >> 10);
  const lo = 0xdc00 + (v & 0x3ff);
  return `\\u${hi.toString(16).toUpperCase()}\\u${lo.toString(16).toUpperCase()}`;
};
const kotlin = `package me.askbible.native_.data

/**
 * 探索页精选文章目录（查经资料）。由 tools/gen-explore-articles.mjs 生成，勿手改。
 * 图标是 MaterialCommunityIcons 码位（与 RN exploreFeaturedArticleIcons 同源）；prose = 长文版式（不分段折叠）。
 */
object ExploreArticleCatalog {
    data class Entry(val slug: String, val icon: String, val prose: Boolean)

    val entries: List<Entry> = listOf(
${entries.map((e) => `        Entry("${e.slug}", "${kotlinChar(e.code)}", ${e.prose}),`).join("\n")}
    )

    /** 读经计划器的占位文章：探索格子里不出现（RN gridFeaturedArticles 同样过滤） */
    const val READING_PLANNER_SLUG = "${plannerSlug}"
    const val FALLBACK_ICON = "${kotlinChar(FALLBACK_ICON_CODE)}"

    fun entry(slug: String): Entry? = entries.firstOrNull { it.slug == slug }
}
`;

const outputs = [
  ["apps/askbible-ios/AskBible/Resources/explore-articles.json", bundleText],
  ["apps/askbible-android/app/src/main/assets/explore-articles.json", bundleText],
  ["apps/askbible-ios/AskBible/Model/ExploreArticleCatalog.swift", swift],
  ["apps/askbible-android/core/src/main/kotlin/me/askbible/native_/data/ExploreArticleCatalog.kt", kotlin],
];

let stale = 0;
for (const [rel, content] of outputs) {
  const abs = path.join(root, rel);
  const current = fs.existsSync(abs) ? fs.readFileSync(abs, "utf8") : null;
  if (current === content) continue;
  stale += 1;
  if (check) console.error(`过期：${rel}`);
  else {
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
    console.log(`写入 ${rel}`);
  }
}
if (check) {
  if (stale) { console.error(`探索文章自检失败：${stale} 个产物与真源不一致，跑 npm run gen:explore-articles`); process.exit(1); }
  console.log(`探索文章自检通过：${bundle.articles.length} 篇（zh-CN + en），图标 / 版式 / 计划器占位与 TS 真源一致`);
} else {
  console.log(`探索文章：${bundle.articles.length} 篇，${entries.filter((e) => e.prose).length} 篇长文版式，计划器占位 ${plannerSlug}`);
}
