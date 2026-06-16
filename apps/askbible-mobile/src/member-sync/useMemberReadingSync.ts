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

/** 登录后、冷启动与回到前台时增量同步读经进度。 */
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
}

export async function syncMemberReadingAfterLogin(sessionToken: string): Promise<void> {
  if (isMobileOfflineFirst()) return;
  scheduleMemberReadingSync(sessionToken);
}
