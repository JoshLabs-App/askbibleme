/**
 * Audit legacy figure library: profiles, articles, scripture refs, and per-locale verse sources.
 * Run: npx tsx scripts/audit-legacy-figures-locale.ts
 */
import { loadChapterFromTranslation } from "../lib/bible/load-chapter-from-default-translation";
import {
  scriptureTranslationIdForLocale,
  scriptureTranslationLabelForLocale,
} from "../lib/bible/scripture-translation-for-locale";
import type { AppLocale } from "../lib/i18n/config";
import { collectZhArticleScriptureRefsFromMarkdown } from "../lib/explore/article-scripture-ref-zh";
import { figureRefKey, verseListFromFigureRef } from "../lib/figures/figure-ref";
import { buildLegacyFiguresForBookTable } from "../lib/legacy-figure-preview";

const LOCALES: AppLocale[] = ["zh-CN", "zh-TW", "en"];
const SIMP_MARKERS = /[这说后来为发经门广国图书云众]/u;
const TRAD_MARKERS = /[這說後來為發經門廣國圖書雲眾]/u;
const EN_MARKERS = /\b(the|and|God|Lord|Jesus|said)\b/i;

const cwd = process.cwd();
const profiles = buildLegacyFiguresForBookTable();

type RefIssue = {
  profile: string;
  refKey: string;
  locale: AppLocale;
  translationId: string;
  reason: string;
};

async function verseAvailable(
  ref: ReturnType<typeof collectZhArticleScriptureRefsFromMarkdown>[number],
  locale: AppLocale,
): Promise<{ ok: boolean; translationId: string; sample: string }> {
  const translationId = scriptureTranslationIdForLocale(cwd, locale);
  const loaded = await loadChapterFromTranslation(cwd, ref.bookId, ref.chapter, translationId);
  if (!loaded) {
    return { ok: false, translationId, sample: "" };
  }
  const byVerse = new Map(loaded.verses.map((row) => [row.verse, row.text.trim()]));
  const parts = verseListFromFigureRef(ref)
    .map((v) => byVerse.get(v) ?? "")
    .filter(Boolean);
  if (!parts.length) {
    return { ok: false, translationId, sample: "" };
  }
  const sample = parts.join("").slice(0, 80);
  return { ok: true, translationId, sample };
}

function proseScript(locale: AppLocale, text: string): "simp" | "trad" | "en" | "mixed" | "empty" {
  const trimmed = text.trim();
  if (!trimmed) return "empty";
  const hasSimp = SIMP_MARKERS.test(trimmed);
  const hasTrad = TRAD_MARKERS.test(trimmed);
  const hasEn = EN_MARKERS.test(trimmed);
  if (hasEn && !/[\p{Script=Han}]/u.test(trimmed)) return "en";
  if (hasSimp && hasTrad) return "mixed";
  if (hasTrad && !hasSimp) return "trad";
  if (hasSimp) return "simp";
  if (/[\p{Script=Han}]/u.test(trimmed)) return "simp";
  return "mixed";
}

async function main() {
  const withArticle = profiles.filter((p) => p.article?.body?.trim());
  const withoutArticle = profiles.filter((p) => !p.article?.body?.trim());
  const allRefs = new Map<string, { profile: string; ref: ReturnType<typeof collectZhArticleScriptureRefsFromMarkdown>[number] }>();

  for (const profile of withArticle) {
    const refs = collectZhArticleScriptureRefsFromMarkdown(profile.article!.body);
    for (const ref of refs) {
      const key = figureRefKey(ref);
      if (!allRefs.has(key)) {
        allRefs.set(key, { profile: profile.displayNameZh, ref });
      }
    }
  }

  const refIssues: RefIssue[] = [];
  const localeStats: Record<
    AppLocale,
    { translationId: string; translationLabel: string; ok: number; missing: number }
  > = {} as Record<
    AppLocale,
    { translationId: string; translationLabel: string; ok: number; missing: number }
  >;

  for (const locale of LOCALES) {
    localeStats[locale] = {
      translationId: scriptureTranslationIdForLocale(cwd, locale),
      translationLabel: scriptureTranslationLabelForLocale(cwd, locale),
      ok: 0,
      missing: 0,
    };
    for (const [refKey, item] of allRefs) {
      const result = await verseAvailable(item.ref, locale);
      if (result.ok) {
        localeStats[locale].ok += 1;
        if (locale === "zh-TW" && SIMP_MARKERS.test(result.sample) && !TRAD_MARKERS.test(result.sample)) {
          refIssues.push({
            profile: item.profile,
            refKey,
            locale,
            translationId: result.translationId,
            reason: "繁体界面下经文样本仍含简体字形",
          });
        }
        if (locale === "zh-CN" && TRAD_MARKERS.test(result.sample) && !SIMP_MARKERS.test(result.sample)) {
          refIssues.push({
            profile: item.profile,
            refKey,
            locale,
            translationId: result.translationId,
            reason: "简体界面下经文样本含繁体字形",
          });
        }
        if (locale === "en" && /[\p{Script=Han}]/u.test(result.sample)) {
          refIssues.push({
            profile: item.profile,
            refKey,
            locale,
            translationId: result.translationId,
            reason: "英文界面下经文正文仍为中文",
          });
        }
      } else {
        localeStats[locale].missing += 1;
        refIssues.push({
          profile: item.profile,
          refKey,
          locale,
          translationId: result.translationId,
          reason: "经文正文缺失",
        });
      }
    }
  }

  const proseIssues: Array<{ profile: string; field: string; script: string }> = [];
  for (const profile of withArticle) {
    const article = profile.article!;
    for (const [field, text] of [
      ["title", article.title],
      ["summary", article.summary],
      ["body", article.body.slice(0, 4000)],
    ] as const) {
      const script = proseScript("zh-CN", text);
      if (script === "trad" || script === "mixed") {
        proseIssues.push({ profile: profile.displayNameZh, field, script });
      }
    }
  }

  const versionMentions = profiles
    .filter((p) => p.article?.body && /和合本|WEB|英译|繁体|简体|CUV/i.test(p.article!.body))
    .map((p) => p.displayNameZh);

  console.log("=== 人物库全量审计 ===");
  console.log(`人物档案：${profiles.length} 位`);
  console.log(`有文章：${withArticle.length} · 无正文：${withoutArticle.length}`);
  if (withoutArticle.length) {
    console.log("无正文：", withoutArticle.map((p) => p.displayNameZh).join("、"));
  }
  console.log(`独立经文引用：${allRefs.size} 处`);
  console.log("");
  console.log("=== 经文出处版本（按界面语言）===");
  for (const locale of LOCALES) {
    const row = localeStats[locale];
    console.log(
      `${locale}: ${row.translationLabel} (${row.translationId}) · 可用 ${row.ok} · 缺失 ${row.missing}`,
    );
  }
  console.log("");
  console.log("=== 文章正文语系（源数据）===");
  console.log(`源文章均为 AskOLD 导入，正文以简体中文撰写：${withArticle.length} 篇`);
  console.log(`检出繁体/混排字段：${proseIssues.length} 处`);
  if (proseIssues.length) {
    for (const item of proseIssues.slice(0, 15)) {
      console.log(`  - ${item.profile} · ${item.field} · ${item.script}`);
    }
    if (proseIssues.length > 15) console.log(`  … 另有 ${proseIssues.length - 15} 处`);
  }
  console.log(`文章内显式提及译本：${versionMentions.length} 篇`);
  if (versionMentions.length) {
    console.log(`  ${versionMentions.slice(0, 20).join("、")}${versionMentions.length > 20 ? "…" : ""}`);
  }
  console.log("");
  console.log("=== 语系/版本问题 ===");
  const uniqueIssues = refIssues.filter(
    (item, index, arr) =>
      arr.findIndex(
        (other) =>
          other.refKey === item.refKey && other.locale === item.locale && other.reason === item.reason,
      ) === index,
  );
  if (!uniqueIssues.length) {
    console.log("未发现经文加载或语系错配问题。");
  } else {
    console.log(`共 ${uniqueIssues.length} 项：`);
    for (const item of uniqueIssues.slice(0, 40)) {
      console.log(`  [${item.locale}] ${item.refKey} (${item.profile}) · ${item.reason}`);
    }
    if (uniqueIssues.length > 40) console.log(`  … 另有 ${uniqueIssues.length - 40} 项`);
  }
  console.log("");
  console.log("=== 英文界面说明 ===");
  console.log("文章解说暂无英文版；英文界面仅经文嵌入会使用 WEB，正文仍为中文源稿。");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
