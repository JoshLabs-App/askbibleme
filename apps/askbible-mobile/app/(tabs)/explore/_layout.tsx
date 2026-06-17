import { Stack } from "expo-router";
import { ReadParchmentBackground } from "../../../src/read/ReadParchmentBackground";

export default function ExploreStackLayout() {
  return (
    <ReadParchmentBackground>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: "slide_from_right",
          freezeOnBlur: true,
          contentStyle: { flex: 1, backgroundColor: "transparent" },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="year-day-count/index" />
        <Stack.Screen name="year-day-count/birth-settings" />
        <Stack.Screen name="biblical-feasts/index" />
        <Stack.Screen name="years-days-eternity/index" />
        <Stack.Screen name="word-of-god/index" />
        <Stack.Screen name="bible-maps/index" />
        <Stack.Screen name="historical-creeds/index" />
        <Stack.Screen name="history-timeline/index" />
        <Stack.Screen name="scripture-pool-01/index" />
        <Stack.Screen name="scripture-pool-02/index" />
        <Stack.Screen name="scripture-pool-03/index" />
        <Stack.Screen name="scripture-pool-04/index" />
        <Stack.Screen name="scripture-pool-05/index" />
        <Stack.Screen name="narrow-gate/index" />
        <Stack.Screen name="praise-worship/index" />
        <Stack.Screen name="prayer/index" />
        <Stack.Screen name="figures/index" />
        <Stack.Screen name="figures/[slug]/index" />
        <Stack.Screen name="articles/[slug]/index" />
      </Stack>
    </ReadParchmentBackground>
  );
}
