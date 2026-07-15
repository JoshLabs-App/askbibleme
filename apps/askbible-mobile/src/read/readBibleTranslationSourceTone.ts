export type TranslationSourceTone = "bundled" | "youversion" | "api-bible" | "esv";

type TranslationSourceToneMeta = {
  bundled?: boolean;
  provider?: "local" | "youversion" | "api-bible" | "esv";
};

export function translationSourceTone(tr: TranslationSourceToneMeta): TranslationSourceTone {
  if (tr.provider === "youversion") return "youversion";
  if (tr.provider === "api-bible") return "api-bible";
  if (tr.provider === "esv") return "api-bible";
  return "bundled";
}
