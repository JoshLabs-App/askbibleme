import { StyleSheet } from "react-native";

/**
 * Tab 主行高度（中心 FAB 60 主导 `ShellTabBar` row）。
 * 读经坞 / 计划页 / 音乐页切换时，播放键底边须落在同一高度。
 */
export const SHELL_TAB_ROW_HEIGHT = 60;

/** 与 `shellTabBarStyles.wrap.gap` 同步 */
export const SHELL_TAB_BAR_DOCK_GAP = 6;

/**
 * 播放坞外框（读经 Tab 坞与计划播放页共用）。
 * 禁止单边改 padding，否则 Tab 切换时左右/上下会跳。
 */
export const shellPlaybackDockChrome = {
  paddingTop: 4,
  /** 原计划页 padX(20) 与「TabBar 12 + 坞 8」等效；现统一为单一来源 */
  paddingHorizontal: 20,
  marginBottom: 2,
} as const;

/** 读经计划 / 音乐页播放坞共用：底距（相对屏幕底 = 坞底 margin + gap + Tab 行 + 安全区） */
export function shellPlaybackDockBottomPad(safeBottom: number): number {
  return (
    shellPlaybackDockChrome.marginBottom +
    SHELL_TAB_BAR_DOCK_GAP +
    SHELL_TAB_ROW_HEIGHT +
    Math.max(safeBottom, 8)
  );
}

/**
 * 播放坞控件几何（与读经计划 `ReadPlanPlayScreen` 真源一致）。
 * 两页切换时图标应对齐，禁止单边改尺寸/间距。
 */
export const shellPlaybackTransportMetrics = {
  scrubberPaddingH: 4,
  scrubberMarginBottom: 2,
  scrubberTimeGap: 8,
  /** 与 MinimalProgressBar hit.minHeight 对齐（一行：时间 | 轴 | 时间） */
  scrubberRowHeight: 23,
  timeFontSize: 12,
  timeLabelMinWidth: 36,
  transportMarginTop: 2,
  transportPaddingH: 4,
  transportMainGap: 28,
  loopBtnSize: 44,
  transportBtnSize: 48,
  playBtnSize: 64,
  skipIconSize: 36,
  playIconSize: 34,
  loopIconSize: 24,
  speedBtnSize: 56,
  playIconNudge: 3,
} as const;

/**
 * 读经坞内容区高度（一行进度 + transport；不含 Tab 行与 gap）。
 */
export const SHELL_SCRIPTURE_DOCK_CONTENT_HEIGHT =
  shellPlaybackDockChrome.paddingTop +
  shellPlaybackTransportMetrics.scrubberRowHeight +
  shellPlaybackTransportMetrics.scrubberMarginBottom +
  shellPlaybackTransportMetrics.transportMarginTop +
  shellPlaybackTransportMetrics.playBtnSize +
  shellPlaybackDockChrome.marginBottom;

const m = shellPlaybackTransportMetrics;

/** 结构样式（不含颜色）——音乐页与读经页共用 */
export const shellPlaybackTransportLayoutStyles = StyleSheet.create({
  scrubber: {
    flexDirection: "row",
    alignItems: "center",
    gap: m.scrubberTimeGap,
    marginBottom: m.scrubberMarginBottom,
    paddingHorizontal: m.scrubberPaddingH,
    minHeight: m.scrubberRowHeight,
  },
  scrubberBar: {
    flex: 1,
    minWidth: 48,
  },
  timeStart: {
    minWidth: m.timeLabelMinWidth,
    textAlign: "left",
  },
  timeEnd: {
    minWidth: m.timeLabelMinWidth,
    textAlign: "right",
  },
  transport: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: m.transportMarginTop,
    paddingHorizontal: m.transportPaddingH,
    width: "100%",
  },
  transportMain: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: m.transportMainGap,
  },
  loopBtn: {
    width: m.loopBtnSize,
    height: m.loopBtnSize,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: m.loopBtnSize / 2,
  },
  transportBtn: {
    width: m.transportBtnSize,
    height: m.transportBtnSize,
    alignItems: "center",
    justifyContent: "center",
  },
  playBtn: {
    width: m.playBtnSize,
    height: m.playBtnSize,
    borderRadius: m.playBtnSize / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  playBtnPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.97 }],
  },
  playIcon: {
    marginLeft: m.playIconNudge,
  },
  transportDisabled: {
    opacity: 0.35,
  },
});
