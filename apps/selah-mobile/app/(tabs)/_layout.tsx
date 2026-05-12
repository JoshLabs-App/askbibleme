import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Tabs } from "expo-router";
import { StyleSheet, useColorScheme, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { strings } from "../../src/strings";
import { theme } from "../../src/theme";

function TabIcon({ name, color }: { name: keyof typeof MaterialIcons.glyphMap; color: string }) {
  return <MaterialIcons name={name} size={22} color={color} />;
}

export default function TabsLayout() {
  const scheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const isDark = scheme === "dark";
  const tabBg = "#89C6F6";
  const borderTop = "rgba(43, 37, 32, 0.12)";
  const active = theme.ink;
  const inactive = "rgba(43, 37, 32, 0.5)";

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: active,
        tabBarInactiveTintColor: inactive,
        tabBarStyle: {
          backgroundColor: tabBg,
          borderTopColor: borderTop,
          borderTopWidth: StyleSheet.hairlineWidth,
          paddingTop: 6,
          paddingBottom: Math.max(insets.bottom, 8),
          height: 56 + Math.max(insets.bottom, 8),
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600", marginBottom: 2 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: strings.nav.home,
          tabBarIcon: ({ color }) => <TabIcon name="home" color={color} />,
        }}
      />
      <Tabs.Screen
        name="journey"
        options={{
          title: strings.nav.journey,
          tabBarIcon: ({ color }) => <TabIcon name="directions-walk" color={color} />,
        }}
      />
      <Tabs.Screen
        name="music"
        options={{
          title: strings.nav.music,
          tabBarIcon: ({ color, focused }) => (
            <View
              style={[
                styles.musicFab,
                {
                  backgroundColor: focused ? (isDark ? "#3f3f46" : "#fff") : isDark ? "#27272a" : "#fff",
                  borderColor: focused ? theme.sand : theme.border,
                },
              ]}
            >
              <MaterialIcons name="library-music" size={22} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="read"
        options={{
          title: strings.nav.read,
          tabBarIcon: ({ color }) => <TabIcon name="menu-book" color={color} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: strings.nav.explore,
          tabBarIcon: ({ color }) => <TabIcon name="explore" color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  musicFab: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
});
