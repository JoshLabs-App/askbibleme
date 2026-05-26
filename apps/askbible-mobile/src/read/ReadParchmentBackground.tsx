import type { ReactNode } from "react";
import { ImageBackground, Platform, StyleSheet, View, useWindowDimensions } from "react-native";
import { useShellFullBleedFrame } from "../shell/shellLayout";
import { LinearGradient } from "expo-linear-gradient";
import { READ_PARCHMENT_COLOR_MODE, readParchmentTheme as c } from "./readParchmentTheme";

const parchmentSource = require("../../assets/images/read-parchment-scroll-bg.jpg");

/** 羊皮卷底图按屏幕宽高铺满（允许拉伸变形）；正文区透明叠在上层 */
export function ReadParchmentBackground({ children }: { children: ReactNode }) {
  const window = useWindowDimensions();
  const screenFrame = useShellFullBleedFrame();
  const width = Platform.OS === "android" ? screenFrame.width : window.width;
  const height = Platform.OS === "android" ? screenFrame.height : window.height;

  return (
    <View style={styles.root}>
      <ImageBackground
        source={parchmentSource}
        resizeMode="stretch"
        style={[styles.bg, { width, height }]}
        imageStyle={styles.bgImage}
      />
      {READ_PARCHMENT_COLOR_MODE === "dark" ? (
        <LinearGradient
          colors={["rgba(26, 20, 16, 0.42)", "rgba(14, 11, 9, 0.78)"]}
          style={[StyleSheet.absoluteFill, { width, height }]}
          pointerEvents="none"
        />
      ) : null}
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: "hidden",
    backgroundColor: c.canvas,
  },
  bg: {
    position: "absolute",
    left: 0,
    top: 0,
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
