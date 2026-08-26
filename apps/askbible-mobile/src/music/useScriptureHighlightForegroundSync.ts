import { useEffect } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { isForegroundState } from "./useAppForeground";
import { setScripturePlaybackSecForeground } from "./scripturePlaybackSec";

/**
 * 把 App 前后台状态接到读经高亮计时器上。挂在 App 级 provider，全程有效。
 * 不返回值：避免前后台切换时触发整棵树重渲染。
 */
export function useScriptureHighlightForegroundSync(): void {
  useEffect(() => {
    const sync = (state: AppStateStatus) => {
      setScripturePlaybackSecForeground(isForegroundState(state));
    };
    sync(AppState.currentState);
    const sub = AppState.addEventListener("change", sync);
    return () => {
      sub.remove();
      setScripturePlaybackSecForeground(true);
    };
  }, []);
}
