import { StatusBar } from "expo-status-bar";
import type { ColorValue } from "react-native";
import { Platform, PlatformColor, StyleSheet, useColorScheme, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

export default function App() {
  const scheme = useColorScheme();

  let backgroundColor: ColorValue;
  if (Platform.OS === "ios") {
    backgroundColor = PlatformColor("systemBackground");
  } else {
    try {
      backgroundColor = PlatformColor("?android:attr/colorBackground");
    } catch {
      backgroundColor = scheme === "dark" ? "#121212" : "#fafafa";
    }
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView
        style={[styles.safe, { backgroundColor }]}
        edges={["top", "left", "right", "bottom"]}
      >
        <StatusBar style={scheme === "dark" ? "light" : "dark"} />
        <View style={styles.main} />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  main: {
    flex: 1,
  },
});
