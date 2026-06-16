import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useMemberAuth } from "../../src/auth/MemberAuthProvider";

type Line = { ts: string; text: string };

function stamp(): string {
  return new Date().toISOString().slice(11, 19);
}

export default function DevOAuthSmokeScreen() {
  const { auto } = useLocalSearchParams<{ auto?: string }>();
  const { signInWithGoogle, signInWithApple, user } = useMemberAuth();
  const [lines, setLines] = useState<Line[]>([]);

  const push = useCallback((text: string) => {
    const line = { ts: stamp(), text };
    setLines((prev) => [...prev, line]);
    if (__DEV__) console.log(`[DevOAuthSmoke] ${text}`);
  }, []);

  const runGoogle = useCallback(async () => {
    push("google: start");
    const result = await signInWithGoogle();
    push(`google: ${JSON.stringify(result)}`);
    return result;
  }, [push, signInWithGoogle]);

  const runApple = useCallback(async () => {
    push("apple: start");
    const result = await signInWithApple();
    push(`apple: ${JSON.stringify(result)}`);
    return result;
  }, [push, signInWithApple]);

  useEffect(() => {
    if (!__DEV__ || !auto) return;
    if (auto === "google") void runGoogle();
    if (auto === "apple") void runApple();
    if (auto === "both") {
      void (async () => {
        await runGoogle();
        await runApple();
      })();
    }
  }, [auto, runApple, runGoogle]);

  if (!__DEV__) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <Text>Not available</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
      <Text style={{ fontSize: 18, fontWeight: "600" }}>Dev OAuth smoke</Text>
      <Text>User: {user ? `${user.email} (${user.id})` : "none"}</Text>
      <Pressable onPress={() => void runGoogle()} style={{ padding: 12, backgroundColor: "#eee" }}>
        <Text>Test Google</Text>
      </Pressable>
      <Pressable onPress={() => void runApple()} style={{ padding: 12, backgroundColor: "#eee" }}>
        <Text>Test Apple</Text>
      </Pressable>
      {lines.map((line, index) => (
        <Text key={`${line.ts}-${index}`} style={{ fontFamily: "Menlo", fontSize: 12 }}>
          {line.ts} {line.text}
        </Text>
      ))}
    </ScrollView>
  );
}
