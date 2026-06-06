import { translationSupportsChapterAudio } from "@/lib/bible/read-chapter-audio";
import type { BibleTranslationMeta, BibleTranslationsIndex } from "@/lib/bible/translations-types";
import type { ReadBibleTranslationPrefsV1 } from "@/lib/read/read-bible-translation-prefs";

/** 设置项：朗读译本与屏幕主译本相同 */
export const READ_BIBLE_AUDIO_TRANSLATION_FOLLOW_PRIMARY = "";

function firstSupportedByIds(ids: string[], catalog: BibleTranslationMeta[]): string | null {
  const byId = new Map(catalog.map((item) => [item.id, item] as const));
  for (const id of ids) {
    if (!id) continue;
    const found = byId.get(id);
    if (found && translationSupportsChapterAudio(found.id)) return found.id;
  }
  return null;
}

function inferLanguageKind(primary: BibleTranslationMeta | undefined): "en" | "es" | "zh" | null {
  if (!primary) return null;
  const id = String(primary.id || "").toLowerCase();
  const language = String(primary.language || "").toLowerCase();
  const labelZh = String(primary.labelZh || "").toLowerCase();
  const labelEn = String(primary.labelEn || "").toLowerCase();
  const allText = `${id} ${language} ${labelZh} ${labelEn}`;

  if (
    language.startsWith("en") ||
    language.startsWith("eng") ||
    allText.includes(" english") ||
    allText.includes("英文") ||
    /(^|[\s-])(kjv|asv|bbe|web|dby|gnv|ylt)([\s-]|$)/.test(allText) ||
    id.endsWith("-en")
  ) {
    return "en";
  }
  if (
    language.startsWith("es") ||
    language.startsWith("spa") ||
    allText.includes(" spanish") ||
    allText.includes("西语") ||
    allText.includes("西班牙") ||
    /(^|[\s-])(blm|rvg|rv1909|vbl)([\s-]|$)/.test(allText) ||
    id.endsWith("-es")
  ) {
    return "es";
  }
  if (
    language.startsWith("zh") ||
    language.startsWith("chi") ||
    language.startsWith("zho") ||
    allText.includes(" chinese") ||
    allText.includes("中文") ||
    allText.includes("简体") ||
    allText.includes("繁体") ||
    /(^|[\s-])(cuv|cbs|swcb|otb-zh)([\s-]|$)/.test(allText) ||
    id.endsWith("-zh")
  ) {
    return "zh";
  }
  return null;
}

function pickLanguageMatchedAudioTranslation(primaryId: string, catalog: BibleTranslationMeta[]): string | null {
  const primary = catalog.find((item) => item.id === primaryId);
  const lang = inferLanguageKind(primary);
  if (lang === "en") return firstSupportedByIds(["web-en", "bbe-en"], catalog);
  if (lang === "es") return firstSupportedByIds(["blm-es"], catalog);
  if (lang === "zh") return firstSupportedByIds(["cuv-simp", "cuv-trad"], catalog);
  return null;
}

export function resolveChapterAudioTranslationId(
  prefs: Pick<ReadBibleTranslationPrefsV1, "primaryTranslationId" | "audioTranslationId">,
  index?: BibleTranslationsIndex,
): string {
  const explicit = prefs.audioTranslationId?.trim();
  if (explicit && translationSupportsChapterAudio(explicit)) return explicit;
  const primary = prefs.primaryTranslationId?.trim();
  if (primary && translationSupportsChapterAudio(primary)) return primary;
  if (primary && index?.translations?.length) {
    const byLanguage = pickLanguageMatchedAudioTranslation(primary, index.translations);
    if (byLanguage) return byLanguage;
  }
  return (
    firstSupportedByIds(["cuv-simp", "web-en", "bbe-en", "blm-es"], index?.translations ?? []) ??
    "cuv-simp"
  );
}

export function normalizeReadBibleAudioTranslationId(
  raw: unknown,
  index: BibleTranslationsIndex,
  primaryId: string,
): string | null {
  const allowed = new Set(index.translations.map((t) => t.id));
  const s = typeof raw === "string" ? raw.trim() : "";
  if (!s || s === primaryId) return null;
  if (!allowed.has(s) || !translationSupportsChapterAudio(s)) return null;
  return s;
}

export function translationCatalogWithChapterAudio(
  index: BibleTranslationsIndex,
): BibleTranslationsIndex["translations"] {
  return index.translations.filter((t) => translationSupportsChapterAudio(t.id));
}
