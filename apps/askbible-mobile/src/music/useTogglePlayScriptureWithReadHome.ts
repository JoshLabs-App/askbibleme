import { useCallback } from "react";
import { usePathname, useRouter } from "expo-router";
import { isReadBibleHomeRoute } from "../read/read-route-chrome";
import { startTodayReadingScriptureFromReadHome } from "../read/startTodayReadingScriptureFromReadHome";

type Args = {
  playing: boolean;
  playbackMode: "music" | "scripture";
  readHomeTodayAudioReady: boolean;
  togglePlayScriptureBase: () => Promise<void>;
};

export function useTogglePlayScriptureWithReadHome({
  playing,
  playbackMode,
  readHomeTodayAudioReady,
  togglePlayScriptureBase,
}: Args) {
  const pathname = usePathname();
  const router = useRouter();

  return useCallback(async () => {
    if (isReadBibleHomeRoute(pathname)) {
      if (playbackMode === "scripture" && playing) {
        await togglePlayScriptureBase();
        return;
      }
      if (readHomeTodayAudioReady) {
        await startTodayReadingScriptureFromReadHome(router);
        return;
      }
      return;
    }
    await togglePlayScriptureBase();
  }, [
    pathname,
    playbackMode,
    playing,
    readHomeTodayAudioReady,
    router,
    togglePlayScriptureBase,
  ]);
}
