import { pickTranslationIdForLocale } from "@/lib/bible/pick-translation-for-locale";
import { readTranslationsIndexSync } from "@/lib/bible/translations-store";

/** 祷告内容来自 AskBible 中文语料，正文优先简体和合本（与旧站习惯一致）。 */
export function pickPrayerDisplayTranslationId(cwd: string): string {
  const idx = readTranslationsIndexSync(cwd);
  return pickTranslationIdForLocale(idx, "zh-CN") ?? idx.defaultTranslationId ?? "cuv-simp";
}
