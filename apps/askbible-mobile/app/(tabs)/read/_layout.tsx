import { Stack } from "expo-router";
import { ReadBibleSettingsButton } from "../../../src/read/ReadBibleSettingsButton";
import {
  PARCHMENT_STACK_SCREEN_STYLE,
  ReadParchmentBackground,
} from "../../../src/read/ReadParchmentBackground";
import { ReadTripleLoopPlanSync } from "../../../src/read/ReadTripleLoopPlanSync";

export const unstable_settings = {
  initialRouteName: "index",
};

export default function ReadStackLayout() {
  return (
    <ReadParchmentBackground>
      <ReadTripleLoopPlanSync />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: "slide_from_right",
          freezeOnBlur: false,
          contentStyle: PARCHMENT_STACK_SCREEN_STYLE,
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="catalog" />
        <Stack.Screen name="search" />
        <Stack.Screen name="translations" />
        <Stack.Screen name="favorites" />
        <Stack.Screen name="plans/index" />
        <Stack.Screen name="plans/[planId]" />
        <Stack.Screen
          name="plan-play"
          // 与经文页一致：系统默认侧滑推入/返回
          options={{ animation: "slide_from_right" }}
        />
        <Stack.Screen
          name="[bookId]/[chapter]"
          options={{
            animation: "slide_from_right",
            // 离开章页（搜索/收藏）时冻结，避免底下整章经文继续吃 JS（安卓卡顿主因之一）。
            freezeOnBlur: true,
          }}
          dangerouslySingular={(_name, params) => {
            const bookId = Array.isArray(params?.bookId) ? params?.bookId[0] : params?.bookId;
            const chapter = Array.isArray(params?.chapter) ? params?.chapter[0] : params?.chapter;
            return `${bookId ?? ""}:${chapter ?? ""}`;
          }}
        />
      </Stack>
      <ReadBibleSettingsButton />
    </ReadParchmentBackground>
  );
}
