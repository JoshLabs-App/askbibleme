import { Tabs } from "expo-router";
import { StyleSheet, View } from "react-native";
import { ReadBibleTypographyProvider } from "../../src/read/ReadBibleTypographyContext";
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
    <ReadBibleTypographyProvider>
    <View style={styles.root}>
      <ShellSwipeNavView>
        <Tabs
          initialRouteName="index"
          tabBar={(props) => <ShellTabBarCapture {...props} />}
          screenOptions={SHELL_TABS_SCREEN_OPTIONS}
        >
          <Tabs.Screen name="index" options={{ lazy: false, freezeOnBlur: false }} />
          <Tabs.Screen name="music" options={{ freezeOnBlur: true }} />
          <Tabs.Screen name="read" options={{ lazy: false, freezeOnBlur: false }} />
          <Tabs.Screen name="explore" options={{ freezeOnBlur: true }} />
          <Tabs.Screen name="journey" options={{ href: null }} />
        </Tabs>
      </ShellSwipeNavView>
      <View style={styles.tabBarHost} pointerEvents="box-none">
        <ShellTabBarBottomScrimLayer />
        <ShellTabBarPortal />
      </View>
    </View>
    </ReadBibleTypographyProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: parchment.canvas,
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
