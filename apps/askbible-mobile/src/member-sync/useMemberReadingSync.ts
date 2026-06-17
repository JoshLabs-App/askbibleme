import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { readMemberSession } from "../auth/memberSession";
import { isMobileOfflineFirst } from "../config/mobileBundledOnly";
import { scheduleMemberReadingSync } from "./runMemberReadingSync";

async function syncIfLoggedIn(): Promise<void> {
  if (isMobileOfflineFirst()) return;
  const session = await readMemberSession();
  if (!session?.sessionToken) return;
  scheduleMemberReadingSync(session.sessionToken);
}

/** 登录后、冷启动、回到前台与活跃轮询时增量同步读经进度。 */
export function useMemberReadingSync(enabled: boolean): void {
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  useEffect(() => {
    if (!enabled) return;
    void syncIfLoggedIn();
  }, [enabled]);

  useEffect(() => {
    if (isMobileOfflineFirst()) return;
    const onChange = (state: AppStateStatus) => {
      if (state !== "active" || !enabledRef.current) return;
      void syncIfLoggedIn();
    };
    const sub = AppState.addEventListener("change", onChange);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!enabled || isMobileOfflineFirst()) return;
    const id = setInterval(() => {
      if (!enabledRef.current) return;
      void syncIfLoggedIn();
    }, 45_000);
    return () => clearInterval(id);
  }, [enabled]);
}

export async function syncMemberReadingAfterLogin(sessionToken: string): Promise<void> {
  if (isMobileOfflineFirst()) return;
  scheduleMemberReadingSync(sessionToken);
}
