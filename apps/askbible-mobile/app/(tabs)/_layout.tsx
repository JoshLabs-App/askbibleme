import { Tabs } from "expo-router";
import { ShellSwipeNavView } from "../../src/shell/ShellSwipeNavView";
import { SHELL_TABS_SCREEN_OPTIONS } from "../../src/shell/shellLayout";
import { ShellTabBar } from "../../src/shell/ShellTabBar";

export const unstable_settings = {
  initialRouteName: "index",
};

export default function TabsLayout() {
  return (
    <ShellSwipeNavView>
      <Tabs
        initialRouteName="index"
        tabBar={(props) => <ShellTabBar {...props} />}
        screenOptions={SHELL_TABS_SCREEN_OPTIONS}
        sceneContainerStyle={{ flex: 1, backgroundColor: "transparent" }}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="music" />
        <Tabs.Screen name="read" />
        <Tabs.Screen name="explore" />
        <Tabs.Screen name="journey" options={{ href: null }} />
      </Tabs>
    </ShellSwipeNavView>
  );
}
