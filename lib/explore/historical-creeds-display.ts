import type { AppLocale } from "@/lib/i18n/config";
import { historicalCreedHasBody } from "./historical-creeds-body-load";
import {
  HISTORICAL_CREED_GROUP_ORDER,
  HISTORICAL_CREEDS,
  isCoreEcumenicalCreed,
  type HistoricalCreedGroup,
  type HistoricalCreedItem,
} from "./historical-creeds-content";

export type MappedHistoricalCreedRow = HistoricalCreedItem & {
  groupLabel: string;
  title: string;
  yearLeft: string;
  yearRight: string;
  significance: string;
  problemAddressed: string;
  hasBody: boolean;
  isCoreEcumenical: boolean;
};

function resolveCreedField(
  locale: AppLocale,
  zh: string,
  zhTw: string,
  en: string,
): string {
  if (locale === "en") return en;
  if (locale === "zh-TW") return zhTw;
  return zh;
}

/** 中文年份：451 → 451年；325–381 → 325–381年；已含「世纪」「年」则不改。 */
export function formatHistoricalCreedYearLabel(label: string, locale: AppLocale): string {
  if (locale === "en") return label;
  const trimmed = label.trim();
  if (!trimmed || /世纪|年/.test(trimmed)) return label;
  if (/^约?\s*[\d]+([–-][\d]+)?$/.test(trimmed)) return `${trimmed}年`;
  return label;
}

export function resolveHistoricalCreedGroupLabel(
  group: HistoricalCreedGroup,
  locale: AppLocale,
): string {
  const labels: Record<HistoricalCreedGroup, { zh: string; en: string }> = {
    ecumenical: { zh: "普世大公信经", en: "Ecumenical Creeds" },
    reformation: { zh: "改教运动告白", en: "Reformation Confessions" },
    catechism: { zh: "要理问答", en: "Catechisms" },
    modern: { zh: "近代宣言", en: "Modern Declarations" },
  };
  const entry = labels[group];
  return locale === "en" ? entry.en : entry.zh;
}

export function mapHistoricalCreedRow(
  item: HistoricalCreedItem,
  locale: AppLocale,
  groupLabel: string,
): MappedHistoricalCreedRow {
  const yearBase = item.yearLabelLeft ?? item.yearLabel;
  return {
    ...item,
    groupLabel,
    title: resolveCreedField(locale, item.titleZh, item.titleZhTw, item.titleEn),
    yearLeft: formatHistoricalCreedYearLabel(
      resolveCreedField(locale, yearBase, yearBase, yearBase),
      locale,
    ),
    yearRight: formatHistoricalCreedYearLabel(
      resolveCreedField(locale, item.yearLabel, item.yearLabel, item.yearLabel),
      locale,
    ),
    significance: resolveCreedField(
      locale,
      item.significanceZh,
      item.significanceZhTw,
      item.significanceEn,
    ),
    problemAddressed: resolveCreedField(
      locale,
      item.problemAddressedZh,
      item.problemAddressedZhTw,
      item.problemAddressedEn,
    ),
    hasBody: historicalCreedHasBody(item.id),
    isCoreEcumenical: isCoreEcumenicalCreed(item.id),
  };
}

export function mapHistoricalCreedRows(locale: AppLocale): MappedHistoricalCreedRow[] {
  const groupLabels = Object.fromEntries(
    HISTORICAL_CREED_GROUP_ORDER.map((group) => [
      group,
      resolveHistoricalCreedGroupLabel(group, locale),
    ]),
  ) as Record<HistoricalCreedGroup, string>;

  return HISTORICAL_CREEDS.map((item) =>
    mapHistoricalCreedRow(item, locale, groupLabels[item.group]),
  );
}
