import { Tabs } from "expo-router";
import { Platform, StyleSheet, View } from "react-native";
import { ReadParchmentFillLayer } from "../../src/read/ReadParchmentSurface";
import { readParchmentTheme as parchment } from "../../src/read/readParchmentTheme";
import { ShellSwipeNavView } from "../../src/shell/ShellSwipeNavView";
import { SHELL_TABS_SCREEN_OPTIONS } from "../../src/shell/shellLayout";
import { ShellTabBarBottomScrimLayer } from "../../src/shell/ShellTabBarBottomScrimLayer";
import { ShellTabBarCapture, ShellTabBarPortal } from "../../src/shell/ShellTabBar";

export const unstable_settings = {
  initialRouteName: "index",
};

export default function TabsLayout() {
  return (
    <View style={styles.root}>
      {/* Android：底栏后方常露出纯色 canvas；根层铺羊皮，读经/计划/探索与 iOS 一致透出纹理 */}
      {Platform.OS === "android" ? <ReadParchmentFillLayer /> : null}
      <ShellSwipeNavView>
        <Tabs
          initialRouteName="index"
          tabBar={(props) => <ShellTabBarCapture {...props} />}
          screenOptions={SHELL_TABS_SCREEN_OPTIONS}
        >
          {/* Home 不 freeze：环境音 defer/混音依赖播放态更新；冻住后音乐 Tab 点播会被环境音掐死 */}
          <Tabs.Screen name="index" options={{ lazy: false, freezeOnBlur: false }} />
          <Tabs.Screen name="music" options={{ freezeOnBlur: true }} />
          {/* read 不 freeze 整 Tab：与章页 freezeOnBlur 叠在一起时，底栏切换会视觉卡住 */}
          <Tabs.Screen name="read" options={{ lazy: false, freezeOnBlur: false }} />
          {/* explore 保持 lazy，减轻首启 JS 压力 */}
          <Tabs.Screen name="explore" options={{ freezeOnBlur: true }} />
          <Tabs.Screen name="journey" options={{ href: null }} />
        </Tabs>
      </ShellSwipeNavView>
      <View style={styles.tabBarHost} pointerEvents="box-none">
        <ShellTabBarBottomScrimLayer />
        <ShellTabBarPortal />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: parchment.canvas,
    overflow: Platform.OS === "android" ? "visible" : "hidden",
  },
  tabBarHost: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
    elevation: 0,
    backgroundColor: "transparent",
  },
});
