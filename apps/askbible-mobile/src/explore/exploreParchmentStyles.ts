import { createElement, useMemo, type ReactNode } from "react";
import {
  Platform,
  StyleSheet,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { parchmentSans } from "../fonts/parchmentType";
import {
  PARCHMENT_CATALOG_MAX_WIDTH_PHONE,
  PARCHMENT_COLUMN_MAX_WIDTH_PHONE,
  parchmentColumnMaxWidth,
  parchmentContentPaddingHorizontal,
} from "../read/parchmentColumnLayout";
import { ParchmentDefaultPage } from "../read/ParchmentDefaultPage";
import { readParchmentTheme as c } from "../read/readParchmentTheme";

/** 与读经首页 `READ_PARCHMENT_PAGE_TOP_HOME` 同量级，略留标题呼吸感 */
export const EXPLORE_PAGE_TOP_PAD = 40;

/** 数算年日页中间经文区不透明度（30% 透明） */
export const YEAR_DAY_COUNT_SCRIPTURE_TEXT_OPACITY = 0.7;

/** 与读经/祷告羊皮卷页对齐；页面根须包 {@link ExploreParchmentPage}（屏内铺底）。 */
export const exploreStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "transparent", overflow: Platform.OS === "android" ? "visible" : "hidden" },
  scroll: {
    width: "100%",
    alignSelf: "center",
  },
  title: {
    fontSize: 26,
    ...parchmentSans(600),
    letterSpacing: -0.3,
    lineHeight: 35,
    color: c.ink,
    textAlign: "center",
  },
  /** 探索页顶栏问候：单行、左右留白、过长截断 */
  titleGreetingWrap: {
    alignSelf: "center",
    maxWidth: "82%",
    paddingHorizontal: 16,
  },
  titleGreetingPressed: {
    opacity: 0.72,
  },
  rule: {
    marginTop: 18,
    height: StyleSheet.hairlineWidth,
    width: 48,
    backgroundColor: c.border,
    alignSelf: "center",
  },
  lead: {
    marginTop: 18,
    fontSize: 15,
    ...parchmentSans(500),
    lineHeight: 24,
    color: c.muted,
    textAlign: "center",
  },
  section: {
    marginTop: 36,
    paddingTop: 8,
  },
  sectionDivider: {
    marginTop: 18,
    marginBottom: 10,
    height: StyleSheet.hairlineWidth,
    backgroundColor: c.border,
    opacity: 0.8,
  },
  sectionCaption: {
    fontSize: 12,
    ...parchmentSans(600),
    color: c.faint,
    textAlign: "center",
    letterSpacing: 0.3,
  },
  backLink: {
    alignSelf: "flex-start",
    paddingVertical: 4,
  },
  yearDayCountBackLink: {
    alignSelf: "flex-start",
    paddingVertical: 2,
  },
  backLinkText: {
    fontSize: 14,
    ...parchmentSans(500),
    color: c.muted,
  },
  yearDayCountTitle: {
    fontSize: 22,
    ...parchmentSans(600),
    letterSpacing: -0.3,
    lineHeight: 28,
    color: c.ink,
    textAlign: "center",
    marginTop: 8,
  },
  yearDayCountRule: {
    marginTop: 8,
    height: StyleSheet.hairlineWidth,
    width: 32,
    backgroundColor: c.border,
    alignSelf: "center",
  },
  yearDayCountLeadBlock: {
    marginTop: 10,
    paddingHorizontal: 4,
    alignItems: "center",
  },
  yearDayCountLeadVerse: {
    width: "100%",
    fontSize: 14,
    lineHeight: 21,
    ...parchmentSans(500),
    letterSpacing: 0.05,
    color: c.inkSoft,
    textAlign: "center",
  },
  yearDayCountLeadLine: {
    fontSize: 14,
    lineHeight: 21,
    ...parchmentSans(500),
    color: c.inkSoft,
  },
  yearDayCountLeadRef: {
    fontSize: 10,
    lineHeight: 21,
    ...parchmentSans(500),
    color: c.faint,
    letterSpacing: 0.1,
  },
  yearDayCountLeadPressed: { opacity: 0.72 },
  yearDayCountScriptureWrap: {
    opacity: YEAR_DAY_COUNT_SCRIPTURE_TEXT_OPACITY,
  },
  yearDayCountTimelineSection: {
    marginTop: 14,
    marginBottom: 0,
  },
  yearDayCountBottomContext: {
    marginTop: 18,
    gap: 14,
    alignItems: "center",
    paddingHorizontal: 8,
  },
  yearDayCountBottomParagraph: {
    width: "100%",
    fontSize: 14,
    lineHeight: 21,
    ...parchmentSans(500),
    color: c.inkSoft,
    textAlign: "center",
  },
  yearDayCountBottomRef: {
    fontSize: 10,
    lineHeight: 21,
    ...parchmentSans(500),
    color: c.faint,
    letterSpacing: 0.1,
  },
  yearDayCountBottomRefLine: {
    marginTop: -6,
    width: "100%",
    fontSize: 10,
    lineHeight: 16,
    ...parchmentSans(500),
    color: c.faint,
    letterSpacing: 0.1,
    textAlign: "right",
  },
  yearDayCountRelatedSection: {
    marginTop: 28,
    alignItems: "center",
    paddingTop: 8,
  },
  yearDayCountRelatedDivider: {
    marginBottom: 18,
    height: StyleSheet.hairlineWidth,
    width: "100%",
    backgroundColor: c.border,
    opacity: 0.8,
  },
  iconGrid: {
    marginTop: 16,
    paddingTop: 8,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-start",
    gap: 10,
  },
  iconTile: {
    alignItems: "center",
    gap: 10,
  },
  iconTilePressed: { opacity: 0.88 },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    backgroundColor: "rgba(255, 252, 245, 0.55)",
  },
  iconLabel: {
    width: "100%",
    fontSize: 12,
    lineHeight: 15,
    ...parchmentSans(600),
    color: c.ink,
    textAlign: "center",
  },
  articlesCard: {
    marginTop: 16,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    backgroundColor: "rgba(255, 252, 245, 0.55)",
    overflow: "hidden",
  },
  articleRow: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  articleRowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
  },
  articleRowPressed: {
    opacity: 0.88,
    backgroundColor: "rgba(255, 252, 245, 0.82)",
  },
  articleRowTitle: {
    fontSize: 15,
    lineHeight: 22,
    ...parchmentSans(600),
    color: c.ink,
  },
  articleRowMeta: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 16,
    ...parchmentSans(500),
    color: c.faint,
  },
  articleHeader: {
    marginTop: 12,
    paddingBottom: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  articleEyebrow: {
    fontSize: 12,
    ...parchmentSans(600),
    letterSpacing: 0.8,
    color: c.faint,
    textTransform: "uppercase",
  },
  articleTitle: {
    marginTop: 8,
    fontSize: 24,
    lineHeight: 32,
    ...parchmentSans(600),
    letterSpacing: -0.3,
    color: c.ink,
    textAlign: "left",
  },
  articleMeta: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 18,
    ...parchmentSans(500),
    color: c.faint,
  },
  articleBody: {
    marginTop: 18,
  },
  articleSectionHint: {
    marginBottom: 12,
    fontSize: 13,
    lineHeight: 20,
    ...parchmentSans(500),
    color: c.muted,
    textAlign: "center",
  },
});

/** 探索族页面共享根壳（屏内羊皮底；与读经同一张 JPG）。 */
export function ExploreParchmentPage({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  // 本文件为 .ts，避免 JSX；createElement 与 .tsx 等价。
  return createElement(ParchmentDefaultPage, { style, children });
}

export function useExploreScrollContentStyle(
  extra?: StyleProp<ViewStyle>,
): StyleProp<ViewStyle> {
  const { width, height } = useWindowDimensions();
  return useMemo(() => {
    const maxWidth = parchmentColumnMaxWidth(width, height, PARCHMENT_COLUMN_MAX_WIDTH_PHONE);
    const padX = parchmentContentPaddingHorizontal(width, height);
    return [
      exploreStyles.scroll,
      { paddingHorizontal: padX },
      maxWidth != null ? { maxWidth } : null,
      extra,
    ];
  }, [width, height, extra]);
}

export function useExploreCatalogMaxWidth(): number | undefined {
  const { width, height } = useWindowDimensions();
  return useMemo(
    () => parchmentColumnMaxWidth(width, height, PARCHMENT_CATALOG_MAX_WIDTH_PHONE),
    [width, height],
  );
}
