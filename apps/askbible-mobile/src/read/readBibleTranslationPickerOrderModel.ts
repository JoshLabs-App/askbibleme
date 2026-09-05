import type { AppLocale } from "../i18n/config";

const TOP_PICKER_ORDER: Record<AppLocale, readonly string[]> = {
  "zh-CN": [
    "cuv-simp",
    "cuv-trad",
    "cbs-zh",
    "swcb-zh",
    "ccb-zh-hans",
    "cnvs-zh-hans",
    "rcuvss-zh-hans",
    "rcuv-zh-hant",
    "rcv-zh-hant",
    "csbs-zh-hans",
    "cunpss-zh-hans",
    "cunpss-zh-hant",
    "cunp-zh-hant",
    "cunp-zh-hant-god",
    "csbt-zh-hant",
    "cnv-zh-hant",
    "mandarin-zh-hans",
    "niv",
    "esv",
    "nlt",
    "nkjv",
    "kjv",
    "web-en",
    "ylt-en",
    "asv",
    "bbe-en",
    "ust-en",
    "otb-zh-hans",
    "otb-zh-hant",
  ],
  "zh-TW": [
    "cuv-trad",
    "cuv-simp",
    "cbs-zh",
    "swcb-zh",
    "ccb-zh-hant",
    "rcuv-zh-hant",
    "rcuvss-zh-hans",
    "cnv-zh-hant",
    "rcv-zh-hant",
    "csbt-zh-hant",
    "cunp-zh-hant",
    "cunp-zh-hant-god",
    "cunpss-zh-hans",
    "cunpss-zh-hant",
    "csbs-zh-hans",
    "cnvs-zh-hans",
    "mandarin-zh-hans",
    "niv",
    "esv",
    "nlt",
    "nkjv",
    "kjv",
    "web-en",
    "ylt-en",
    "asv",
    "bbe-en",
    "ust-en",
    "otb-zh-hant",
    "otb-zh-hans",
  ],
  en: [
    "niv",
    "esv",
    "nlt",
    "nkjv",
    "kjv",
    "web-en",
    "asv",
    "bbe-en",
    "ust-en",
    "ylt-en",
    "cuv-simp",
    "cuv-trad",
    "otb-en-gb",
    "dby-en",
    "gnv-en",
  ],
};

export function sortPickerTranslations<T extends { id: string }>(
  items: T[],
  locale: AppLocale,
): T[] {
  // Older persisted locale values may not exist in this version's picker map.
  const topOrder = TOP_PICKER_ORDER[locale] ?? TOP_PICKER_ORDER.en;
  const rank = new Map(topOrder.map((id, index) => [id, index]));
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const aRank = rank.get(a.item.id) ?? topOrder.length;
      const bRank = rank.get(b.item.id) ?? topOrder.length;
      return aRank - bRank || a.index - b.index;
    })
    .map(({ item }) => item);
}
