import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, View } from "react-native";
import {
  READ_CHAPTER_ACTION_ROW_GAP,
  READ_CHAPTER_ACTION_ROW_HEIGHT,
} from "../read/read-chapter-chrome-inset";
import { parchmentTabBarBottomGradient } from "./chromeScrim";
import { SHELL_TAB_BAR_CLEARANCE } from "./shellLayout";

/** 与 `readParchmentScrollMask` tabbar preset 底部渐隐区对齐 */
const FADE_ABOVE_TAB_PX = 120;

type Props = {
  bottomInset: number;
  chapterActionChrome?: boolean;
};

/**
 * 读经 / 探索底栏后的羊皮渐隐底 — 不依赖滚动区 MaskedView，避免 Tab 切换后偶发透明。
 * 首页 / 音乐不使用此层（视频与封面本身已足够，不需要额外压暗）。
 */
export function ShellTabBarBottomScrim({
  bottomInset,
  chapterActionChrome = false,
}: Props) {
  const actionExtra = chapterActionChrome
    ? READ_CHAPTER_ACTION_ROW_HEIGHT + READ_CHAPTER_ACTION_ROW_GAP
    : 0;
  const height =
    SHELL_TAB_BAR_CLEARANCE + FADE_ABOVE_TAB_PX + Math.max(bottomInset, 8) + actionExtra;

  const gradient = parchmentTabBarBottomGradient();

  return (
    <View pointerEvents="none" style={[styles.layer, { height }]}>
      <LinearGradient
        colors={gradient.colors}
        locations={gradient.locations}
        start={{ x: 0.5, y: 1 }}
        end={{ x: 0.5, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    width: "100%",
    overflow: "hidden",
    backgroundColor: "transparent",
    elevation: 0,
  },
});
