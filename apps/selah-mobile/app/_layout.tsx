import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useColorScheme } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { theme } from "../src/theme";

export default function RootLayout() {
  const scheme = useColorScheme();
  return (
    <SafeAreaProvider>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <Stack
        screenOptions={{
          contentStyle: { flex: 1, backgroundColor: theme.canvas },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="relax"
          options={{
            title: "放松",
            headerBackTitle: "返回",
            headerTintColor: theme.ink,
            headerStyle: { backgroundColor: theme.canvas },
            headerShadowVisible: false,
          }}
        />
      </Stack>
    </SafeAreaProvider>
  );
}
