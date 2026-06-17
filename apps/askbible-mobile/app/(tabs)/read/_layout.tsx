import { Stack } from "expo-router";
import { ReadBibleSettingsButton } from "../../../src/read/ReadBibleSettingsButton";
import { ReadParchmentBackground } from "../../../src/read/ReadParchmentBackground";
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
          contentStyle: { flex: 1, backgroundColor: "transparent" },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="catalog" />
        <Stack.Screen name="search" />
        <Stack.Screen name="favorites" />
        <Stack.Screen name="plans/index" />
        <Stack.Screen name="plans/[planId]" />
        <Stack.Screen
          name="[bookId]/[chapter]"
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
