import type { ReactNode } from "react";
import { Platform, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useShellFullBleedFrame } from "../shell/shellLayout";
import { ReadParchmentBackgroundImage } from "./ReadParchmentSurface";
import { READ_PARCHMENT_COLOR_MODE, readParchmentTheme as c } from "./readParchmentTheme";

type Props = {
  children: ReactNode;
};

/**
 * 全屏羊皮卷底（默认）：探索 / 读经 Tab 栈、全屏 Modal、欢迎页等统一用此组件。
 * 子页面也可再包 {@link ParchmentDefaultPage}：Native Stack 可能挡住 layout 外层底图，
 * 屏内再铺一层可保证纹理可见。内容根保持 `backgroundColor: "transparent"`。
 *
 * 屏内嵌套时仅靠 flex + absoluteFill，JPG 层可能高度为 0（只剩 canvas 实色）；
 * 因此始终用窗口尺寸钉死铺底层，与读经页同一张羊皮图。
 */
export function ReadParchmentBackground({ children }: Props) {
  const screenFrame = useShellFullBleedFrame();

  return (
    <ReadParchmentBackgroundImage
      fill
      style={[
        styles.root,
        { width: screenFrame.width, minHeight: screenFrame.height },
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
    overflow: Platform.OS === "android" ? "visible" : "hidden",
    backgroundColor: c.canvas,
  },
});
