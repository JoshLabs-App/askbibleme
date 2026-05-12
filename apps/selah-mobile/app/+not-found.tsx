import { Stack, useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { theme } from "../src/theme";

export default function NotFoundScreen() {
  const router = useRouter();
  return (
    <>
      <Stack.Screen options={{ title: "未找到", headerTintColor: theme.ink }} />
      <View style={styles.box}>
        <Text style={styles.title}>页面不存在</Text>
        <Pressable onPress={() => router.replace("/")} accessibilityRole="button">
          <Text style={styles.link}>返回首页</Text>
        </Pressable>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  box: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: theme.canvas,
  },
  title: { fontSize: 16, color: theme.ink, marginBottom: 16 },
  link: { fontSize: 15, color: theme.sand, fontWeight: "600" },
});
