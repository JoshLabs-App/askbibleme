import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect } from "react";
import { runReadingAlarmE2E } from "../../src/notifications/readingAlarmDevE2ERunner";

/** __DEV__ only — triggered by `askbible://dev/reading-alarm?mode=weekdays`. */
export default function DevReadingAlarmScreen() {
  const router = useRouter();
  const { mode } = useLocalSearchParams<{ mode?: string | string[] }>();

  useEffect(() => {
    if (!__DEV__) {
      router.replace("/");
      return;
    }
    const resolved = Array.isArray(mode) ? mode[0] : mode;
    void runReadingAlarmE2E(resolved?.trim() || "full").finally(() => {
      router.replace("/");
    });
  }, [mode, router]);

  return null;
}
