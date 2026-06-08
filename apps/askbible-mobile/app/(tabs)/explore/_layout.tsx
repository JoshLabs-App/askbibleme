import { Stack } from "expo-router";
import { ReadParchmentBackground } from "../../../src/read/ReadParchmentBackground";

export default function ExploreStackLayout() {
  return (
    <ReadParchmentBackground>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: "slide_from_right",
          contentStyle: { flex: 1, backgroundColor: "transparent" },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="year-day-count/index" />
        <Stack.Screen name="biblical-feasts/index" />
        <Stack.Screen name="years-days-eternity/index" />
        <Stack.Screen name="word-of-god/index" />
        <Stack.Screen name="encouraging-words/index" />
        <Stack.Screen name="narrow-gate/index" />
        <Stack.Screen name="praise-worship/index" />
        <Stack.Screen name="prayer/index" />
        <Stack.Screen name="articles/[slug]/index" />
      </Stack>
    </ReadParchmentBackground>
  );
}
