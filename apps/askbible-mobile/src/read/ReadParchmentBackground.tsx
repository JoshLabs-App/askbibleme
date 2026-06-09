import type { ReactNode } from "react";
import { ImageBackground, Platform, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useShellFullBleedFrame } from "../shell/shellLayout";
import { READ_PARCHMENT_SCROLL_SOURCE } from "./ReadParchmentSurface";
import { READ_PARCHMENT_COLOR_MODE, readParchmentTheme as c } from "./readParchmentTheme";

/**
 * 羊皮卷底图：ImageBackground 包裹正文（flex 铺满）。
 * 避免绝对定位底图在 Modal 内只露出底部一条纹理。
 */
export function ReadParchmentBackground({ children }: { children: ReactNode }) {
  const screenFrame = useShellFullBleedFrame();

  return (
    <View
      style={[
        styles.root,
        Platform.OS === "android"
          ? { width: screenFrame.width, minHeight: screenFrame.height }
          : null,
      ]}
    >
      <ImageBackground
        source={READ_PARCHMENT_SCROLL_SOURCE}
        resizeMode="stretch"
        style={styles.wrapper}
        imageStyle={styles.bgImage}
      >
        {READ_PARCHMENT_COLOR_MODE === "dark" ? (
          <LinearGradient
            colors={["rgba(26, 20, 16, 0.42)", "rgba(14, 11, 9, 0.78)"]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
        ) : null}
        <View style={styles.content}>{children}</View>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: "hidden",
    backgroundColor: c.canvas,
  },
  wrapper: {
    flex: 1,
    width: "100%",
  },
  bgImage: {
    width: "100%",
    height: "100%",
  },
  content: {
    flex: 1,
    backgroundColor: "transparent",
  },
});
