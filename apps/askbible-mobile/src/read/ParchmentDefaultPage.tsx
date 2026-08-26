import type { ReactNode } from "react";
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { ReadParchmentBackground } from "./ReadParchmentBackground";

type Props = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/**
 * 共享默认页壳：屏内全屏羊皮卷底 + 透明内容区。
 * 探索 / 读经等需羊皮底的页面统一包一层；勿再自铺实色 canvas。
 * （Stack 原生层可能挡住 layout 外层底图，故底图须在 Screen 内容树内。）
 */
export function ParchmentDefaultPage({ children, style }: Props) {
  return (
    <ReadParchmentBackground>
      <View style={[styles.content, style]} collapsable={false}>
        {children}
      </View>
    </ReadParchmentBackground>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    backgroundColor: "transparent",
    overflow: Platform.OS === "android" ? "visible" : "hidden",
  },
});
