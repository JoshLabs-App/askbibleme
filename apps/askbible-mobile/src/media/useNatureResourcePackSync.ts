import { useEffect, useState } from "react";
import {
  hydrateNatureResourcePackState,
  subscribeNatureResourcePackChange,
} from "./natureResourcePackSync";

/**
 * 监听已下载的自然资源包变化，并在资源切换后触发重渲染。
 */
export function useNatureResourcePackSync(): number {
  const [rev, setRev] = useState(0);

  useEffect(() => {
    void hydrateNatureResourcePackState();
    const off = subscribeNatureResourcePackChange(() => {
      setRev((n) => n + 1);
    });
    return off;
  }, []);

  return rev;
}

