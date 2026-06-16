import { useEffect, useState } from "react";
import { InteractionManager } from "react-native";
import {
  hydrateNatureResourcePackState,
  subscribeNatureResourcePackChange,
} from "./natureResourcePackSync";

/**
 * 监听已下载的自然资源包变化，并在资源切换后触发重渲染。
 * `enabled=false` 时跳过 hydrate（例如页面未聚焦）。
 */
export function useNatureResourcePackSync(enabled = true): number {
  const [rev, setRev] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    const task = InteractionManager.runAfterInteractions(() => {
      void hydrateNatureResourcePackState();
    });
    const off = subscribeNatureResourcePackChange(() => {
      setRev((n) => n + 1);
    });
    return () => {
      task.cancel();
      off();
    };
  }, [enabled]);

  return rev;
}
