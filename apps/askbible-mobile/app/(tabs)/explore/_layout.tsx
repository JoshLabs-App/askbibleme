import { Stack } from "expo-router";
import {
  PARCHMENT_STACK_SCREEN_STYLE,
  ReadParchmentBackground,
} from "../../../src/read/ReadParchmentBackground";

export default function ExploreStackLayout() {
  // 与读经 Tab 共用同一套羊皮栈设置（透明 contentStyle + 外层 ReadParchmentBackground）。
  return (
    <ReadParchmentBackground>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: "slide_from_right",
          freezeOnBlur: true,
          contentStyle: PARCHMENT_STACK_SCREEN_STYLE,
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="year-day-count/index" />
        <Stack.Screen name="year-day-count/birth-settings" />
        <Stack.Screen name="reading-alarm/index" />
        <Stack.Screen name="years-days-eternity/index" />
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
        <Stack.Screen
          name="reading-planner/index"
          options={{ animation: "slide_from_right", freezeOnBlur: false }}
        />
      </Stack>
    </ReadParchmentBackground>
  );
}
