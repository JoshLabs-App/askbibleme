import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import * as Updates from "expo-updates";

/**
 * Preview 壳：启动与回到前台时检查 / 拉取 / 热重载 OTA。
 * 目标：改完发 `mobile:update:preview` 后，真机再打开即可用最新热更（戳记跟 OTA 时间走）。
 */
export function PreviewOtaReloadBridge() {
  const checkingRef = useRef(false);

  useEffect(() => {
    if (__DEV__) return;
    if (!Updates.isEnabled) return;
    if (Updates.channel !== "preview") return;

    let cancelled = false;

    const run = async () => {
      if (cancelled || checkingRef.current) return;
      checkingRef.current = true;
      try {
        const check = await Updates.checkForUpdateAsync();
        if (cancelled || !check.isAvailable) return;
        const fetched = await Updates.fetchUpdateAsync();
        if (cancelled || !fetched.isNew) return;
        await Updates.reloadAsync();
      } catch {
        /* 离线或 Expo 不可达时忽略，继续用本地已有包 */
      } finally {
        checkingRef.current = false;
      }
    };

    void run();

    const onAppState = (state: AppStateStatus) => {
      if (state === "active") void run();
    };
    const sub = AppState.addEventListener("change", onAppState);

    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);

  return null;
}
