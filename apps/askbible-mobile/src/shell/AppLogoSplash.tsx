import { Image, StyleSheet, View } from "react-native";
import { SPLASH_BACKGROUND } from "./splash-branding.generated";

/** 启动 / 拉取配置时的全屏品牌占位（无文案） */
export function AppLogoSplash() {
  return (
    <View style={styles.root}>
      <Image
        source={require("../../assets/splash-icon.png")}
        style={styles.logo}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: SPLASH_BACKGROUND,
    alignItems: "center",
    justifyContent: "center",
  },
  logo: {
    width: 320,
    height: 320,
  },
});
