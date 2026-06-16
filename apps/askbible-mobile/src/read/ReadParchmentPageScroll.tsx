import { usePathname } from "expo-router";
import { forwardRef, useMemo } from "react";
import {
  StyleSheet,
  type ScrollView,
  type ScrollViewProps,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ParchmentBottomFadeScrollView } from "./ParchmentBottomFadeScrollView";
import { SHELL_TAB_BAR_CLEARANCE } from "../shell/shellLayout";
import { READ_CHAPTER_SCROLL_BOTTOM_EXTRA } from "./read-chapter-chrome-inset";
import { readRouteUsesBottomActionChrome } from "./read-route-chrome";
import {
  PARCHMENT_COLUMN_MAX_WIDTH_PHONE,
  READ_PARCHMENT_PAGE_MAX_WIDTH,
  useParchmentColumnMaxWidth,
} from "./parchmentColumnLayout";

/** 与 `ReadCatalogScreen` / 网站 `.read-bible-parchment-scroll` 对齐 */
export const READ_PARCHMENT_PAGE_TOP_HOME = 48;
export const READ_PARCHMENT_PAGE_TOP_SUB = 20;
export const READ_PARCHMENT_PAGE_BOTTOM = SHELL_TAB_BAR_CLEARANCE + 28;
export const READ_PARCHMENT_PAGE_PAD_X = 20;
export { READ_PARCHMENT_PAGE_MAX_WIDTH };

export type ReadParchmentPageInset = "home" | "sub";

type Props = ScrollViewProps & {
  /** `home`：圣经首页、搜索等；`sub`：带返回的次级列表 */
  inset?: ReadParchmentPageInset;
  maskEnabled?: boolean;
};

/**
 * 读经区标准滚动模板：顶/底 mask 渐隐 + 居中版心（与圣经首页相同）。
 */
export const ReadParchmentPageScroll = forwardRef<ScrollView, Props>(
  function ReadParchmentPageScroll(
    { contentContainerStyle, inset = "home", maskEnabled, style, ...rest },
    ref,
  ) {
    const insets = useSafeAreaInsets();
    const pathname = usePathname();
    const columnMaxWidth = useParchmentColumnMaxWidth(PARCHMENT_COLUMN_MAX_WIDTH_PHONE);
    const contentColumnStyle = useMemo(
      () => [
        styles.content,
        columnMaxWidth != null ? { maxWidth: columnMaxWidth } : null,
      ],
      [columnMaxWidth],
    );
    const topPad =
      inset === "home" ? READ_PARCHMENT_PAGE_TOP_HOME : READ_PARCHMENT_PAGE_TOP_SUB;
    const actionChromePad = readRouteUsesBottomActionChrome(pathname)
      ? READ_CHAPTER_SCROLL_BOTTOM_EXTRA
      : 0;

    return (
      <ParchmentBottomFadeScrollView
        ref={ref}
        maskEnabled={maskEnabled}
        style={[styles.flex, style]}
        contentContainerStyle={[
          contentColumnStyle,
          {
            paddingTop: topPad + insets.top,
            paddingBottom: READ_PARCHMENT_PAGE_BOTTOM + actionChromePad + insets.bottom,
          },
          contentContainerStyle,
        ]}
        {...rest}
      />
    );
  },
);

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    paddingHorizontal: READ_PARCHMENT_PAGE_PAD_X,
    width: "100%",
    alignSelf: "center",
  },
});
