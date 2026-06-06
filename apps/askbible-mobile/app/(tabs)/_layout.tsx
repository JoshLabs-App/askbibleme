import { Tabs } from "expo-router";
import { StyleSheet, View } from "react-native";
import { ShellSwipeNavView } from "../../src/shell/ShellSwipeNavView";
import { SHELL_TABS_SCREEN_OPTIONS } from "../../src/shell/shellLayout";
import { ShellTabBarCapture, ShellTabBarPortal } from "../../src/shell/ShellTabBar";

export const unstable_settings = {
  initialRouteName: "index",
};

export default function TabsLayout() {
  return (
    <View style={styles.root}>
      <ShellSwipeNavView>
        <Tabs
          initialRouteName="index"
          tabBar={(props) => <ShellTabBarCapture {...props} />}
          screenOptions={SHELL_TABS_SCREEN_OPTIONS}
        >
          <Tabs.Screen name="index" />
          <Tabs.Screen name="music" />
          <Tabs.Screen name="read" />
          <Tabs.Screen name="explore" />
          <Tabs.Screen name="journey" options={{ href: null }} />
        </Tabs>
      </ShellSwipeNavView>
      <View style={styles.tabBarHost} pointerEvents="box-none">
        <ShellTabBarPortal />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  tabBarHost: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
  },
});
