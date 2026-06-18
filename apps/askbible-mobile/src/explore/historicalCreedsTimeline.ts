import type { AppLocale } from "../i18n/config";
import { localizeZhText } from "../i18n/site-copy";
import {
  formatHistoricalCreedYearLabel,
  mapHistoricalCreedRow as mapHistoricalCreedRowShared,
  resolveHistoricalCreedGroupLabel as resolveHistoricalCreedGroupLabelShared,
  type MappedHistoricalCreedRow,
} from "../../../../lib/explore/historical-creeds-display";
import type { HistoricalCreedGroup, HistoricalCreedItem } from "../../../../lib/explore/historical-creeds-content";

export type { MappedHistoricalCreedRow };

export function mapHistoricalCreedRow(
  item: HistoricalCreedItem,
  locale: AppLocale,
  groupLabel: string,
): MappedHistoricalCreedRow {
  const row = mapHistoricalCreedRowShared(item, locale, groupLabel);
  return {
    ...row,
    yearLeft: formatHistoricalCreedYearLabel(
      localizeZhText(locale, item.yearLabelLeft ?? item.yearLabel),
      locale,
    ),
  };
}

export function resolveHistoricalCreedGroupLabel(
  group: HistoricalCreedGroup,
  locale: AppLocale,
): string {
  const label = resolveHistoricalCreedGroupLabelShared(group, locale === "en" ? "en" : "zh-CN");
  return locale === "en" ? label : localizeZhText(locale, label);
}
