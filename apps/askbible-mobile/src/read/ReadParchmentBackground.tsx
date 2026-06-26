import type { ReactNode } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useShellFullBleedFrame } from "../shell/shellLayout";
import { ReadParchmentBackgroundImage } from "./ReadParchmentSurface";
import { READ_PARCHMENT_COLOR_MODE, readParchmentTheme as c } from "./readParchmentTheme";

type Props = {
  children: ReactNode;
};

/**
 * 全屏羊皮卷底（默认）：探索 / 读经 Tab 栈、全屏 Modal、欢迎页等统一用此组件。
 * 子页面保持 `backgroundColor: "transparent"`，底纹由外层 {@link ReadParchmentBackground} 提供。
 * Android 切章防闪黑仅依赖原生 `windowBackground`（见 `colors.xml`），勿在此叠实色卡片。
 */
export function ReadParchmentBackground({ children }: Props) {
  const screenFrame = useShellFullBleedFrame();

  return (
    <ReadParchmentBackgroundImage
      fill
      style={[
        styles.root,
        Platform.OS === "android"
          ? { width: screenFrame.width, minHeight: screenFrame.height }
          : null,
      ]}
    >
      {READ_PARCHMENT_COLOR_MODE === "dark" ? (
        <LinearGradient
          colors={["rgba(26, 20, 16, 0.42)", "rgba(14, 11, 9, 0.78)"]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      ) : null}
      {children}
    </ReadParchmentBackgroundImage>
  );
}

/** 探索 / 读经 Stack 子屏：透明正文区，透出外层羊皮 JPG。 */
export const PARCHMENT_STACK_SCREEN_STYLE = {
  flex: 1,
  backgroundColor: "transparent" as const,
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: "hidden",
    backgroundColor: c.canvas,
  },
});
